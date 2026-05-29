import { useDataStore } from '../../hooks/useDataStore';
import type { DataSourceType } from '../../types';

export default function DataSourceToggle() {
  const { dataSource, setDataSource, meta, lastUpdated, refreshData } = useDataStore();

  const sources: { value: DataSourceType; label: string }[] = [
    { value: 'sample', label: 'Sample' },
    { value: 'appsheet', label: 'AppSheet' },
    { value: 'google', label: 'Sheets' },
    { value: 'auto', label: 'Auto' },
  ];

  const isLive = meta.source === 'appsheet' || meta.source === 'google';

  return (
    <div className="ds-toggle">
      <div className={`dot ${isLive ? 'live' : 'sample'}`} />
      <select
        value={dataSource}
        onChange={e => setDataSource(e.target.value as DataSourceType)}
        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'var(--font)', cursor: 'pointer' }}
      >
        {sources.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <button className="btn btn-secondary" onClick={refreshData} style={{ padding: '4px 8px', fontSize: '0.75rem' }} title="Refresh data">
        🔄
      </button>
      {lastUpdated && (
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {lastUpdated.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
