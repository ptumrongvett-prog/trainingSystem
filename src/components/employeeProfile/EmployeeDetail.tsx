import type { Fn135Submission } from '../../lib/fn135Records';
import type { EmployeeProfileModel } from '../../lib/employeeProfile';
import type { QcSummary, QcStatus } from '../../lib/qcContract';
import { formatQcStamp } from '../../lib/qcContract';
import type { QcLoadResult } from '../../services/qcHistory';
import { formatTrainingDate } from '../../lib/partTraining';
import type { TrainingLink } from '../../lib/trainingEffectiveness';
import StatusBadge from '../shared/StatusBadge';

interface Props {
  profile: EmployeeProfileModel;
  fn135: Fn135Submission[];
  fn135Status: 'loading' | 'ready' | 'error';
  trainingStatus: 'loading' | 'ready' | 'error';
  trainingError: string | null;
  qcState: QcLoadResult | { status: 'loading' };
  showFlags: boolean;
  onBack: () => void;
}

const FLAG_ORDER: TrainingLink[] = ['trained_before', 'not_trained', 'repeat_after_training'];

export default function EmployeeDetail({
  profile, fn135, fn135Status, trainingStatus, trainingError, qcState, showFlags, onBack,
}: Props) {
  const summary = qcState.status === 'ready' ? qcState.summary : null;
  const timeline = [...profile.incidents].sort((a, b) => {
    const aTime = a.incident.createdAt?.getTime() ?? 0;
    const bTime = b.incident.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return (
    <div>
      <button type="button" className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 16 }}>
        ← All employees
      </button>

      <section className="card ep-hero">
        <div>
          <div className="ep-kicker">Employee profile</div>
          <h1>{profile.employeeName || 'Unnamed employee'}</h1>
          <div className="ep-id">Emp ID {profile.empId}</div>
        </div>
        <div className="ep-pills">
          <span className={`status-badge ${profile.active ? 'completed' : 'inactive'}`}>
            {profile.active ? 'Active' : 'Not active'}
          </span>
          {profile.department && <span className="ep-pill">{profile.department}</span>}
          {profile.shift && <span className="ep-pill">{profile.shift} shift</span>}
          {profile.division && <span className="ep-pill">{profile.division}</span>}
          {profile.supervisor && <span className="ep-pill">{profile.supervisor}</span>}
        </div>
        <p className="ep-sync">{syncLine(summary, qcState.status)}</p>
      </section>

      <section className="ep-insight" aria-label="Training effectiveness">
        <div className="ep-kicker">Key insight · competence and corrective action</div>
        <h2>Each QC incident checked against FN-112 part training</h2>
        <p>
          IATF 16949 / ISO 9001 clause 7.2 asks whether this person was trained on the part before the job.
          Clause 10.2 asks whether a problem that returns after that training still needs corrective action.
          Training counts only when the first FN-112 date for the part is before the incident date.
        </p>
        {showFlags ? (
          <div className="ep-flag-grid">
            {FLAG_ORDER.map(link => (
              <div key={link} className={`ep-flag ${flagClass(link)}`}>
                <div className="ep-flag-value">{profile.linkCounts[link]}</div>
                <div className="ep-flag-label">{flagLabel(link)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="ep-note">
            {trainingStatus === 'error'
              ? 'FN-112 part training did not load, so these flags are hidden rather than guessed.'
              : 'FN-112 part training is still loading, so these flags are hidden rather than guessed.'}
          </p>
        )}
      </section>

      <div className="ep-grid">
        <section className="card">
          <h3>Training received</h3>
          <h4>FN-112 parts</h4>
          {trainingStatus === 'loading' && <p className="ep-note">Reading the FN-112 training log…</p>}
          {trainingStatus === 'error' && (
            <p className="ep-note">{trainingError || 'Part training could not be loaded.'}</p>
          )}
          {trainingStatus === 'ready' && profile.parts.length === 0 && (
            <p className="ep-note">No FN-112 part training for this employee.</p>
          )}
          {trainingStatus === 'ready' && profile.parts.length > 0 && (
            <div className="ep-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Part #</th>
                    <th>Entries</th>
                    <th>First</th>
                    <th>Latest</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.parts.map(part => (
                    <tr key={part.partNumber}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{part.partNumber}</td>
                      <td>{part.entryCount.toLocaleString()}</td>
                      <td>{formatTrainingDate(part.firstDate)}</td>
                      <td>{formatTrainingDate(part.latestDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h4>Topic assignments</h4>
          {!profile.directoryFound && (
            <p className="ep-note">
              This ID is not in the assignment directory, so topic assignments cannot be matched.
            </p>
          )}
          {profile.directoryFound && profile.topics.length === 0 && (
            <p className="ep-note">No topic assignments for this employee.</p>
          )}
          {profile.topics.length > 0 && (
            <div className="ep-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.topics.map(topic => (
                    <tr key={topic.assignmentId}>
                      <td>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{topic.topicName}</div>
                        <div style={{ fontSize: '0.72rem' }}>{topic.topicId}</div>
                      </td>
                      <td><StatusBadge status={topic.status} /></td>
                      <td>{topic.dateAssigned || '—'}</td>
                      <td>{topic.dueDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h4>FN-135 submissions</h4>
          {fn135Status === 'loading' && <p className="ep-note">Reading FN-135 submissions…</p>}
          {fn135Status === 'error' && <p className="ep-note">FN-135 submissions could not be loaded.</p>}
          {fn135Status === 'ready' && fn135.length === 0 && (
            <p className="ep-note">No FN-135 form submissions for this employee.</p>
          )}
          {fn135Status === 'ready' && fn135.length > 0 && (
            <ul className="ep-fn135">
              {fn135.map(row => (
                <li key={row.recordId || `${row.documentNumber}-${row.partNumber}`}>
                  <div>
                    <strong>{row.documentNumber || 'FN-135'}</strong>
                    <span>{row.partNumber || 'No part'}</span>
                  </div>
                  <div className="ep-fn135-meta">
                    {row.passed == null ? 'Result not recorded' : row.passed ? 'Pass' : 'Fail'}
                    {' · '}
                    {row.trainerName || 'Trainer not recorded'}
                    {' · '}
                    {formatQcStamp(row.createdAt)}
                  </div>
                  {row.comments && <p>{row.comments}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3>QC problems</h3>
          <QcBody profile={profile} qcState={qcState} />
        </section>
      </div>

      <section className="card ep-block" style={{ marginTop: 16 }}>
        <h3>Incident timeline</h3>
        {qcState.status === 'loading' && <p className="ep-note">Reading QC history…</p>}
        {qcState.status !== 'loading' && timeline.length === 0 && (
          <p className="ep-note">No QC incidents to show for this employee.</p>
        )}
        <div className="ep-timeline">
          {timeline.map((item, index) => {
            const linkClass = flagClass(item.link.link);
            return (
              <article key={`${item.incident.incidentCode}-${index}`} className={`ep-incident ${linkClass}`}>
                <header>
                  <div>
                    <strong>{item.incident.incidentCode || 'Incident'}</strong>
                    <span>{formatQcStamp(item.incident.createdAt)}</span>
                  </div>
                  <span className={`status-badge ${qcStatusClass(item.incident.status)}`}>
                    {qcStatusLabel(item.incident.status)}
                  </span>
                </header>
                <p className="ep-problem">{item.incident.problem || 'No problem text.'}</p>
                <p className="ep-meta-line">
                  {[
                    item.incident.partNumber && `Part ${item.incident.partNumber}`,
                    item.incident.partDescription,
                    item.incident.jobNumber && `Job ${item.incident.jobNumber}`,
                    item.incident.machine,
                    item.incident.shiftName && `${item.incident.shiftName} shift`,
                  ].filter(Boolean).join(' · ') || 'Part not recorded'}
                </p>
                {item.incident.categories.length > 0 && (
                  <p className="ep-meta-line">{item.incident.categories.join(' · ')}</p>
                )}
                {showFlags && (
                  <div className="ep-link-block">
                    <span className={`ep-chip ${linkClass}`}>{item.link.label}</span>
                    <p>{item.link.detail}</p>
                  </div>
                )}
                <div className="ep-action">
                  <div className="ep-kicker">Latest Lead Trainer action</div>
                  {item.incident.latestAction ? (
                    <>
                      <p>“{item.incident.latestAction.text || 'Action recorded without text.'}”</p>
                      <p className="ep-meta-line">
                        {[item.incident.latestAction.by, formatQcStamp(item.incident.latestAction.at)].filter(Boolean).join(' · ')}
                        {` · ${item.incident.actionCount} action${item.incident.actionCount === 1 ? '' : 's'}`}
                        {` · ${item.incident.mediaCount} photo${item.incident.mediaCount === 1 ? '' : 's'}`}
                      </p>
                    </>
                  ) : (
                    <p className="ep-note">No Lead Trainer action recorded.</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function QcBody({ profile, qcState }: { profile: EmployeeProfileModel; qcState: Props['qcState'] }) {
  if (qcState.status === 'loading') return <p className="ep-note">Reading QC history…</p>;
  if (qcState.status === 'not_synced') {
    return (
      <div className="empty-state" style={{ padding: '24px 8px' }}>
        <h3>QC data not synced yet</h3>
        <p>The daily sync has not created this employee’s QC history. Training above is still available.</p>
      </div>
    );
  }
  if (qcState.status === 'denied') {
    return (
      <div className="empty-state" style={{ padding: '24px 8px' }}>
        <h3>QC history isn’t available in this session</h3>
        <p>
          Reading QC records requires a signed-in Firebase user. This dashboard still uses the local role sign-in,
          so the browser cannot read the QC collection yet.
        </p>
      </div>
    );
  }
  if (qcState.status === 'error') {
    return <p className="ep-note">{qcState.message}</p>;
  }
  if (!profile.qc) {
    return <p className="ep-note">No QC incidents on file for this employee.</p>;
  }

  const qc = profile.qc;
  const maxCategory = Math.max(1, ...qc.categories.map(category => category.count));

  return (
    <>
      <div className="ep-mini-kpis">
        <div>
          <span>Incidents</span>
          <strong>{qc.incidentCount}</strong>
        </div>
        <div>
          <span>Open</span>
          <strong className="amber">{qc.openCount}</strong>
        </div>
        <div>
          <span>Resolved</span>
          <strong className="green">{qc.resolvedCount}</strong>
        </div>
      </div>

      <h4>Categories</h4>
      {qc.categories.length === 0 && <p className="ep-note">No categories recorded.</p>}
      <div className="ep-bars">
        {qc.categories.map(category => (
          <div key={category.category} className="ep-bar-row">
            <span>{category.category}</span>
            <div className="ep-bar-track">
              <div className="ep-bar-fill" style={{ width: `${(category.count / maxCategory) * 100}%` }} />
            </div>
            <strong>{category.count}</strong>
          </div>
        ))}
      </div>

      <h4>Parts involved</h4>
      {qc.parts.length === 0 && <p className="ep-note">No parts recorded.</p>}
      {qc.parts.length > 0 && (
        <ul className="ep-part-list">
          {qc.parts.map(part => (
            <li key={part.partNumber}>
              <div>
                <strong>{part.partNumber}</strong>
                <div className="ep-meta-line">{part.partDescription || 'No description'}</div>
              </div>
              <strong>{part.count}</strong>
            </li>
          ))}
        </ul>
      )}

      <h4>Repeated problem on the same part</h4>
      {qc.repeatedPatterns.length === 0 && <p className="ep-note">No repeated QC pattern recorded.</p>}
      {qc.repeatedPatterns.length > 0 && (
        <ul className="ep-repeat-list">
          {qc.repeatedPatterns.map(pattern => (
            <li key={`${pattern.partNumber}-${pattern.category}`}>
              <div>
                <strong>{pattern.partNumber || 'Part not recorded'}</strong>
                <div className="ep-meta-line">{pattern.category || 'Uncategorized'}</div>
              </div>
              <em>{pattern.count} times</em>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function syncLine(summary: QcSummary | null, status: Props['qcState']['status']): string {
  if (status === 'loading') return 'Last QC sync: checking…';
  if (status === 'not_synced') return 'Last QC sync: QC data not synced yet';
  if (status === 'denied') return 'Last QC sync: unavailable for this sign-in';
  if (status === 'error') return 'Last QC sync: could not be read';
  const when = summary?.syncedAt ?? summary?.generatedAt ?? null;
  if (!when) return 'Last QC sync: time not recorded';
  const health = summary?.lastRunOk === false ? ' · last run reported a problem' : '';
  return `Last QC sync: ${formatQcStamp(when)}${health}`;
}

function flagLabel(link: TrainingLink): string {
  if (link === 'trained_before') return 'Trained before incident';
  if (link === 'repeat_after_training') return 'Repeat after training';
  return 'Not trained on this part';
}

function flagClass(link: TrainingLink): string {
  if (link === 'trained_before') return 'trained';
  if (link === 'repeat_after_training') return 'repeat';
  return 'untrained';
}

function qcStatusLabel(status: QcStatus): string {
  if (status === 'IN_PROGRESS') return 'In progress';
  if (status === 'RESOLVED') return 'Resolved';
  if (status === 'OPEN') return 'Open';
  return 'Unknown';
}

function qcStatusClass(status: QcStatus): string {
  if (status === 'RESOLVED') return 'completed';
  if (status === 'OPEN') return 'overdue';
  if (status === 'IN_PROGRESS') return 'pending';
  return 'inactive';
}
