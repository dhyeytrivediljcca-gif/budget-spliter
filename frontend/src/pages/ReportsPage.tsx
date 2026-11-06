import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format, subMonths } from 'date-fns';
import {
  BarChart3, Download, TrendingUp, Wallet, ArrowDownRight,
  PieChart as PieIcon, Calendar, ArrowUpRight, DollarSign, Loader2
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { useRoom } from '../contexts/RoomContext';
import { reportsApi, expensesApi, roomsApi } from '../api';
import { CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_EMOJIS } from '../types';
import ProgressBar from '../components/ui/ProgressBar';
import { showToast } from '../components/ui/Toast';

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function ReportsPage() {
  const { activeRoom } = useRoom();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Generate last 6 months options
  const monthOptions = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(new Date(), i);
    return {
      value: format(d, 'yyyy-MM'),
      label: format(d, 'MMMM yyyy'),
    };
  });

  const { data: report, isLoading: loadingReport } = useQuery({
    queryKey: ['report', activeRoom?.id, selectedMonth],
    queryFn: () => reportsApi.monthly(activeRoom!.id, selectedMonth),
    enabled: !!activeRoom,
  });

  const { data: members } = useQuery({
    queryKey: ['members', activeRoom?.id],
    queryFn: () => roomsApi.getMembers(activeRoom!.id),
    enabled: !!activeRoom,
  });

  const { data: expenses } = useQuery({
    queryKey: ['expenses-report', activeRoom?.id, selectedMonth],
    queryFn: () => expensesApi.list(activeRoom!.id, { month: selectedMonth }),
    enabled: !!activeRoom,
  });

  const totalSpending = report?.total_spending ?? 0;
  const budget = activeRoom?.monthly_budget ?? 0;
  const budgetPct = budget > 0 ? (totalSpending / budget) * 100 : 0;
  const memberCount = members?.length || 1;
  const perPersonAvg = totalSpending / memberCount;

  // Pie chart data
  const categoryData = (report?.categories ?? []).map(cat => ({
    name: CATEGORY_LABELS[cat.category as keyof typeof CATEGORY_LABELS] || cat.category,
    value: cat.total,
    color: CATEGORY_COLORS[cat.category as keyof typeof CATEGORY_COLORS] || '#C9D5FF',
    count: cat.count,
    emoji: CATEGORY_EMOJIS[cat.category as keyof typeof CATEGORY_EMOJIS] || '📦',
  }));

  // Member spend bar chart data
  const memberSpendMap: Record<string, number> = {};
  expenses?.forEach(exp => {
    const payerName = exp.payer?.display_name || 'Roommate';
    memberSpendMap[payerName] = (memberSpendMap[payerName] || 0) + exp.amount;
  });

  const memberChartData = Object.entries(memberSpendMap).map(([name, amount]) => ({
    name,
    amount,
  }));

  // CSV Export
  const handleExportCSV = () => {
    if (!expenses || expenses.length === 0) {
      showToast('No expenses to export for this month', 'warning');
      return;
    }

    const headers = ['Date', 'Title', 'Category', 'Paid By', 'Amount (INR)', 'Method', 'Merchant'];
    const rows = expenses.map(e => [
      e.expense_date,
      `"${e.title.replace(/"/g, '""')}"`,
      e.category,
      `"${(e.payer?.display_name || 'Roommate').replace(/"/g, '""')}"`,
      e.amount,
      e.sharing_method,
      `"${(e.merchant_name || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `expenses_${activeRoom?.name || 'room'}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Report exported to CSV!', 'success');
  };

  if (!activeRoom) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontWeight: 700 }}>Please select or join a room first.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header with Month Filter & Export */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 10, background: '#C9D5FF',
                border: '2px solid #292524', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <BarChart3 size={20} />
            </div>
            <h1 className="heading-lg">Monthly Reports & Analytics</h1>
          </div>
          <p style={{ color: '#6B625B', fontSize: '0.875rem', marginTop: 4 }}>
            Detailed breakdown of spending patterns and household balance
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="input !py-1.5 !px-3 !w-auto"
            style={{ fontWeight: 700 }}
          >
            {monthOptions.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          <button
            onClick={handleExportCSV}
            className="btn btn-secondary !py-2"
            title="Download CSV Spreadsheet"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {loadingReport ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Loader2 className="animate-spin inline-block" size={30} />
          <p style={{ fontWeight: 600, marginTop: 12 }}>Crunching expense figures…</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top 3 KPI Bento Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {/* Total Spend */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="nb-card nb-yellow"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Month Spending
                </span>
                <TrendingUp size={18} />
              </div>
              <div className="text-money-lg" style={{ marginTop: 8 }}>{formatINR(totalSpending)}</div>
              <p style={{ fontSize: '0.78rem', color: '#6B625B', marginTop: 4 }}>
                {report?.expense_count ?? 0} transactions recorded
              </p>
            </motion.div>

            {/* Budget status */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="nb-card nb-green"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Budget Utilization
                </span>
                <Wallet size={18} />
              </div>
              <div className="text-money-lg" style={{ marginTop: 8 }}>
                {Math.round(budgetPct)}%
              </div>
              <div style={{ marginTop: 8 }}>
                <ProgressBar
                  value={budgetPct}
                  color={budgetPct > 100 ? '#EF4444' : '#292524'}
                  label="Budget progress"
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#6B625B', marginTop: 4 }}>
                Budget: {formatINR(budget)}
              </p>
            </motion.div>

            {/* Per-roommate average */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="nb-card nb-blue"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Avg / Roommate
                </span>
                <DollarSign size={18} />
              </div>
              <div className="text-money-lg" style={{ marginTop: 8 }}>{formatINR(perPersonAvg)}</div>
              <p style={{ fontSize: '0.78rem', color: '#6B625B', marginTop: 4 }}>
                Across {memberCount} active roommate{memberCount !== 1 ? 's' : ''}
              </p>
            </motion.div>
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
            {/* Category Pie Chart */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="nb-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <PieIcon size={18} />
                <h2 style={{ fontWeight: 800, fontSize: '1rem' }}>Spending by Category</h2>
              </div>

              {categoryData.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#6B625B', fontSize: '0.9rem' }}>
                  No categorical expense data recorded for {selectedMonth}.
                </div>
              ) : (
                <>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={45}
                          stroke="#292524"
                          strokeWidth={2}
                        >
                          {categoryData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any) => [formatINR(Number(v)), 'Total']}
                          contentStyle={{
                            background: '#FFFDF7',
                            border: '2px solid #292524',
                            boxShadow: '3px 3px 0 #292524',
                            borderRadius: 8,
                            fontWeight: 700,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Category Legend list */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    {categoryData.map(cat => (
                      <div
                        key={cat.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          background: '#F9F8F6',
                          borderRadius: 8,
                          border: '1.5px solid #292524',
                          fontSize: '0.8rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{cat.emoji}</span>
                          <span style={{ fontWeight: 600 }}>{cat.name}</span>
                        </div>
                        <span style={{ fontWeight: 800 }}>{formatINR(cat.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>

            {/* Paid By Members Bar Chart */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="nb-card"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <BarChart3 size={18} />
                <h2 style={{ fontWeight: 800, fontSize: '1rem' }}>Total Paid by Roommate</h2>
              </div>

              {memberChartData.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#6B625B', fontSize: '0.9rem' }}>
                  No payment data available for this month.
                </div>
              ) : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={memberChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DC" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700, fill: '#292524' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#6B625B' }} />
                      <Tooltip
                        formatter={(v: any) => [formatINR(Number(v)), 'Paid']}
                        contentStyle={{
                          background: '#FFFDF7',
                          border: '2px solid #292524',
                          boxShadow: '3px 3px 0 #292524',
                          borderRadius: 8,
                          fontWeight: 700,
                        }}
                      />
                      <Bar dataKey="amount" fill="#FFE66D" stroke="#292524" strokeWidth={2} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}
