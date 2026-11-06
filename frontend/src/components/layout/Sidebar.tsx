import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Receipt, Scale, Users, BarChart3,
  Settings, LogOut, Plus, Home,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom } from '../../contexts/RoomContext';
import Avatar from '../ui/Avatar';
import { showToast } from '../ui/Toast';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  leaderOnly?: boolean;
}

const ALL_NAV: NavItem[] = [
  { to: '/', icon: <LayoutDashboard size={18} />, label: 'Overview' },
  { to: '/expenses', icon: <Receipt size={18} />, label: 'Expenses' },
  { to: '/balances', icon: <Scale size={18} />, label: 'Balances' },
  { to: '/members', icon: <Users size={18} />, label: 'Members' },
  { to: '/reports', icon: <BarChart3 size={18} />, label: 'Reports', leaderOnly: true },
  { to: '/settings', icon: <Settings size={18} />, label: 'Room Settings', leaderOnly: true },
];

export default function Sidebar() {
  const { profile, signOut } = useAuth();
  const { activeRoom } = useRoom();
  const navigate = useNavigate();

  // Determine role — for now show all nav; in production derive from members API
  const isLeader = true; // resolved by checking members list on each page

  const navItems = ALL_NAV.filter(n => !n.leaderOnly || isLeader);

  const handleSignOut = async () => {
    await signOut();
    showToast('Signed out', 'info');
    navigate('/auth/login');
  };

  return (
    <aside
      style={{
        width: 220,
        minHeight: '100dvh',
        background: '#FFFDF7',
        borderRight: '2px solid #292524',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 12px',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        maxHeight: '100dvh',
        overflowY: 'auto',
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, paddingLeft: 4 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10, background: '#FFE66D',
            border: '2px solid #292524', boxShadow: '2px 2px 0 #292524',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', flexShrink: 0,
          }}
        >🏠</div>
        <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>RoomieSplit</span>
      </div>

      {/* Room indicator */}
      {activeRoom && (
        <div
          style={{
            background: '#F4F0E8', border: '1.5px solid #292524', borderRadius: 10,
            padding: '8px 12px', marginBottom: 20,
          }}
        >
          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B625B' }}>Active Room</p>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', marginTop: 2 }}>{activeRoom.name}</p>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            style={{ marginBottom: 4 }}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Add Expense quick action */}
      <button
        onClick={() => navigate('/expenses/new')}
        className="btn btn-primary w-full justify-center mb-4"
        style={{ marginTop: 16 }}
      >
        <Plus size={16} />
        Add Expense
      </button>

      {/* Profile */}
      {profile && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 8px', borderRadius: 10, borderTop: '1.5px solid #E8E4DC',
            marginTop: 8,
          }}
        >
          <Avatar name={profile.display_name} url={profile.avatar_url} size="sm" />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={{ fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile.display_name}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="btn btn-ghost btn-sm !min-h-0 !p-1"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      )}
    </aside>
  );
}
