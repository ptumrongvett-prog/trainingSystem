import { useState, useEffect, useMemo } from 'react';
import { fetchEmployees, fetchActiveWI, fetchActiveQL, fetchActiveIC, fetchPartDescriptions, submitTrainingLog, setGasUrl } from '../../services/trainingSheets';

type WIDoc = Record<string, string>;
type QLDoc = Record<string, string>;
type ICDoc = Record<string, string>;
import SignaturePad from './SignaturePad';
import ChecklistForm from './ChecklistForm';
import { createEmptyResult, type EmpResult } from './fn135Data';

type Emp = Record<string, string>;
type Topic = Record<string, string>;
type Step = 'login' | 'results' | 'signatures' | 'review' | 'done';

const PROCESSES = [
  'Scanning', 'Machine Operator', 'Packaging', 'Assembly',
  'Documentation', 'Quality Alert', 'Work Instructions',
];

// Read GAS URL from env
const INITIAL_GAS = import.meta.env.VITE_TRAINING_GAS_URL || '';

function partMatchesDocString(targetPart: string, docString: string) {
  if (!targetPart || !docString) return false;
  if (targetPart === docString) return true;
  if (docString.includes(targetPart)) return true;

  const cleanDoc = docString.toUpperCase().trim();
  const cleanTarget = targetPart.toUpperCase().trim();

  const getBase = (s: string) => parseInt(s.match(/^\d+/)?.[0] || '0', 10);
  const targetBase = getBase(cleanTarget);

  if (cleanDoc.includes(' THRU ')) {
    const parts = cleanDoc.split(' THRU ');
    const startBase = getBase(parts[0]);
    const endBase = getBase(parts[1]);
    if (startBase > 0 && endBase > 0 && targetBase >= startBase && targetBase <= endBase) return true;
  }

  const slashMatch = cleanDoc.match(/^(\d+)\/(\d+)(.*)$/);
  if (slashMatch) {
    const startBaseStr = slashMatch[1];
    const startBase = parseInt(startBaseStr, 10);
    const endBaseStr = slashMatch[2];
    const prefixLen = startBaseStr.length - endBaseStr.length;
    const endBaseFull = prefixLen > 0 ? startBaseStr.substring(0, prefixLen) + endBaseStr : endBaseStr;
    const endBase = parseInt(endBaseFull, 10);
    if (startBase > 0 && endBase > 0 && targetBase >= startBase && targetBase <= endBase) return true;
  }

  if (cleanDoc.includes('*')) {
     const prefix = cleanDoc.split('*')[0].trim();
     if (cleanTarget.startsWith(prefix)) return true;
  }

  return false;
}

export default function TrainerApp() {
  const [step, setStep] = useState<Step>('login');
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [wiList, setWiList] = useState<WIDoc[]>([]);
  const [qlList, setQlList] = useState<QLDoc[]>([]);
  const [icList, setIcList] = useState<ICDoc[]>([]);
  const [masterParts, setMasterParts] = useState<{ part: string; desc: string }[]>([]);
  const [partNumber, setPartNumber] = useState('');
  const [loading, setLoading] = useState(true);

  // Selections
  const [trainer, setTrainer] = useState<Emp | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<Emp | null>(null);
  const [results, setResults] = useState<EmpResult[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);

  // Signatures
  const [trainerSig, setTrainerSig] = useState('');
  const [opSigs, setOpSigs] = useState<string[]>(['']);

  // Filters
  const [empSearch, setEmpSearch] = useState('');
  const [trainerSearch, setTrainerSearch] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [recordId, setRecordId] = useState('');

  useEffect(() => {
    if (INITIAL_GAS) setGasUrl(INITIAL_GAS);
    Promise.all([fetchEmployees(), fetchActiveWI(), fetchActiveQL(), fetchActiveIC(), fetchPartDescriptions()])
      .then(([e, w, q, ic, mp]) => { setEmployees(e); setWiList(w); setQlList(q); setIcList(ic); setMasterParts(mp); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, []);

  // Part number search
  const [partSearch, setPartSearch] = useState('');

  // Helper to extract and split part numbers
  const extractParts = (str: string | undefined) => {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
  };

  // All unique part numbers from WI + QL + IC + Master DB
  const allPartNumbers = useMemo(() => {
    const getPartsFromDoc = (doc: Record<string, string>) => {
      const keys = Object.keys(doc).filter(k => k.toLowerCase().includes('part number') || k.toLowerCase() === 'part#');
      return keys.flatMap(k => extractParts(doc[k]));
    };
    const wiParts = wiList.flatMap(getPartsFromDoc);
    const qlParts = qlList.flatMap(getPartsFromDoc);
    const icParts = icList.flatMap(getPartsFromDoc);
    const masterPartNums = masterParts.map(m => m.part);
    return [...new Set([...wiParts, ...qlParts, ...icParts, ...masterPartNums])].sort();
  }, [wiList, qlList, icList, masterParts]);

  // Matched part numbers based on search
  const matchedParts = useMemo(() => {
    if (!partSearch) return [];
    const q = partSearch.toLowerCase();
    return allPartNumbers.filter(p => p.toLowerCase().includes(q));
  }, [allPartNumbers, partSearch]);

  // Get description for a part from Master DB
  const getPartDescription = () => {
    if (!matchedParts.length) return '';
    const descs = matchedParts
      .map(p => masterParts.find(m => m.part === p)?.desc)
      .filter(Boolean);
    return [...new Set(descs)].join(', ');
  };

  // Combined document numbers from ALL matched parts
  const getMatchingDocs = () => {
    const targets = partNumber ? [partNumber] : matchedParts;
    if (!targets.length) return '';
    
    const isMatch = (doc: Record<string, string>) => {
      const keys = Object.keys(doc).filter(k => k.toLowerCase().includes('part number') || k.toLowerCase() === 'part#');
      const parts = keys.flatMap(k => extractParts(doc[k]));
      return targets.some(t => parts.some(p => partMatchesDocString(t, p)));
    };

    const matchWI = wiList.filter(isMatch).map(w => w['WI#']);
    const matchQL = qlList.filter(isMatch).map(q => q['Quality Alert #']);
    const matchIC = icList.filter(isMatch).map(ic => ic['IC#']);
    
    return [...new Set([...matchWI, ...matchQL, ...matchIC])].filter(Boolean).join(', ');
  };

  const goStep = (s: Step) => setStep(s);

  const startChecklist = () => {
    setResults([createEmptyResult()]);
    setOpSigs(['']);
    goStep('results');
  };

  const updateResult = (ri: number, r: EmpResult) => {
    setResults(prev => prev.map((old, i) => i === ri ? r : old));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const payload = {
      trainer: trainer!,
      topic: {
        type: 'FN135',
        documentNumber: getMatchingDocs(),
        description: getPartDescription() || 'Training Record',
        partNumber: partNumber,
      },
      processes: selectedProcesses,
      employees: [selectedEmp!],
      results: results.map(r => ({
        passed: r.checklist.every(c => c.passed === true),
        comments: JSON.stringify({ checklist: r.checklist, performance: r.performance }),
      })),
      trainerSignature: trainerSig,
      operatorSignatures: opSigs,
    };
    const res = await submitTrainingLog(payload);
    setSubmitting(false);
    if (res.success) {
      setRecordId(res.recordId || '');
      goStep('done');
    } else {
      alert('Error: ' + (res.error || 'Unknown error'));
    }
  };

  const resetApp = () => {
    setStep('login');
    setSelectedEmp(null);
    setResults([]);
    setSelectedProcesses([]);
    setTrainerSig('');
    setOpSigs(['']);
    setRecordId('');
    setPartNumber('');
    setPartSearch('');
    setEmpSearch('');
  };

  // =============== STYLES ===============
  const S = {
    card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 } as const,
    btn: { padding: '12px 24px', border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 48 } as const,
    input: { width: '100%', padding: 12, background: 'rgba(255,255,255,0.04)', border: '1.5px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.9rem', fontFamily: 'inherit', minHeight: 48, boxSizing: 'border-box' as const },
  };

  const isStandalone = window.location.pathname === '/FN135';
  const wrapStyle = isStandalone ? { maxWidth: 800, margin: '0 auto', padding: 24 } : {};

  if (loading) {
    return <div style={{ ...wrapStyle, textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>Loading training data...
    </div>;
  }

  // =============== STEP: LOGIN ===============
  if (step === 'login') {
    return <div style={{ maxWidth: 500, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', margin: '30px 0 20px' }}>
        <div style={{ fontSize: '2.5rem' }}>📋</div>
        <h1 style={{ fontSize: '1.4rem' }}>FN-135 Training Record</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ramko Injection — Digital Training Form</p>
      </div>
      <div style={S.card}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Select Trainer</label>
        <input placeholder="🔍 Search trainer..." value={trainerSearch} onChange={e => setTrainerSearch(e.target.value)}
          style={{ ...S.input, marginBottom: 6 }} />
        <select
          style={S.input}
          onChange={e => {
            const emp = employees.find(x => String(x.employee_number) === e.target.value);
            setTrainer(emp || null);
          }}
          value={trainer?.employee_number || ''}
        >
          <option value="">— Choose Trainer —</option>
          {employees
            .filter(e => {
              const dept = (e.department || '').toLowerCase();
              const isAllowed = dept.includes('trainer') || dept.includes('breaker') || dept.includes('operator');
              if (!isAllowed) return false;
              if (!trainerSearch) return true;
              const q = trainerSearch.toLowerCase();
              return `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) || String(e.employee_number || '').includes(q);
            })
            .map((e, i) => (
            <option key={i} value={e.employee_number}>#{e.employee_number} — {e.first_name} {e.last_name} — {e.department}</option>
          ))}
        </select>

        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6, marginTop: 16 }}>Part Number</label>
        <input placeholder="🔍 Search part number..." value={partSearch}
          onChange={e => { setPartSearch(e.target.value); setPartNumber(''); }}
          style={S.input} />

        {partSearch && !partNumber && (
          <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4 }}>
            {matchedParts.slice(0, 50).map(p => (
              <div key={p} 
                onClick={() => { setPartSearch(p); setPartNumber(p); }}
                style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{p}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {masterParts.find(m => m.part === p)?.desc || 'No description'}
                </span>
              </div>
            ))}
            {matchedParts.length === 0 && (
              <div 
                onClick={() => setPartNumber(partSearch)}
                style={{ padding: '10px 12px', cursor: 'pointer', color: 'var(--blue)' }}
              >
                + Use custom part "{partSearch}"
              </div>
            )}
            {matchedParts.length > 0 && !matchedParts.includes(partSearch) && (
              <div 
                onClick={() => setPartNumber(partSearch)}
                style={{ padding: '10px 12px', cursor: 'pointer', color: 'var(--blue)', borderTop: '1px solid var(--border)' }}
              >
                + Use exact text "{partSearch}"
              </div>
            )}
          </div>
        )}

        {partNumber && (
          <div style={{ marginTop: 8, padding: 12, background: 'rgba(59,130,246,0.06)', borderRadius: 8, fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                {getPartDescription() ? (
                  <div style={{ color: 'var(--text-primary)', marginBottom: 6, fontWeight: 600 }}>
                    📦 {getPartDescription()}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>
                    📦 No description available
                  </div>
                )}
                <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>📄 Related Documents:</div>
                <div style={{ color: 'var(--blue)', fontWeight: 500 }}>{getMatchingDocs() || 'None'}</div>
              </div>
              <button 
                onClick={() => setPartNumber('')} 
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Change
              </button>
            </div>
          </div>
        )}

        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6, marginTop: 16 }}>Select Employee</label>
        <input placeholder="🔍 Search employee..." value={empSearch} onChange={e => setEmpSearch(e.target.value)}
          style={{ ...S.input, marginBottom: 6 }} />
        <select
          style={S.input}
          value={selectedEmp?.employee_number || ''}
          onChange={e => {
            const emp = employees.find(x => String(x.employee_number) === e.target.value);
            setSelectedEmp(emp || null);
          }}
        >
          <option value="">— Choose Employee —</option>
          {employees
            .filter(e => {
              const dept = (e.department || '').toLowerCase();
              const isAllowed = dept.includes('operator') || dept.includes('breaker') || dept.includes('trainer');
              if (!isAllowed) return false;

              if (!empSearch) return true;
              const q = empSearch.toLowerCase();
              return `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) || String(e.employee_number || '').includes(q);
            })
            .map((e, i) => (
            <option key={i} value={e.employee_number}>#{e.employee_number} — {e.first_name} {e.last_name} — {e.department}</option>
          ))}
        </select>

        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 8, marginTop: 16 }}>Process (เลือกหัวข้อ)</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {PROCESSES.map(p => {
            const checked = selectedProcesses.includes(p);
            return <div key={p} onClick={() => setSelectedProcesses(prev =>
              checked ? prev.filter(x => x !== p) : [...prev, p]
            )} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
              borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem',
              background: checked ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1.5px solid ${checked ? 'var(--blue)' : 'var(--border)'}`,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                border: `2px solid ${checked ? 'var(--blue)' : 'var(--border)'}`,
                background: checked ? 'var(--blue)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '0.65rem', fontWeight: 700,
              }}>{checked ? '✓' : ''}</div>
              {p}
            </div>;
          })}
        </div>

        <button
          disabled={!trainer || !partNumber || !selectedEmp || !selectedProcesses.length}
          onClick={startChecklist}
          style={{ ...S.btn, width: '100%', marginTop: 16, background: 'var(--blue)', color: '#fff', opacity: (trainer && partNumber && selectedEmp && selectedProcesses.length) ? 1 : 0.4 }}
        >
          Continue →
        </button>
      </div>
    </div>;
  }

  // =============== STEP: RESULTS ===============
  if (step === 'results') {
    return <div>
      <h2 style={{ color: 'var(--blue)', marginBottom: 12 }}>✅ {selectedEmp?.first_name} {selectedEmp?.last_name}</h2>
      <div style={S.card}>
        <ChecklistForm
          empName={`${selectedEmp?.first_name} ${selectedEmp?.last_name}`}
          empId={selectedEmp?.employee_number || ''}
          result={results[0]}
          onChange={r => updateResult(0, r)}
        />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={() => goStep('login')} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>← Back</button>
        <button onClick={() => goStep('signatures')}
          style={{ ...S.btn, flex: 1, background: 'var(--blue)', color: '#fff' }}>Signatures →</button>
      </div>
    </div>;
  }

  // =============== STEP: SIGNATURES ===============
  if (step === 'signatures') {
    return <div>
      <h2 style={{ color: 'var(--blue)', marginBottom: 12 }}>✍️ Signatures</h2>
      <div style={S.card}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
          Trainer: {trainer?.first_name} {trainer?.last_name}
        </label>
        <SignaturePad canvasId="trainer_sig" onSignatureChange={setTrainerSig} />
      </div>
      <div style={S.card}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
          {selectedEmp?.first_name} {selectedEmp?.last_name} — Operator Signature
        </label>
        <SignaturePad canvasId="op_sig_0" onSignatureChange={sig => setOpSigs([sig])} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={() => goStep('results')} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>← Back</button>
        <button onClick={() => goStep('review')}
          style={{ ...S.btn, flex: 1, background: 'var(--blue)', color: '#fff' }}>Review →</button>
      </div>
    </div>;
  }

  // =============== STEP: REVIEW ===============
  if (step === 'review') {
    const Row = ({ label, value }: { label: string; value: string }) => (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span><span>{value}</span>
      </div>
    );
    const r = results[0];
    const passCount = r?.checklist.filter(c => c.passed === true).length || 0;
    const total = r?.checklist.length || 10;
    return <div>
      <h2 style={{ color: 'var(--blue)', marginBottom: 12 }}>📝 Review & Submit</h2>
      <div style={S.card}>
        <Row label="Trainer" value={`${trainer?.first_name} ${trainer?.last_name}`} />
        <Row label="Employee" value={`${selectedEmp?.first_name} ${selectedEmp?.last_name} (#${selectedEmp?.employee_number})`} />
        <Row label="Part#" value={partNumber} />
        <Row label="Documents" value={getMatchingDocs()} />
        <Row label="Process" value={selectedProcesses.join(', ')} />
        <Row label="Checklist" value={`${passCount}/${total} passed`} />
        <Row label="Trainer Sig" value={trainerSig ? '✅' : '❌'} />
        <Row label="Operator Sig" value={opSigs[0] ? '✅' : '❌'} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={() => goStep('signatures')} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>← Back</button>
        <button disabled={submitting} onClick={handleSubmit}
          style={{ ...S.btn, flex: 1, background: 'var(--green)', color: '#fff' }}>
          {submitting ? '⏳ Saving...' : '💾 Submit Training Record'}
        </button>
      </div>
    </div>;
  }

  // =============== STEP: DONE ===============
  if (step === 'done') {
    return <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
      <h1>Training Record Saved!</h1>
      <div style={{ fontSize: '0.85rem', color: 'var(--blue)', margin: '8px 0 24px', fontFamily: 'monospace' }}>{recordId}</div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{selectedEmp?.first_name} {selectedEmp?.last_name} recorded</p>
      <button onClick={resetApp} style={{ ...S.btn, background: 'var(--blue)', color: '#fff', width: '100%' }}>
        ➕ New Training Record
      </button>
    </div>;
  }

  return null;
}

