import { useState, useEffect } from 'react';
import { DataStoreProvider, useDataStore } from './hooks/useDataStore';
import Sidebar from './components/layout/Sidebar';
import FilterBar from './components/layout/FilterBar';
import OverviewPage from './components/overview/OverviewPage';
import TopicChart from './components/topics/TopicChart';
import TrainingMatrix from './components/matrix/TrainingMatrix';
import DepartmentBreakdown from './components/departments/DepartmentBreakdown';
import QuizAnalytics from './components/quiz/QuizAnalytics';
import SupervisorView from './components/supervisor/SupervisorView';
import AlertsCenter from './components/alerts/AlertsCenter';
import ComplianceHistory from './components/history/ComplianceHistory';
import AuditPage from './components/audit/AuditPage';
import ExecutiveKpiPage from './components/executive/ExecutiveKpiPage';
import DataQualityPage from './components/quality/DataQualityPage';
import ActionPlanPage from './components/actions/ActionPlanPage';
import TrainerApp from './components/trainer/TrainerApp';
import TrainingLogView from './components/trainer/TrainingLogView';
import PartTrainingPage from './components/partTraining/PartTrainingPage';
import EmptyState from './components/shared/EmptyState';
import LoginPage from './components/auth/LoginPage';
import { Role } from './types';
import type { AppSection } from './lib/roles';

function AppContent() {
  const [activeTab, setActiveTab] = useState<AppSection>('overview');
  const { loading, error, setRole, user } = useDataStore();

  // Auth state — persisted in localStorage
  const [authedRole, setAuthedRole] = useState<Role | null>(() => {
    const saved = localStorage.getItem('training_auth_role');
    return saved === 'admin' || saved === 'supervisor' ? (saved as Role) : null;
  });

  // Sync role to data store when authedRole changes
  useEffect(() => {
    if (authedRole) {
      setRole(authedRole);
    }
  }, [authedRole, setRole]);

  const handleLogin = (role: Role) => {
    setAuthedRole(role);
    localStorage.setItem('training_auth_role', role);
  };

  const handleLogout = () => {
    setAuthedRole(null);
    localStorage.removeItem('training_auth_role');
    setActiveTab('overview');
  };

  // Not logged in — show login page
  if (!authedRole) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewPage />;
      case 'topics':
        return <TopicChart />;
      case 'departments':
        return <DepartmentBreakdown />;
      case 'matrix':
        return <TrainingMatrix />;
      case 'supervisor':
        return <SupervisorView />;
      case 'quiz':
        return <QuizAnalytics />;
      case 'audit':
        return <ComplianceHistory />;
      case 'alerts':
        return <AlertsCenter />;
      case 'insights':
        return <AuditPage />;
      case 'quality':
        return <DataQualityPage />;
      case 'settings':
        return <ActionPlanPage />;
      case 'reports':
        return <ExecutiveKpiPage />;
      case 'fn135':
        return <TrainingLogView />;
      case 'partTraining':
        return <PartTrainingPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} />
      <main className="main-content">
        {error && (
          <div className="alert-banner warning" style={{ marginBottom: 16 }}>
            <span>⚠️</span>
            <div>{error}</div>
          </div>
        )}
        {activeTab !== 'partTraining' && <FilterBar />}
        {renderPage()}
      </main>
    </div>
  );
}

export default function App() {
  // Standalone /FN135 route — full-screen tablet form (no sidebar, no auth)
  if (window.location.pathname === '/FN135') {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <TrainerApp />
      </div>
    );
  }

  return (
    <DataStoreProvider>
      <AppContent />
    </DataStoreProvider>
  );
}
