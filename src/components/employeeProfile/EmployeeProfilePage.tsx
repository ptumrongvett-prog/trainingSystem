import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FIXTURE_ASSIGNMENTS,
  FIXTURE_DIRECTORY,
  FIXTURE_TODAY,
  FIXTURE_TOPIC_NAMES,
  fixtureFn135,
  fixturePartReport,
  fixtureQcEmployees,
  fixtureQcSummary,
  isEmployeeProfileFixture,
} from '../../data/employeeProfileFixture';
import { useDataStore } from '../../hooks/useDataStore';
import {
  assembleEmployeeProfile,
  buildOverviewRows,
  filterOverview,
  sortOverview,
  type OverviewEmployee,
  type OverviewSort,
} from '../../lib/employeeProfile';
import type { Fn135Submission } from '../../lib/fn135Records';
import { getTopicName } from '../../lib/topicMap';
import { formatQcStamp, type QcEmployeeHistory, type QcSummary } from '../../lib/qcContract';
import { aggregatePartTraining, normalizeEmployeeId, type PartTrainingReport } from '../../lib/partTraining';
import { loadFn135ForEmployee } from '../../services/fn135Records';
import { loadPartTrainingSource } from '../../services/partTrainingSheets';
import { loadQcHistory, type QcLoadResult } from '../../services/qcHistory';
import EmptyState from '../shared/EmptyState';
import EmployeeDetail from './EmployeeDetail';

interface Props {
  focusEmpId?: string | null;
}

const NO_QC: QcEmployeeHistory[] = [];

function canonicalId(value: string | null | undefined): string | null {
  if (!value) return null;
  return normalizeEmployeeId(value) ?? value.trim();
}

export default function EmployeeProfilePage({ focusEmpId = null }: Props) {
  const fixture = isEmployeeProfileFixture();
  const { data } = useDataStore();
  const [today] = useState(() => new Date());
  const [report, setReport] = useState<PartTrainingReport | null>(() => (fixture ? fixturePartReport() : null));
  const [trainingLoading, setTrainingLoading] = useState(!fixture);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingProgress, setTrainingProgress] = useState('Reading the FN-112 training log…');
  const [qc, setQc] = useState<QcLoadResult>(() => (
    fixture
      ? { status: 'ready', summary: fixtureQcSummary(), employees: fixtureQcEmployees() }
      : { status: 'not_synced' }
  ));
  const [qcLoading, setQcLoading] = useState(!fixture);
  const [reloadToken, setReloadToken] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<OverviewSort>('incidents');
  const [selectedId, setSelectedId] = useState<string | null>(() => canonicalId(focusEmpId));
  const [fn135, setFn135] = useState<{ empId: string; status: 'loading' | 'ready' | 'error'; rows: Fn135Submission[] }>({
    empId: '',
    status: 'ready',
    rows: [],
  });

  useEffect(() => {
    if (fixture) return;
    let cancelled = false;

    loadPartTrainingSource({
      force: reloadToken > 0,
      onProgress: loaded => {
        if (!cancelled) setTrainingProgress(`Reading the FN-112 training log… ${loaded.toLocaleString()} rows`);
      },
    }).then(source => {
      if (cancelled) return;
      setReport(aggregatePartTraining(source.rows, source.activeEmployees, new Date()));
      setTrainingLoading(false);
    }).catch((err: unknown) => {
      if (cancelled) return;
      setTrainingError(err instanceof Error ? err.message : 'Could not load part training.');
      setTrainingLoading(false);
    });

    loadQcHistory().then(result => {
      if (cancelled) return;
      setQc(result);
      setQcLoading(false);
    }).catch((err: unknown) => {
      if (cancelled) return;
      setQc({ status: 'error', message: err instanceof Error ? err.message : 'Could not load QC history.' });
      setQcLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [fixture, reloadToken]);

  useEffect(() => {
    if (!selectedId || fixture) return;
    let cancelled = false;
    const empId = selectedId;
    loadFn135ForEmployee(empId).then(rows => {
      if (!cancelled) setFn135({ empId, status: 'ready', rows });
    }).catch(() => {
      if (!cancelled) setFn135({ empId, status: 'error', rows: [] });
    });
    return () => {
      cancelled = true;
    };
  }, [fixture, selectedId]);

  const directory = fixture ? FIXTURE_DIRECTORY : data.employees;
  const assignments = fixture ? FIXTURE_ASSIGNMENTS : data.assignments;
  const clock = fixture ? FIXTURE_TODAY : today;
  const topicName = useCallback((topicId: string) => {
    return (fixture ? FIXTURE_TOPIC_NAMES[topicId] : '') || getTopicName(topicId);
  }, [fixture]);
  const trainingReady = report != null && !trainingLoading && !trainingError;
  const qcEmployees = qc.status === 'ready' ? qc.employees : NO_QC;
  const qcView: QcLoadResult | { status: 'loading' } = qcLoading ? { status: 'loading' } : qc;

  const overview = useMemo(() => buildOverviewRows({
    qcEmployees,
    partEmployees: report?.employees ?? [],
    directory,
    assignments,
    topicName,
    trainingLoaded: trainingReady,
    today: clock,
  }), [qcEmployees, report, directory, assignments, topicName, trainingReady, clock]);

  const qcRows = useMemo(
    () => sortOverview(filterOverview(overview, search, true), sort),
    [overview, search, sort],
  );
  const otherRows = useMemo(() => {
    if (!search.trim()) return [];
    return sortOverview(filterOverview(overview, search, false).filter(row => !row.hasQc), 'incidents');
  }, [overview, search]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return assembleEmployeeProfile({
      empId: selectedId,
      partEmployee: report?.employees.find(employee => employee.empId === selectedId) ?? null,
      directory,
      assignments,
      topicName,
      qc: qcEmployees.find(employee => employee.employeeId === selectedId) ?? null,
      today: clock,
    });
  }, [selectedId, report, directory, assignments, topicName, qcEmployees, clock]);

  const openEmployee = (empId: string) => setSelectedId(canonicalId(empId));

  if (selected && selectedId) {
    const fn135Rows = fixture
      ? (fixtureFn135()[selectedId] ?? [])
      : (fn135.empId === selectedId ? fn135.rows : []);
    const fn135Status = fixture || fn135.empId === selectedId ? (fixture ? 'ready' : fn135.status) : 'loading';
    return (
      <div>
        {fixture && <FixtureBanner />}
        <EmployeeDetail
          profile={selected}
          fn135={fn135Rows}
          fn135Status={fn135Status}
          trainingStatus={trainingError ? 'error' : trainingReady || fixture ? 'ready' : 'loading'}
          trainingError={trainingError}
          qcState={qcView}
          showFlags={trainingReady || (fixture && report != null)}
          onBack={() => setSelectedId(null)}
        />
      </div>
    );
  }

  const summary = qc.status === 'ready' ? qc.summary : null;

  return (
    <div>
      {fixture && <FixtureBanner />}
      <div className="page-header">
        <div>
          <h1>Employee Profile</h1>
          <p className="ep-page-sub">{headerSync(qcView, summary)}</p>
        </div>
        {!fixture && (
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={() => {
              setTrainingLoading(true);
              setTrainingError(null);
              setTrainingProgress('Reading the FN-112 training log…');
              setQcLoading(true);
              setReloadToken(token => token + 1);
            }}>
              Refresh
            </button>
          </div>
        )}
      </div>

      {qc.status === 'ready' && summary?.lastRunOk === false && (
        <div className="alert-banner warning">
          <span>⚠️</span>
          <div>The last QC sync reported a problem. Counts below may be incomplete.</div>
        </div>
      )}

      <QcStatusBanner state={qcView} />

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Employees with QC problems</div>
          <div className="kpi-value blue">{qc.status === 'ready' ? qcEmployees.length.toLocaleString() : '—'}</div>
        </div>
        <div className="kpi-card critical">
          <div className="kpi-label">Open incidents</div>
          <div className="kpi-value red">{summary ? summary.openCount.toLocaleString() : '—'}</div>
        </div>
        <div className="kpi-card warning">
          <div className="kpi-label">Employees with a repeat</div>
          <div className="kpi-value amber">{summary ? summary.repeatEmployeeCount.toLocaleString() : '—'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">QC incidents in sync</div>
          <div className="kpi-value">{summary ? summary.incidentCount.toLocaleString() : '—'}</div>
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="filter-input"
          placeholder="🔍 Employee ID or name"
          value={search}
          onChange={event => setSearch(event.target.value)}
          aria-label="Search by employee ID or name"
          style={{ flex: 1, minWidth: 220 }}
        />
        <button
          type="button"
          className={`filter-btn ${sort === 'incidents' ? 'selected' : ''}`}
          onClick={() => setSort('incidents')}
        >
          Sort by incidents
        </button>
        <button
          type="button"
          className={`filter-btn ${sort === 'repeat' ? 'selected' : ''}`}
          onClick={() => setSort('repeat')}
        >
          Repeats first
        </button>
        {search && (
          <button type="button" className="filter-btn" onClick={() => setSearch('')}>Clear</button>
        )}
      </div>

      {trainingLoading && (
        <p className="ep-note" style={{ marginTop: -8, marginBottom: 12 }}>{trainingProgress}</p>
      )}
      {trainingError && (
        <div className="alert-banner warning">
          <span>⚠️</span>
          <div>{trainingError} Training-effectiveness flags stay hidden until the log loads.</div>
        </div>
      )}

      {qcLoading ? (
        <div className="card" style={{ textAlign: 'center', padding: 36 }}>Reading QC history…</div>
      ) : (
        <>
          <OverviewTable
            title="Employees with QC problems"
            rows={qcRows}
            empty={qcEmptyMessage(qc)}
            onOpen={openEmployee}
          />
          {otherRows.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <OverviewTable
                title="Training records with no QC problem"
                rows={otherRows}
                empty=""
                onOpen={openEmployee}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OverviewTable({
  title, rows, empty, onOpen,
}: {
  title: string;
  rows: OverviewEmployee[];
  empty: string;
  onOpen: (empId: string) => void;
}) {
  return (
    <section>
      <h2 className="ep-section-title">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState icon="👤" title="No matches" message={empty} />
      ) : (
        <div className="card" style={{ padding: 0, maxHeight: 'calc(100vh - 420px)', overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Employee</th>
                <th>Active</th>
                <th>Incidents</th>
                <th>Open</th>
                <th>Resolved</th>
                <th>Repeat</th>
                <th>Latest incident</th>
                <th>Training vs incident</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.empId} onClick={() => onOpen(row.empId)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{row.empId}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{row.employeeName || '—'}</td>
                  <td>
                    <span className={`status-badge ${row.active ? 'completed' : 'inactive'}`}>
                      {row.active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>{row.incidentCount.toLocaleString()}</td>
                  <td>{row.openCount.toLocaleString()}</td>
                  <td>{row.resolvedCount.toLocaleString()}</td>
                  <td>
                    <span className={`status-badge ${row.repeat ? 'overdue' : 'inactive'}`}>
                      {row.repeat ? 'Repeat' : 'No'}
                    </span>
                  </td>
                  <td>{formatQcStamp(row.latestIncidentAt)}</td>
                  <td>{linkSummary(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function qcEmptyMessage(state: QcLoadResult): string {
  if (state.status === 'ready') return 'No employees with QC problems match that search.';
  if (state.status === 'denied') {
    return 'QC history is hidden for this sign-in. Search still finds training records.';
  }
  if (state.status === 'not_synced') {
    return 'QC data not synced yet. Search by employee ID or name to open a training profile.';
  }
  return state.message;
}

function linkSummary(row: OverviewEmployee): string {
  if (!row.hasQc) return 'No QC incidents';
  if (!row.linkCounts) return 'Waiting for FN-112…';
  const counts = row.linkCounts;
  return `${counts.trained_before} before · ${counts.not_trained} not trained · ${counts.repeat_after_training} repeat`;
}

function headerSync(state: QcLoadResult | { status: 'loading' }, summary: QcSummary | null): string {
  if (state.status === 'loading') return 'Last QC sync: checking…';
  if (state.status === 'not_synced') return 'Last QC sync: QC data not synced yet';
  if (state.status === 'denied') return 'Last QC sync: unavailable for this sign-in';
  if (state.status === 'error') return 'Last QC sync: could not be read';
  const when = summary?.syncedAt ?? summary?.generatedAt ?? null;
  return when ? `Last QC sync: ${formatQcStamp(when)}` : 'Last QC sync: time not recorded';
}

function QcStatusBanner({ state }: { state: QcLoadResult | { status: 'loading' } }) {
  if (state.status === 'loading' || state.status === 'ready') return null;
  if (state.status === 'not_synced') {
    return (
      <div className="alert-banner info">
        <span>ℹ️</span>
        <div>
          <strong>QC data not synced yet.</strong> Employee training profiles are still available — search by ID or name.
          Incidents appear here after the daily QC sync writes qc_meta/summary.
        </div>
      </div>
    );
  }
  if (state.status === 'denied') {
    return (
      <div className="alert-banner warning">
        <span>⚠️</span>
        <div>
          QC history stayed hidden. Firestore allows that read only for an admin or supervisor
          listed in auth_roles. Training profiles still open from search or Part Training.
        </div>
      </div>
    );
  }
  return (
    <div className="alert-banner warning">
      <span>⚠️</span>
      <div>{state.message}</div>
    </div>
  );
}

function FixtureBanner() {
  return (
    <div className="alert-banner info" style={{ marginBottom: 16 }}>
      <span>🧪</span>
      <div>Fixture data for review. Nothing was written to Firestore or Google Sheets.</div>
    </div>
  );
}
