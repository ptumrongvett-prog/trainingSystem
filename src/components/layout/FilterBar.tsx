import { useDataStore } from '../../hooks/useDataStore';
import { useMemo, useState, useRef, useEffect } from 'react';
import { getTopicName } from '../../lib/topicMap';

export default function FilterBar() {
  const { data, filters, setFilters, clearFilters } = useDataStore();
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');
  const topicRef = useRef<HTMLDivElement>(null);

  const departments = useMemo(() => [...new Set(data.employees.map(e => e.department).filter(Boolean))].sort(), [data.employees]);
  const divisions = useMemo(() => [...new Set(data.employees.map(e => e.division).filter(Boolean))].sort(), [data.employees]);
  const shifts = useMemo(() => [...new Set(data.employees.map(e => e.shift).filter(Boolean))].sort(), [data.employees]);
  const supervisors = useMemo(() => [...new Set(data.employees.map(e => e.supervisor).filter(Boolean))].sort(), [data.employees]);
  const topics = useMemo(() => [...new Set(data.assignments.map(a => a.TopicID).filter(Boolean))].sort(), [data.assignments]);

  const activeCount = [
    filters.department, filters.division, filters.shift,
    filters.supervisor, filters.status, filters.search,
  ].filter(v => v && v !== '').length + (filters.topic.length > 0 ? 1 : 0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (topicRef.current && !topicRef.current.contains(e.target as Node)) {
        setTopicOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleTopic = (topicId: string) => {
    const current = filters.topic;
    const updated = current.includes(topicId)
      ? current.filter(t => t !== topicId)
      : [...current, topicId];
    setFilters({ topic: updated });
  };

  return (
    <div className="filter-bar">
      <input
        className="filter-input"
        placeholder="🔍 Search employee name or ID..."
        value={filters.search}
        onChange={e => setFilters({ search: e.target.value })}
      />
      <select className="filter-select" value={filters.department} onChange={e => setFilters({ department: e.target.value })}>
        <option value="">All Departments</option>
        {departments.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <select className="filter-select" value={filters.division} onChange={e => setFilters({ division: e.target.value })}>
        <option value="">All Divisions</option>
        {divisions.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <select className="filter-select" value={filters.shift} onChange={e => setFilters({ shift: e.target.value })}>
        <option value="">All Shifts</option>
        {shifts.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select className="filter-select" value={filters.supervisor} onChange={e => setFilters({ supervisor: e.target.value })}>
        <option value="">All Supervisors</option>
        {supervisors.map(s => <option key={s} value={s}>{s.split('@')[0]}</option>)}
      </select>

      {/* Multi-select Topics */}
      <div ref={topicRef} style={{ position: 'relative' }}>
        <button
          className="filter-select"
          onClick={() => setTopicOpen(!topicOpen)}
          style={{
            cursor: 'pointer', textAlign: 'left', minWidth: 140,
            background: filters.topic.length > 0 ? 'rgba(0,212,170,0.15)' : undefined,
            borderColor: filters.topic.length > 0 ? 'var(--accent)' : undefined,
          }}
        >
          {filters.topic.length === 0
            ? 'All Topics'
            : `${filters.topic.length} Topic${filters.topic.length > 1 ? 's' : ''} ▾`}
        </button>
        {topicOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 100,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '6px 0',
            maxHeight: 300, overflowY: 'auto', minWidth: 200,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <button
              onClick={() => setFilters({ topic: [] })}
              style={{
                display: 'block', width: '100%', padding: '6px 12px',
                background: 'none', border: 'none', color: 'var(--accent)',
                fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left',
                borderBottom: '1px solid var(--border)',
              }}
            >
              ✕ Clear All
            </button>
            <input
              type="text"
              placeholder="🔍 Search topics..."
              value={topicSearch}
              onChange={e => setTopicSearch(e.target.value)}
              style={{
                width: 'calc(100% - 16px)', margin: '4px 8px', padding: '5px 8px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--text-primary)', fontSize: '0.78rem',
                outline: 'none',
              }}
            />
            {topics.filter(t => {
              if (!topicSearch) return true;
              const s = topicSearch.toLowerCase();
              return t.toLowerCase().includes(s) || getTopicName(t).toLowerCase().includes(s);
            }).map(t => (
              <label
                key={t}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 12px', cursor: 'pointer', fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  background: filters.topic.includes(t) ? 'rgba(0,212,170,0.08)' : 'transparent',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = filters.topic.includes(t) ? 'rgba(0,212,170,0.08)' : 'transparent')}
              >
                <input
                  type="checkbox"
                  checked={filters.topic.includes(t)}
                  onChange={() => toggleTopic(t)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                {t} — {getTopicName(t)}
              </label>
            ))}
          </div>
        )}
      </div>

      <select className="filter-select" value={filters.status} onChange={e => setFilters({ status: e.target.value })}>
        <option value="">All Statuses</option>
        <option value="Completed">Completed</option>
        <option value="Assigned">Assigned/Pending</option>
      </select>
      {activeCount > 0 && (
        <button className="filter-btn active-filters" onClick={clearFilters}>
          ✕ Clear ({activeCount})
        </button>
      )}
    </div>
  );
}
