import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Loader2, Plus, Minus, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import Modal from '../ui/Modal';
import { expensesApi, roomsApi } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { CATEGORY_LABELS } from '../../types';
import type { ExpenseCategory, RoomMember } from '../../types';

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onSuccess: () => void;
}

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][];

export default function AddExpenseModal({ isOpen, onClose, roomId, onSuccess }: Props) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const { data: members } = useQuery({
    queryKey: ['members', roomId],
    queryFn: () => roomsApi.getMembers(roomId),
    enabled: !!roomId,
  });

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<FormData>({
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

  // Initialize all members selected
  useEffect(() => {
    if (members && selectedMembers.length === 0) {
      setSelectedMembers(members.map(m => m.user_id));
    }
  }, [members]);

  useEffect(() => {
    if (profile?.id) setValue('paid_by', profile.id);
  }, [profile, setValue]);

  const toggleMember = (uid: string) => {
    setSelectedMembers(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const perPersonAmount = selectedMembers.length > 0 && amount
    ? amount / selectedMembers.length
    : 0;

  const customTotal = Object.values(customAmounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const customDiff = amount ? Math.abs(customTotal - amount) : 0;

  const onSubmit = async (data: FormData) => {
    if (selectedMembers.length === 0) return;

    setSubmitting(true);
    try {
      const payload: any = {
        title: data.title,
        amount: data.amount,
        category: data.category,
        paid_by: data.paid_by,
        expense_date: new Date(data.expense_date).toISOString(),
        sharing_method: data.sharing_method,
        description: data.description,
        merchant_name: data.merchant_name,
        member_ids: selectedMembers,
      };

      if (data.sharing_method === 'custom') {
        payload.custom_shares = selectedMembers.map(mid => ({
          member_id: mid,
          amount: parseFloat(customAmounts[mid] || '0'),
        }));
      }

      await expensesApi.create(roomId, payload);
      reset();
      setSelectedMembers([]);
      setCustomAmounts({});
      onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err.message || 'Failed to add expense';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Expense">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Title */}
        <div className="mb-4">
          <label htmlFor="exp-title" className="form-label">Expense Title *</label>
          <input id="exp-title" type="text" className="form-input" placeholder="e.g. Vegetables from market" {...register('title')} />
          {errors.title && <p className="form-error">{errors.title.message}</p>}
        </div>

        {/* Amount + Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label htmlFor="exp-amount" className="form-label">Amount (₹) *</label>
            <input
              id="exp-amount"
              type="number"
              step="0.01"
              min="0.01"
              className="form-input"
              placeholder="300.00"
              {...register('amount', { valueAsNumber: true })}
            />
            {errors.amount && <p className="form-error">{errors.amount.message}</p>}
          </div>
          <div>
            <label htmlFor="exp-date" className="form-label">Date *</label>
            <input id="exp-date" type="date" className="form-input" {...register('expense_date')} />
            {errors.expense_date && <p className="form-error">{errors.expense_date.message}</p>}
          </div>
        </div>

        {/* Category + Paid by */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label htmlFor="exp-category" className="form-label">Category *</label>
            <select id="exp-category" className="form-input" {...register('category')}>
              {CATEGORIES.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="exp-paidby" className="form-label">Paid By *</label>
            <select id="exp-paidby" className="form-input" {...register('paid_by')}>
              {members?.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profile?.display_name || m.user_id}
                  {m.user_id === profile?.id ? ' (me)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Split Method */}
        <div className="mb-4">
          <p className="form-label">Split Method</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['equal', 'custom'] as const).map(method => (
              <label
                key={method}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '8px 12px', border: '2px solid #292524', borderRadius: 8, cursor: 'pointer',
                  background: sharingMethod === method ? '#FFE66D' : '#FFFDF7',
                  fontWeight: 700, fontSize: '0.85rem', boxShadow: sharingMethod === method ? '2px 2px 0 #292524' : 'none',
                  transition: 'all 0.1s',
                }}
              >
                <input type="radio" value={method} {...register('sharing_method')} style={{ display: 'none' }} />
                {method === 'equal' ? '⚖️ Equal' : '✏️ Custom'}
              </label>
            ))}
          </div>
        </div>

        {/* Members */}
        <div className="mb-4">
          <p className="form-label">Split Between</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {members?.map(m => {
              const isSelected = selectedMembers.includes(m.user_id);
              const memberName = m.profile?.display_name || m.user_id;

              return (
                <div
                  key={m.user_id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8, border: '2px solid',
                    borderColor: isSelected ? '#292524' : '#E8E4DC',
                    background: isSelected ? '#F4F0E8' : '#FFFDF7',
                    cursor: 'pointer', transition: 'all 0.1s',
                  }}
                  onClick={() => toggleMember(m.user_id)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleMember(m.user_id)}
                    onClick={e => e.stopPropagation()}
                    style={{ width: 16, height: 16, accentColor: '#292524' }}
                    aria-label={`Include ${memberName}`}
                  />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem' }}>
                    {memberName}{m.user_id === profile?.id ? ' (me)' : ''}
                  </span>
                  {sharingMethod === 'equal' && isSelected && amount > 0 && (
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6B625B' }}>
                      ₹{perPersonAmount.toFixed(2)}
                    </span>
                  )}
                  {sharingMethod === 'custom' && isSelected && (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={customAmounts[m.user_id] || ''}
                      onChange={e => {
                        e.stopPropagation();
                        setCustomAmounts(prev => ({ ...prev, [m.user_id]: e.target.value }));
                      }}
                      onClick={e => e.stopPropagation()}
                      className="form-input"
                      style={{ width: 90, padding: '4px 8px', minHeight: 36 }}
                      placeholder="0.00"
                      aria-label={`Share amount for ${memberName}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {sharingMethod === 'custom' && amount > 0 && (
            <div
              style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 8,
                background: customDiff < 0.01 ? '#B8F2D0' : '#FFB8A2',
                border: '1.5px solid #292524', fontSize: '0.82rem', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Info size={14} />
              Total allocated: ₹{customTotal.toFixed(2)} / ₹{amount.toFixed(2)}
              {customDiff < 0.01 ? ' ✓ Balanced' : ` — ₹${customDiff.toFixed(2)} ${customTotal > amount ? 'over' : 'short'}`}
            </div>
          )}
        </div>

        {/* Optional fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label htmlFor="exp-merchant" className="form-label">Merchant (optional)</label>
            <input id="exp-merchant" type="text" className="form-input" placeholder="BigBazaar" {...register('merchant_name')} />
          </div>
          <div>
            <label htmlFor="exp-desc" className="form-label">Note (optional)</label>
            <input id="exp-desc" type="text" className="form-input" placeholder="Fresh produce" {...register('description')} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1.5px solid #E8E4DC', paddingTop: 16 }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button
            type="submit"
            disabled={submitting || selectedMembers.length === 0 || (sharingMethod === 'custom' && customDiff >= 0.01)}
            className="btn btn-primary"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {submitting ? 'Saving…' : 'Add Expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
