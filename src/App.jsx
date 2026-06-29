import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import CommandPalette from './components/CommandPalette';
import MobileModuleNav from './components/MobileModuleNav';
import LoginPage from './pages/LoginPage';
import ProjectListPage from './pages/ProjectListPage';
import CreateProjectPage from './pages/CreateProjectPage';
import ProjectViewPage from './pages/ProjectViewPage';
import PublicViewPage from './pages/PublicViewPage';
import UsersPage from './pages/UsersPage';
import ChangePasswordPage from './pages/ChangePasswordPage';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, userProfile, loading } = useAuth();
  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && userProfile?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

function AppLayout({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('osr_sidebar_collapsed') === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projectName, setProjectName] = useState('');

  const isPublic = location.pathname.startsWith('/p/');
  const isLogin = location.pathname === '/login';
  const projectMatch = location.pathname.match(/^\/projects\/(?!new$)([^/]+)$/);
  const isProjectView = !!projectMatch;
  const projectId = projectMatch ? projectMatch[1] : null;

  useEffect(() => {
    localStorage.setItem('osr_sidebar_collapsed', sidebarCollapsed);
  }, [sidebarCollapsed]);

  // Ctrl+K handler
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Reset tab when navigating away from project
  useEffect(() => {
    if (!isProjectView) {
      setActiveTab('dashboard');
      setProjectName('');
    }
  }, [location.pathname, isProjectView]);

  if (isPublic || isLogin || !user) {
    return children;
  }

  const showMobileNav = isMobile && isProjectView;

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''} ${showMobileNav ? 'has-mobile-nav' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        inProject={!!isProjectView}
      />
      <div className="app-main">
        <Topbar
          projectName={projectName}
          activeTab={isProjectView ? activeTab : null}
          onMenuToggle={() => setMobileOpen(!mobileOpen)}
          onSearchOpen={() => setCmdOpen(true)}
        />
        <div className="app-content">
          {/* Pass activeTab and setters to children via context-like prop injection */}
          {isProjectView ? (
            <ProjectViewPage
              projectId={projectId}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setProjectName={setProjectName}
            />
          ) : (
            children
          )}
        </div>
      </div>
      {showMobileNav && (
        <MobileModuleNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        inProject={isProjectView}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <AppLayout>
      <Routes>
        {/* Public share link */}
        <Route path="/p/:slug" element={<PublicViewPage />} />

        {/* Auth */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

        {/* Protected */}
        <Route path="/" element={<ProtectedRoute><ProjectListPage /></ProtectedRoute>} />
        <Route path="/projects/new" element={<ProtectedRoute adminOnly><CreateProjectPage /></ProtectedRoute>} />
        <Route path="/projects/:projectId" element={<ProtectedRoute><div /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
