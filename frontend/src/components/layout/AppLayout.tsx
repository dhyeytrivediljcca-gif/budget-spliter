import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

function LoadingScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: '#FFFDF7' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FFE66D', border: '2px solid #292524', boxShadow: '4px 4px 0 #292524', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>🏠</div>
        <p style={{ fontWeight: 700, color: '#6B625B' }}>Loading RoomieSplit…</p>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { session, profile, loading, profileLoading } = useAuth();
  const location = useLocation();

  if (loading || profileLoading) return <LoadingScreen />;

  if (!session) return <Navigate to="/auth/login" replace />;

  // If no profile and not already on onboarding, redirect to onboarding
  if (!profile && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      {/* Sidebar — desktop only */}
      <div className="hidden md:flex" style={{ flexShrink: 0 }}>
        <Sidebar />
      </div>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          paddingBottom: 80, // room for mobile bottom nav
        }}
        className="md:pb-0"
      >
        <Outlet />
      </main>

      {/* Bottom nav — mobile only */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
