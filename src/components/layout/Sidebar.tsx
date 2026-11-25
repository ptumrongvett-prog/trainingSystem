import { useDataStore } from '../../hooks/useDataStore';
import { Role } from '../../types';
import { getAccessibleSections, ROLE_LABELS } from '../../lib/roles';
import type { AppSection } from '../../lib/roles';
import DataSourceToggle from '../shared/DataSourceToggle';

interface Props {
  activeTab: AppSection;
  onTabChange: (tab: AppSection) => void;
  onLogout: () => void;
}

const SECTION_META: Record<AppSection, { icon: string; label: string }> = {
  overview:    { icon: '📊', label: 'Overview' },
  topics:      { icon: '📈', label: 'Topics' },
  departments: { icon: '🏭', label: 'Departments' },
  matrix:      { icon: '👥', label: 'Matrix' },
  supervisor:  { icon: '👔', label: 'Supervisors' },
  fn135:       { icon: '📋', label: 'FN-135' },
  partTraining:{ icon: '🔩', label: 'Part Training' },
  employeeProfile: { icon: '👤', label: 'Employee Profile' },
  quiz:        { icon: '📝', label: 'Quiz' },
  audit:       { icon: '📋', label: 'History' },
  alerts:      { icon: '🔔', label: 'Alerts' },
  insights:    { icon: '💡', label: 'Data Audit' },
  quality:     { icon: '🔍', label: 'Data Quality' },
  settings:    { icon: '⚙️', label: 'Action Plans' },
  reports:     { icon: '🖨️', label: 'Reports' },
};

export default function Sidebar({ activeTab, onTabChange, onLogout }: Props) {
  const { user, alerts } = useDataStore();
  const role = user?.role || Role.SUPERVISOR;
  const sections = getAccessibleSections(role);
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const isAdmin = role === Role.ADMIN;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          Training<span> Compliance</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map(section => {
          const meta = SECTION_META[section];
          if (!meta) return null;
          return (
            <button
              key={section}
              className={`sidebar-item ${activeTab === section ? 'active' : ''}`}
              onClick={() => onTabChange(section)}
            >
              <span className="icon">{meta.icon}</span>
              <span className="sidebar-label">{meta.label}</span>
              {section === 'alerts' && criticalAlerts > 0 && (
                <span className="sidebar-badge">{criticalAlerts}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {/* Role badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          background: isAdmin ? 'rgba(168, 85, 247, 0.1)' : 'rgba(59, 130, 246, 0.1)',
          border: `1px solid ${isAdmin ? 'rgba(168, 85, 247, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`,
          borderRadius: 8,
          marginBottom: 8,
        }}>
          <span style={{ fontSize: '0.9rem' }}>{isAdmin ? '🛡️' : '👔'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: isAdmin ? '#c084fc' : '#60a5fa' }}>
              {ROLE_LABELS[role]}
            </div>
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={onLogout}
          style={{
            width: '100%',
            padding: '7px 10px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 6,
            color: '#f87171',
            fontSize: '0.78rem',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginBottom: 8,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; }}
        >
          🚪 Sign Out
        </button>

        {isAdmin && <DataSourceToggle />}
        <div className="sidebar-meta" style={{ marginTop: 8 }}>v1.0.0 — Ramko Training System</div>
      </div>
    </aside>
  );
}
