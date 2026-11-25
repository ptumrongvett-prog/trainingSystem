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
import EmployeeProfilePage from './components/employeeProfile/EmployeeProfilePage';
import LoginPage, { AuthChecking } from './components/auth/LoginPage';
import { isEmployeeProfileFixture } from './data/employeeProfileFixture';
import { useDashboardAuth } from './hooks/useDashboardAuth';
import { MESSAGES, dashboardRequiresSignIn } from './lib/authAccess';
import { currentAuthFixture } from './lib/authFixture';
import { createLocalUser } from './lib/permissions';
import type { AppSection } from './lib/roles';
import { Role } from './types';

function initialProfileFocus(): { id: string | null; token: number } {
  if (!import.meta.env.DEV) return { id: null, token: 0 };
  const params = new URLSearchParams(window.location.search);
  if (params.get('fixture') !== 'employee-profile') return { id: null, token: 0 };
  return { id: params.get('profile'), token: 0 };
}

function fixtureEmail(role: Role): string {
  return role === Role.ADMIN ? 'fixture-admin@example.com' : 'fixture-supervisor@example.com';
}

function AppContent() {
  const openedOnProfile = import.meta.env.DEV && isEmployeeProfileFixture();
  const [fixtureDismissed, setFixtureDismissed] = useState(false);
  const authFixture = import.meta.env.DEV && !fixtureDismissed ? currentAuthFixture() : null;
  const [profileHold, setProfileHold] = useState(() => import.meta.env.DEV && isEmployeeProfileFixture());
  const pauseFirebase = authFixture != null || profileHold;
  const auth = useDashboardAuth(!pauseFirebase);
  const [activeTab, setActiveTab] = useState<AppSection>(openedOnProfile ? 'employeeProfile' : 'overview');
  const [profileFocus, setProfileFocus] = useState(initialProfileFocus);
  const { error, setAuthUser } = useDataStore();

  const fixtureRole: Role | null = profileHold
    ? Role.SUPERVISOR
    : authFixture === 'admin'
      ? Role.ADMIN
      : authFixture === 'supervisor'
        ? Role.SUPERVISOR
        : null;

  useEffect(() => {
    if (fixtureRole) {
      setAuthUser(createLocalUser(fixtureRole, fixtureEmail(fixtureRole)));
      return;
    }
    setAuthUser(auth.user);
  }, [fixtureRole, auth.user, setAuthUser]);

  const handleLogout = () => {
    setFixtureDismissed(true);
    setProfileHold(false);
    setActiveTab('overview');
    if (import.meta.env.DEV) {
      const url = new URL(window.location.href);
      url.searchParams.delete('fixture');
      url.searchParams.delete('screen');
      url.searchParams.delete('profile');
      const query = url.searchParams.toString();
      window.history.replaceState({}, '', url.pathname + (query ? `?${query}` : ''));
    }
    void auth.signOut();
  };

  const openProfile = (empId: string) => {
    setProfileFocus(prev => ({ id: empId, token: prev.token + 1 }));
    setActiveTab('employeeProfile');
  };

  const handleTab = (tab: AppSection) => {
    if (tab === 'employeeProfile') {
      setProfileFocus(prev => ({ id: null, token: prev.token + 1 }));
    }
    setActiveTab(tab);
  };

  const sessionUser = fixtureRole
    ? createLocalUser(fixtureRole, fixtureEmail(fixtureRole))
    : auth.user;

  if (!sessionUser) {
    if (!pauseFirebase && auth.phase === 'checking') {
      return <AuthChecking label="Checking your session…" />;
    }
    const fixtureError = authFixture === 'error'
      ? MESSAGES.wrongCredentials
      : authFixture === 'denied'
        ? MESSAGES.missingRole
        : null;
    return (
      <LoginPage
        error={fixtureError ?? auth.error}
        busy={!authFixture && auth.submitting}
        notice={authFixture ? 'Dev preview. This screen does not contact Firebase.' : null}
        onSignIn={authFixture ? async () => undefined : auth.signIn}
      />
    );
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
        return <PartTrainingPage onOpenProfile={openProfile} />;
      case 'employeeProfile':
        return <EmployeeProfilePage key={profileFocus.token} focusEmpId={profileFocus.id} />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTab}
        onLogout={handleLogout}
        role={sessionUser.role}
        email={sessionUser.email}
      />
      <main className="main-content">
        {authFixture === 'supervisor' || authFixture === 'admin' ? (
          <div className="alert-banner info" style={{ marginBottom: 16 }}>
            <span>🧪</span>
            <div>Dev preview of the {sessionUser.role} menu. No Firebase session was created.</div>
          </div>
        ) : null}
        {error && (
          <div className="alert-banner warning" style={{ marginBottom: 16 }}>
            <span>⚠️</span>
            <div>{error}</div>
          </div>
        )}
        {activeTab !== 'partTraining' && activeTab !== 'employeeProfile' && <FilterBar />}
        {renderPage()}
      </main>
    </div>
  );
}

export default function App() {
  // Standalone /FN135 route — full-screen tablet form (no sidebar, no Firebase sign-in)
  if (!dashboardRequiresSignIn(window.location.pathname)) {
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
