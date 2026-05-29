import { useState, useEffect, useMemo } from 'react';
import { fetchEmployees } from '../../services/trainingSheets';

type LogEntry = Record<string, string>;

const SHEET_ID = '1lebYzX9dI7cs6L8yk43pwmvXGXSBIU359uqiePcO5BQ';

function parseCSV(csv: string): LogEntry[] {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const parseRow = (line: string): string[] => {
    const cells: string[] = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) { if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; } else if (ch === '"') inQ = false; else cur += ch; }
      else { if (ch === '"') inQ = true; else if (ch === ',') { cells.push(cur.trim()); cur = ''; } else if (ch !== '\r') cur += ch; }
    }
    cells.push(cur.trim());
    return cells;
  };
  const headers = parseRow(lines[0]);
  return lines.slice(1).map(line => {
    const cells = parseRow(line);
    const obj: LogEntry = {};
    headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
    return obj;
  });
}

export default function TrainingLogView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDoc, setFilterDoc] = useState('');

  useEffect(() => {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('FN-112_Training Log')}&range=A3:Q&_t=${Date.now()}`;
    fetch(url).then(r => r.text()).then(csv => {
      const parsed = parseCSV(csv).filter(r => r['Emp ID'] || r['Emp Name']);
      setLogs(parsed);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const docNumbers = useMemo(() => [...new Set(logs.map(l => l['Document#']).filter(Boolean))].sort(), [logs]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterDoc && l['Document#'] !== filterDoc) return false;
      if (search) {
        const q = search.toLowerCase();
        return Object.values(l).some(v => v.toLowerCase().includes(q));
      }
      return true;
    });
  }, [logs, search, filterDoc]);

  const S = {
    input: { padding: 10, background: 'rgba(255,255,255,0.04)', border: '1.5px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit' } as const,
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>⏳ Loading Training Log...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 2 }}>📋 FN-135 Training Records</h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{logs.length} total records</p>
        </div>
        <a href="/FN135" target="_blank" rel="noopener"
          style={{ padding: '10px 20px', background: 'var(--blue)', color: '#fff', borderRadius: 8,
            textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
          ➕ New Training
        </a>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...S.input, flex: 1, minWidth: 200 }} />
        <select value={filterDoc} onChange={e => setFilterDoc(e.target.value)}
          style={{ ...S.input, minWidth: 160 }}>
          <option value="">All Documents</option>
          {docNumbers.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Training Date', 'Emp ID', 'Emp Name', 'Document#', 'Part#', 'Description', 'Trainer Name', 'Shift', 'Process', 'Result'].map(h => (
                <th key={h} style={{ padding: '10px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((log, i) => {
              const result = (log['Result'] || '').toUpperCase();
              const isPass = result === 'PASS';
              const isFail = result === 'FAIL';
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{log['Training Date']}</td>
                  <td style={{ padding: '8px' }}>{log['Emp ID']}</td>
                  <td style={{ padding: '8px', fontWeight: 500 }}>{log['Emp Name']}</td>
                  <td style={{ padding: '8px', color: 'var(--blue)' }}>{log['Document#']}</td>
                  <td style={{ padding: '8px', fontSize: '0.75rem' }}>{log['Part#']}</td>
                  <td style={{ padding: '8px', fontSize: '0.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log['Description']}</td>
                  <td style={{ padding: '8px' }}>{log['Trainer Name']}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{log['Shift']}</td>
                  <td style={{ padding: '8px', fontSize: '0.75rem' }}>{log['Process']}</td>
                  <td style={{ padding: '8px' }}>
                    {result && <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600,
                      background: isPass ? 'rgba(34,197,94,0.15)' : isFail ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                      color: isPass ? 'var(--green)' : isFail ? 'var(--red)' : 'var(--text-muted)',
                    }}>{result}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No records found</div>}
        {filtered.length > 200 && <div style={{ textAlign: 'center', padding: 10, color: 'var(--text-muted)', fontSize: '0.78rem' }}>Showing first 200 of {filtered.length}</div>}
      </div>
    </div>
  );
}
