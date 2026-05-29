export default function LoadingSkeleton({ type = 'cards' }: { type?: 'cards' | 'table' | 'chart' }) {
  if (type === 'cards') {
    return (
      <div className="kpi-grid">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
    );
  }
  if (type === 'chart') {
    return <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius)' }} />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton skeleton-text" style={{ width: `${60 + Math.random() * 40}%` }} />
      ))}
    </div>
  );
}
