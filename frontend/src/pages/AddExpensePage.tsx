import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ArrowLeft, Loader2, Receipt } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { expensesApi, roomsApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import { CATEGORY_LABELS } from '../types';
import type { ExpenseCategory, CreateExpenseInput } from '../types';
import { showToast } from '../components/ui/Toast';

const schema = z.object({
  title: z.string().min(1, 'Title required').max(200),
  amount: z.number().positive('Must be positive'),
  category: z.string().min(1, 'Select a category'),
  paid_by: z.string().min(1, 'Select who paid'),
  expense_date: z.string().min(1, 'Date required'),
  sharing_method: z.enum(['equal', 'custom']),
  description: z.string().optional(),
  merchant_name: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][];

export default function AddExpensePage() {
  const { profile } = useAuth();
  const { activeRoom } = useRoom();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const { data: members } = useQuery({
    queryKey: ['members', activeRoom?.id],
    queryFn: () => roomsApi.getMembers(activeRoom!.id),
    enabled: !!activeRoom,
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      paid_by: profile?.id || '',
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      sharing_method: 'equal',
      category: 'groceries',
    },
  });

  const sharingMethod = watch('sharing_method');
  const amount = watch('amount');

  useEffect(() => {
    if (profile?.id) {
      setValue('paid_by', profile.id);
    }
  }, [profile, setValue]);

  useEffect(() => {
    if (members && members.length > 0 && selectedMembers.length === 0) {
      const allIds = members.map(m => m.user_id);
      setSelectedMembers(allIds);
      const equalShare = ((amount || 0) / allIds.length).toFixed(2);
      const init: Record<string, string> = {};
      allIds.forEach(id => { init[id] = equalShare; });
      setCustomAmounts(init);
    }
  }, [members, amount, selectedMembers.length]);

  useEffect(() => {
    if (sharingMethod === 'custom' && members && selectedMembers.length > 0 && amount > 0) {
      const share = (amount / selectedMembers.length).toFixed(2);
      const updated: Record<string, string> = {};
      selectedMembers.forEach(id => { updated[id] = share; });
      setCustomAmounts(updated);
    }
  }, [sharingMethod, amount, selectedMembers.length, members]);

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId)
        ? prev.length > 1 ? prev.filter(id => id !== userId) : prev
        : [...prev, userId]
    );
  };

  const onSubmit = async (values: FormData) => {
    if (!activeRoom) return;
    if (selectedMembers.length === 0) {
      showToast('Select at least one member to split with', 'warning');
      return;
    }

    if (values.sharing_method === 'custom') {
      const customTotal = selectedMembers.reduce((sum, uid) => sum + (parseFloat(customAmounts[uid]) || 0), 0);
      if (Math.abs(customTotal - values.amount) > 0.05) {
        showToast(`Custom shares sum to ₹${customTotal.toFixed(2)}, but total amount is ₹${values.amount}`, 'error');
        return;
      }
    }

    const payload: CreateExpenseInput = {
      title: values.title,
      amount: values.amount,
      category: values.category as ExpenseCategory,
      paid_by: values.paid_by,
      expense_date: new Date(values.expense_date).toISOString(),
      sharing_method: values.sharing_method,
      description: values.description || undefined,
      merchant_name: values.merchant_name || undefined,
      member_ids: selectedMembers,
      custom_shares: values.sharing_method === 'custom'
        ? selectedMembers.map(uid => ({
            member_id: uid,
            amount: parseFloat(customAmounts[uid]) || 0,
          }))
        : undefined,
    };

    try {
      setSubmitting(true);
      await expensesApi.create(activeRoom.id, payload);

      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      showToast('Expense added successfully!', 'success');
      navigate('/expenses');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to add expense', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!activeRoom) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontWeight: 700 }}>Select or create a room first.</p>
        <button onClick={() => navigate('/onboarding')} className="btn btn-primary mt-4">
          Go to Rooms
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px' }}>
      <button
        onClick={() => navigate(-1)}
        className="btn btn-ghost btn-sm mb-4"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="nb-card bg-white">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: 10, background: '#FFE66D',
              border: '2px solid #292524', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <Receipt size={20} />
          </div>
          <div>
            <h1 className="heading-md">Add New Expense</h1>
            <p style={{ color: '#6B625B', fontSize: '0.8rem' }}>Split fairly with {activeRoom.name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Expense Title *</label>
            <input
              type="text"
              placeholder="e.g. WiFi Bill, Milk & Eggs, Swiggy Dinner"
              className="input"
              {...register('title')}
            />
            {errors.title && <p className="text-xs text-red-500 font-bold mt-1">{errors.title.message}</p>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Total Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="input"
                {...register('amount', { valueAsNumber: true })}
              />
              {errors.amount && <p className="text-xs text-red-500 font-bold mt-1">{errors.amount.message}</p>}
            </div>

            <div>
              <label className="label">Category *</label>
              <select className="input" {...register('category')}>
                {CATEGORIES.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Paid By *</label>
              <select className="input" {...register('paid_by')}>
                {members?.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile?.display_name || 'Member'} {m.user_id === profile?.id ? '(You)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" {...register('expense_date')} />
            </div>
          </div>

          {/* Split Mode */}
          <div>
            <label className="label">Splitting Method</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => setValue('sharing_method', 'equal')}
                className={`btn btn-sm justify-center ${sharingMethod === 'equal' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Split Equally
              </button>
              <button
                type="button"
                onClick={() => setValue('sharing_method', 'custom')}
                className={`btn btn-sm justify-center ${sharingMethod === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Custom Amounts
              </button>
            </div>
          </div>

          {/* Members involved */}
          <div>
            <label className="label">Who participates in this expense?</label>
            <div className="space-y-2">
              {members?.map(m => {
                const isSelected = selectedMembers.includes(m.user_id);
                return (
                  <div
                    key={m.user_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: isSelected ? '#F5FAF5' : '#F9F8F6',
                      border: '1.5px solid #292524',
                      borderRadius: 8,
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMember(m.user_id)}
                        style={{ width: 16, height: 16 }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        {m.profile?.display_name || 'Member'}
                      </span>
                    </label>

                    {isSelected && (
                      <div>
                        {sharingMethod === 'equal' ? (
                          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                            ₹{amount > 0 && selectedMembers.length > 0 ? (amount / selectedMembers.length).toFixed(2) : '0.00'}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>₹</span>
                            <input
                              type="number"
                              step="0.01"
                              value={customAmounts[m.user_id] || ''}
                              onChange={e => setCustomAmounts(prev => ({ ...prev, [m.user_id]: e.target.value }))}
                              className="input !py-1 !px-2 !w-24 text-right"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optional merchant / note */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Merchant / Vendor (optional)</label>
              <input
                type="text"
                placeholder="e.g. Zepto, ACT Fibernet"
                className="input"
                {...register('merchant_name')}
              />
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input
                type="text"
                placeholder="e.g. reimbursed via UPI"
                className="input"
                {...register('description')}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <button
              type="button"
              onClick={() => navigate('/expenses')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
