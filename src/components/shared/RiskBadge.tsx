/**
 * RiskBadge.tsx — Reusable risk level indicator.
 * Additive only (Phase 5).
 */

const RISK_COLORS: Record<string, string> = {
  critical: 'var(--red)',
  high: '#f97316',
  medium: 'var(--amber)',
  low: 'var(--green)',
};

interface Props {
  level: 'low' | 'medium' | 'high' | 'critical';
  score?: number;
  compact?: boolean;
}

export default function RiskBadge({ level, score, compact }: Props) {
  const color = RISK_COLORS[level] || 'var(--text-muted)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: compact ? '1px 6px' : '2px 10px',
      borderRadius: 12, fontSize: compact ? '0.68rem' : '0.75rem', fontWeight: 600,
      background: `${color}18`, color,
      textTransform: 'uppercase',
    }}>
      <span style={{
        width: compact ? 6 : 8, height: compact ? 6 : 8,
        borderRadius: '50%', background: color,
        boxShadow: level === 'critical' ? `0 0 6px ${color}` : 'none',
      }} />
      {level}
      {score !== undefined && (
        <span style={{ fontWeight: 700, marginLeft: 2 }}>{score.toFixed(0)}</span>
      )}
    </span>
  );
}
