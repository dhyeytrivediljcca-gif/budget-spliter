import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Receipt, Scale, Users, Plus } from 'lucide-react';

const NAV = [
  { to: '/', icon: <LayoutDashboard size={20} />, label: 'Overview' },
  { to: '/expenses', icon: <Receipt size={20} />, label: 'Expenses' },
  { to: '/balances', icon: <Scale size={20} />, label: 'Balances' },
  { to: '/members', icon: <Users size={20} />, label: 'Members' },
];

export default function BottomNav() {
  const navigate = useNavigate();

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      {NAV.slice(0, 2).map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}

      {/* Center action */}
      <button
        onClick={() => navigate('/expenses/new')}
        className="bottom-nav-item"
        style={{ flex: '0 0 60px' }}
        aria-label="Add expense"
      >
        <div style={{
          width: 42, height: 42, borderRadius: 14, background: '#FFE66D',
          border: '2px solid #292524', boxShadow: '2px 2px 0 #292524',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 2,
        }}>
          <Plus size={22} />
        </div>
      </button>

      {NAV.slice(2).map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
