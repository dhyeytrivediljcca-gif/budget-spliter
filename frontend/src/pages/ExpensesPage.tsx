import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Plus, Search, Filter, Receipt, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { expensesApi } from '../api';
import { useRoom } from '../contexts/RoomContext';
import { CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_EMOJIS, type ExpenseCategory } from '../types';
import AddExpenseModal from '../components/expenses/AddExpenseModal';
import { showToast } from '../components/ui/Toast';
import { SkeletonCard } from '../components/ui/Skeleton';

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function ExpensesPage() {
  const { activeRoom } = useRoom();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentMonth, setCurrentMonth] = useState(() => format(new Date(), 'yyyy-MM'));

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', activeRoom?.id, currentMonth, selectedCategory],
    queryFn: () => expensesApi.list(activeRoom!.id, {
      month: currentMonth,
      category: selectedCategory || undefined,
      limit: 100,
    }),
    enabled: !!activeRoom,
  });

  const filtered = expenses?.filter(e =>
    !searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.payer?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const categories = Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][];

  if (!activeRoom) {
    return (
      <div className="empty-state" style={{ padding: 48 }}>
        <span style={{ fontSize: '3rem' }}>🏠</span>
        <p>Join or create a room first.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="heading-lg" style={{ marginBottom: 2 }}>Expenses</h1>
          <p style={{ color: '#6B625B', fontSize: '0.9rem' }}>{activeRoom.name}</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9E9087' }} />
          <input
            type="text"
            placeholder="Search expenses…"
            className="form-input"
            style={{ paddingLeft: 34 }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search expenses"
          />
        </div>

        {/* Month filter */}
        <input
          type="month"
          className="form-input"
          style={{ width: 'auto' }}
          value={currentMonth}
          onChange={e => setCurrentMonth(e.target.value)}
          aria-label="Filter by month"
        />

        {/* Category filter */}
        <select
          className="form-input"
          style={{ width: 'auto' }}
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Expense List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span style={{ fontSize: '3rem' }}>🛒</span>
          <p className="heading-md">No expenses found</p>
          <p style={{ color: '#6B625B' }}>Try adjusting your filters or add a new expense.</p>
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ marginTop: 8 }}>
            <Plus size={15} /> Add First Expense
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((exp, i) => (
            <motion.div
              key={exp.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="nb-card"
              style={{ padding: 16, cursor: 'pointer' }}
              onClick={() => navigate(`/expenses/${exp.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: CATEGORY_COLORS[exp.category as ExpenseCategory] || '#F4F0E8',
                  border: '2px solid #292524',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', flexShrink: 0,
                }}>
                  {CATEGORY_EMOJIS[exp.category as ExpenseCategory] || '📦'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>{exp.title}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: CATEGORY_COLORS[exp.category as ExpenseCategory] || '#F4F0E8' }}>
                      {CATEGORY_LABELS[exp.category as ExpenseCategory] || exp.category}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#6B625B', fontWeight: 500 }}>
                      Paid by {exp.payer?.display_name || exp.paid_by}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#6B625B', fontWeight: 500 }}>
                      {format(new Date(exp.expense_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p className="text-money" style={{ fontSize: '1.05rem' }}>{formatINR(exp.amount)}</p>
                  <p style={{ fontSize: '0.75rem', color: '#6B625B' }}>
                    {exp.shares.length} member{exp.shares.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Share breakdown */}
              {exp.shares.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1.5px solid #E8E4DC' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {exp.shares.map(share => (
                      <div
                        key={share.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: '#F4F0E8', borderRadius: 8,
                          padding: '4px 10px', border: '1.5px solid #E0DDD5',
                          fontSize: '0.78rem', fontWeight: 600,
                        }}
                      >
                        <span>{share.member?.display_name || share.member_id}</span>
                        <span style={{ color: '#6B625B' }}>— {formatINR(share.share_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <AddExpenseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        roomId={activeRoom.id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['expenses'] });
          queryClient.invalidateQueries({ queryKey: ['balances'] });
          queryClient.invalidateQueries({ queryKey: ['report'] });
          setShowAddModal(false);
          showToast('Expense added! 💸', 'success');
        }}
      />
    </div>
  );
}
