import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Plus, ArrowRight, TrendingUp, TrendingDown, Minus,
  Wallet, Receipt, Scale, Users, Zap, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import { expensesApi, balancesApi, reportsApi } from '../api';
import type { Expense, MemberBalance, SettlementTransfer, CategoryStat } from '../types';
import { CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_EMOJIS } from '../types';
import Avatar from '../components/ui/Avatar';
import ProgressBar from '../components/ui/ProgressBar';
import { SkeletonCard } from '../components/ui/Skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function GreetingHeader({ name, roomName }: { name: string; roomName: string }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 className="heading-lg" style={{ marginBottom: 2 }}>{greeting}, {name.split(' ')[0]}! 👋</h1>
        <p style={{ color: '#6B625B', fontSize: '0.9rem' }}>
          {roomName} · {format(new Date(), 'MMMM yyyy')}
        </p>
      </div>
    </div>
  );
}

// ─── Budget Card ──────────────────────────────────────────────────────────────

function BudgetCard({ budget, spent }: { budget: number; spent: number }) {
  const remaining = budget - spent;
  const pct = budget > 0 ? (spent / budget) * 100 : 0;
  const isOver = pct > 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="nb-card nb-yellow"
      style={{ gridColumn: 'span 5' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Wallet size={18} />
        <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monthly Budget</span>
      </div>
      <div className="text-money-lg" style={{ marginBottom: 4 }}>{formatINR(budget)}</div>
      <ProgressBar value={pct} color={isOver ? '#EF4444' : '#292524'} label="Budget usage" />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <div>
          <p style={{ fontSize: '0.72rem', color: '#6B625B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spent</p>
          <p className="text-money" style={{ fontSize: '1rem' }}>{formatINR(spent)}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.72rem', color: isOver ? '#DC2626' : '#6B625B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isOver ? 'Over budget!' : 'Remaining'}
          </p>
          <p className="text-money" style={{ fontSize: '1rem', color: isOver ? '#DC2626' : 'inherit' }}>{formatINR(Math.abs(remaining))}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Net Balance Card ─────────────────────────────────────────────────────────

function NetBalanceCard({ balance }: { balance: MemberBalance | undefined }) {
  const net = balance?.net_balance ?? 0;
  const isPositive = net > 0;
  const isZero = net === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className={`nb-card ${isPositive ? 'nb-mint' : isZero ? 'nb-muted' : 'nb-peach'}`}
      style={{ gridColumn: 'span 4' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Scale size={18} />
        <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Balance</span>
      </div>
      <div className="text-money-lg" style={{ color: isPositive ? '#15803D' : isZero ? '#292524' : '#DC2626' }}>
        {isZero ? '₹0' : (isPositive ? '+' : '–') + formatINR(Math.abs(net)).replace('₹', '₹')}
      </div>
      <p style={{ fontSize: '0.8rem', color: '#6B625B', marginTop: 8, fontWeight: 500 }}>
        {isPositive ? `Others owe you ${formatINR(net)}` : isZero ? 'All settled up! 🎉' : `You owe ${formatINR(Math.abs(net))}`}
      </p>
    </motion.div>
  );
}

// ─── Category Chart Card ──────────────────────────────────────────────────────

function CategoryChartCard({ categories }: { categories: CategoryStat[] }) {
  const data = categories.slice(0, 6).map(c => ({
    name: CATEGORY_LABELS[c.category as keyof typeof CATEGORY_LABELS] || c.category,
    value: c.total,
    color: CATEGORY_COLORS[c.category as keyof typeof CATEGORY_COLORS] || '#C9D5FF',
    icon: CATEGORY_EMOJIS[c.category as keyof typeof CATEGORY_EMOJIS] || '📦',
  }));

  if (!data.length) {
    return (
      <div className="nb-card nb-periwinkle" style={{ gridColumn: 'span 4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <TrendingUp size={18} />
          <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Spending by Category</span>
        </div>
        <div className="empty-state" style={{ padding: '20px 0' }}>
          <span style={{ fontSize: '2rem' }}>📊</span>
          <p style={{ color: '#6B625B', fontSize: '0.85rem' }}>No expenses yet</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="nb-card nb-periwinkle"
      style={{ gridColumn: 'span 4' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <TrendingUp size={18} />
        <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Spending by Category</span>
      </div>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={60}
              innerRadius={35}
              strokeWidth={2}
              stroke="#292524"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(val: any) => [formatINR(Number(val) || 0), '']}
              contentStyle={{ border: '2px solid #292524', borderRadius: 8, fontSize: '0.8rem' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
        {data.slice(0, 3).map(d => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, border: '1.5px solid #292524', flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, flex: 1 }}>{d.icon} {d.name}</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{formatINR(d.value)}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Recent Expenses ──────────────────────────────────────────────────────────

function RecentExpensesCard({ expenses, navigate }: { expenses: Expense[]; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="nb-card"
      style={{ gridColumn: 'span 8' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Receipt size={18} />
          <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent Expenses</span>
        </div>
        <button onClick={() => navigate('/expenses')} className="btn btn-ghost btn-sm !min-h-0" style={{ gap: 4 }}>
          View all <ChevronRight size={14} />
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <span style={{ fontSize: '2.5rem' }}>🛒</span>
          <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>No expenses yet</p>
          <p style={{ color: '#6B625B', fontSize: '0.85rem' }}>Add your first shared expense to get started.</p>
          <button onClick={() => navigate('/expenses/new')} className="btn btn-primary" style={{ marginTop: 8 }}>
            <Plus size={15} /> Add Expense
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {expenses.map((exp, i) => (
            <motion.div
              key={exp.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid #E8E4DC',
                background: '#FFFDF7',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onClick={() => navigate(`/expenses/${exp.id}`)}
              onMouseEnter={e => (e.currentTarget.style.background = '#F4F0E8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FFFDF7')}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: CATEGORY_COLORS[exp.category as keyof typeof CATEGORY_COLORS] || '#F4F0E8',
                border: '1.5px solid #292524',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', flexShrink: 0,
              }}>
                {CATEGORY_EMOJIS[exp.category as keyof typeof CATEGORY_EMOJIS] || '📦'}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{exp.title}</p>
                <p style={{ fontSize: '0.75rem', color: '#6B625B', fontWeight: 500 }}>
                  Paid by {exp.payer?.display_name || exp.paid_by} · {format(new Date(exp.expense_date), 'MMM d')}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p className="text-money" style={{ fontSize: '0.95rem' }}>{formatINR(exp.amount)}</p>
                <p style={{ fontSize: '0.72rem', color: '#6B625B' }}>{exp.shares.length} people</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Settlement Card ──────────────────────────────────────────────────────────

function SettlementCard({ settlements, navigate }: { settlements: SettlementTransfer[]; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="nb-card nb-lavender"
      style={{ gridColumn: 'span 4' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Zap size={18} />
        <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Settlements</span>
      </div>

      {settlements.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: 6 }}>
          <span style={{ fontSize: '1.75rem' }}>✅</span>
          <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>All settled up!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {settlements.slice(0, 3).map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '8px 10px', border: '1.5px solid rgba(41,37,36,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                <span style={{ fontWeight: 700 }}>{s.from_display_name}</span>
                <ArrowRight size={12} />
                <span style={{ fontWeight: 700 }}>{s.to_display_name}</span>
              </div>
              <p className="text-money" style={{ fontSize: '0.95rem', marginTop: 2 }}>{formatINR(s.amount)}</p>
            </div>
          ))}
          <button onClick={() => navigate('/balances')} className="btn btn-secondary btn-sm w-full justify-center" style={{ marginTop: 4 }}>
            View all <ChevronRight size={13} />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActionsCard({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const actions = [
    { label: 'Add Expense', icon: <Plus size={18} />, to: '/expenses/new', color: '#FFE66D' },
    { label: 'View Balances', icon: <Scale size={18} />, to: '/balances', color: '#B8F2D0' },
    { label: 'Expense History', icon: <Receipt size={18} />, to: '/expenses', color: '#C9D5FF' },
    { label: 'Members', icon: <Users size={18} />, to: '/members', color: '#FFD6E7' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="nb-card"
      style={{ gridColumn: 'span 4' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Zap size={18} />
        <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Actions</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {actions.map(action => (
          <button
            key={action.label}
            onClick={() => navigate(action.to)}
            className="btn btn-secondary"
            style={{
              background: action.color, border: '1.5px solid #292524',
              boxShadow: '2px 2px 0 #292524', borderRadius: 10,
              padding: '12px 10px', flexDirection: 'column', gap: 6,
              alignItems: 'flex-start', fontWeight: 700, fontSize: '0.78rem',
              minHeight: 64,
            }}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── No Room State ────────────────────────────────────────────────────────────

function NoRoomState({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24, gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: '4rem' }}>🏠</div>
      <h2 className="heading-lg">No Room Yet</h2>
      <p style={{ color: '#6B625B', maxWidth: 360, fontSize: '0.95rem' }}>
        Create a new room to start tracking shared expenses with your roommates, or join an existing room with an invitation code.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => navigate('/onboarding')} className="btn btn-primary btn-lg">
          <Plus size={18} /> Create a Room
        </button>
        <button onClick={() => navigate('/onboarding?tab=join')} className="btn btn-secondary btn-lg">
          Join with Code
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { profile } = useAuth();
  const { activeRoom } = useRoom();
  const navigate = useNavigate();

  const currentMonth = format(new Date(), 'yyyy-MM');

  const { data: expenses, isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', activeRoom?.id, currentMonth],
    queryFn: () => expensesApi.list(activeRoom!.id, { month: currentMonth, limit: 5 }),
    enabled: !!activeRoom,
  });

  const { data: balanceSummary, isLoading: loadingBalances } = useQuery({
    queryKey: ['balances', activeRoom?.id, currentMonth],
    queryFn: () => balancesApi.get(activeRoom!.id, currentMonth),
    enabled: !!activeRoom,
  });

  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ['report', activeRoom?.id, currentMonth],
    queryFn: () => reportsApi.monthly(activeRoom!.id, currentMonth),
    enabled: !!activeRoom,
  });

  if (!activeRoom) return <NoRoomState navigate={navigate} />;

  const myBalance = balanceSummary?.members.find(m => m.user_id === profile?.id);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <GreetingHeader name={profile?.display_name || 'Friend'} roomName={activeRoom.name} />

      {/* Bento Grid */}
      <div
        className="bento-grid"
        style={{ padding: 20, paddingTop: 16 }}
      >
        {/* Row 1 */}
        {loadingReport ? (
          <>
            <div style={{ gridColumn: 'span 5' }}><SkeletonCard /></div>
            <div style={{ gridColumn: 'span 4' }}><SkeletonCard /></div>
            <div style={{ gridColumn: 'span 3' }}><SkeletonCard /></div>
          </>
        ) : (
          <>
            <BudgetCard
              budget={activeRoom.monthly_budget}
              spent={report?.total_spending ?? 0}
            />
            <NetBalanceCard balance={myBalance} />
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="nb-card nb-pink"
              style={{ gridColumn: 'span 3' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <TrendingUp size={18} />
                <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Room Spending</span>
              </div>
              <div className="text-money-lg">{formatINR(report?.total_spending ?? 0)}</div>
              <p style={{ fontSize: '0.8rem', color: '#6B625B', marginTop: 6, fontWeight: 500 }}>
                {report?.expense_count ?? 0} expense{(report?.expense_count ?? 0) !== 1 ? 's' : ''} this month
              </p>
            </motion.div>
          </>
        )}

        {/* Row 2 */}
        {loadingExpenses ? (
          <div style={{ gridColumn: 'span 8' }}><SkeletonCard /></div>
        ) : (
          <RecentExpensesCard expenses={expenses ?? []} navigate={navigate} />
        )}

        <CategoryChartCard categories={report?.categories ?? []} />

        {/* Row 3 */}
        <SettlementCard settlements={balanceSummary?.settlements ?? []} navigate={navigate} />
        <QuickActionsCard navigate={navigate} />
      </div>
    </div>
  );
}
