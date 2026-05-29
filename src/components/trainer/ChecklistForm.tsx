import { CHECKLIST_ITEMS, type EmpResult } from './fn135Data';

interface Props {
  empName: string;
  empId: string;
  result: EmpResult;
  onChange: (r: EmpResult) => void;
}

const S = {
  section: { marginBottom: 20 } as const,
  sectionTitle: { fontSize: '0.85rem', fontWeight: 700, color: 'var(--blue)', marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 6 } as const,
  row: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)' } as const,
  desc: { flex: 1, fontSize: '0.8rem', lineHeight: 1.4 } as const,
  pfBtn: (active: boolean, color: string) => ({
    padding: '6px 14px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
    border: `1.5px solid ${active ? `var(--${color})` : 'var(--border)'}`,
    background: active ? `var(--${color === 'green' ? 'green' : 'red'})22` : 'transparent',
    color: active ? `var(--${color})` : 'var(--text-muted)', fontFamily: 'inherit', minHeight: 36,
  }),
  select: { padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1.5px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.82rem', fontFamily: 'inherit' } as const,
  num: { width: 24, height: 24, borderRadius: '50%', background: 'var(--blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, marginTop: 2 } as const,
};

export default function ChecklistForm({ empName, empId, result, onChange }: Props) {
  const setChecklist = (idx: number, passed: boolean) => {
    const next = { ...result, checklist: result.checklist.map((c, i) => i === idx ? { ...c, passed } : c) };
    onChange(next);
  };

  const setFollowUp = (passed: boolean) => {
    onChange({ ...result, followUp: { ...result.followUp, passed } });
  };

  const setPerf = (key: string, val: string) => {
    onChange({ ...result, performance: { ...result.performance, [key]: val } });
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700 }}>{empName}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>#{empId}</div>
      </div>

      {/* Initial Results */}
      <div style={S.section}>
        <div style={S.sectionTitle}>📝 Initial Results</div>
        {CHECKLIST_ITEMS.map((item, i) => (
          <div key={i} style={S.row}>
            <div style={S.num}>{i + 1}</div>
            <div style={S.desc}>{item}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={S.pfBtn(result.checklist[i].passed === true, 'green')} onClick={() => setChecklist(i, true)}>✅</button>
              <button style={S.pfBtn(result.checklist[i].passed === false, 'red')} onClick={() => setChecklist(i, false)}>❌</button>
            </div>
          </div>
        ))}
      </div>

      {/* 4-Hour Observational Follow-Up */}
      <div style={S.section}>
        <div style={S.sectionTitle}>⏰ 4-Hour Observational Follow-Up</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
          Re-evaluate the trainee after 4 hours of working independently
        </div>
        {CHECKLIST_ITEMS.map((item, i) => (
          <div key={i} style={S.row}>
            <div style={{ ...S.num, background: 'var(--green)' }}>{i + 1}</div>
            <div style={S.desc}>{item}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={S.pfBtn(result.followUp.checklist?.[i]?.passed === true, 'green')} onClick={() => {
                const checklist = [...(result.followUp.checklist || CHECKLIST_ITEMS.map(() => ({ passed: null as boolean | null, notes: '' })))];
                checklist[i] = { ...checklist[i], passed: true };
                onChange({ ...result, followUp: { ...result.followUp, checklist } });
              }}>✅</button>
              <button style={S.pfBtn(result.followUp.checklist?.[i]?.passed === false, 'red')} onClick={() => {
                const checklist = [...(result.followUp.checklist || CHECKLIST_ITEMS.map(() => ({ passed: null as boolean | null, notes: '' })))];
                checklist[i] = { ...checklist[i], passed: false };
                onChange({ ...result, followUp: { ...result.followUp, checklist } });
              }}>❌</button>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Monitoring */}
      <div style={S.section}>
        <div style={S.sectionTitle}>📊 Performance Monitoring</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Overall Attitude</label>
            <select style={S.select} value={result.performance.attitude} onChange={e => setPerf('attitude', e.target.value)}>
              <option value="">—</option><option>Good</option><option>Fair</option><option>Poor</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Teachable</label>
            <select style={S.select} value={result.performance.teachable} onChange={e => setPerf('teachable', e.target.value)}>
              <option value="">—</option><option>Yes</option><option>No</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Competent</label>
            <select style={S.select} value={result.performance.competent} onChange={e => setPerf('competent', e.target.value)}>
              <option value="">—</option><option>Yes</option><option>No</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>5S</label>
            <select style={S.select} value={result.performance.fiveS} onChange={e => setPerf('fiveS', e.target.value)}>
              <option value="">—</option><option>Good</option><option>Fair</option><option>Poor</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Primary Language</label>
            <select style={S.select} value={result.performance.language} onChange={e => setPerf('language', e.target.value)}>
              <option value="">—</option><option>English</option><option>Spanish</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
