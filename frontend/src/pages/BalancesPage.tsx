import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ArrowRight, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { balancesApi, repaymentsApi, roomsApi } from '../api';
import { useRoom } from '../contexts/RoomContext';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import { showToast } from '../components/ui/Toast';
import { SkeletonCard } from '../components/ui/Skeleton';

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function BalanceSign({ value }: { value: number }) {
  if (value > 0) return <TrendingUp size={16} color="#15803D" />;
  if (value < 0) return <TrendingDown size={16} color="#DC2626" />;
  return <Minus size={16} color="#6B625B" />;
}

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  suggestedAmount: number;
  roomId: string;
  onSuccess: () => void;
}

function RecordPaymentModal({ isOpen, onClose, fromUserId, fromName, toUserId, toName, suggestedAmount, roomId, onSuccess }: RecordPaymentModalProps) {
  const [amount, setAmount] = useState(suggestedAmount.toString());
  const [method, setMethod] = useState<'cash' | 'upi' | 'other'>('cash');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;
    setSubmitting(true);
    try {
      await repaymentsApi.create(roomId, {
        debtor_id: fromUserId,
        creditor_id: toUserId,
        amount: parsed,
        payment_method: method,
        reference_note: note || undefined,
      });
      onSuccess();
      onClose();
      showToast('Payment recorded! Awaiting confirmation from receiver.', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to record payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment">
      <form onSubmit={handleSubmit}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#F4F0E8', padding: '12px 16px', borderRadius: 10,
          border: '1.5px solid #E8E4DC', marginBottom: 16, gap: 8, flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 700 }}>{fromName}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B625B' }}>
            <ArrowRight size={16} /> pays
          </div>
          <span style={{ fontWeight: 700 }}>{toName}</span>
        </div>

        <div className="mb-4">
          <label htmlFor="pay-amount" className="form-label">Amount (₹)</label>
          <input
            id="pay-amount"
            type="number"
            step="0.01"
            min="0.01"
            className="form-input"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <p className="form-label">Payment Method</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['cash', 'upi', 'other'] as const).map(m => (
              <label key={m} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px', border: '2px solid #292524', borderRadius: 8, cursor: 'pointer',
                background: method === m ? '#FFE66D' : '#FFFDF7',
                fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase',
                boxShadow: method === m ? '2px 2px 0 #292524' : 'none',
              }}>
                <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} style={{ display: 'none' }} />
                {m === 'cash' ? '💵' : m === 'upi' ? '📱' : '📋'} {m.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="pay-note" className="form-label">Reference Note (optional)</label>
          <input id="pay-note" type="text" className="form-input" placeholder="UPI ref # or note" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <div style={{ background: '#FFE66D', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #292524', marginBottom: 16, fontSize: '0.82rem', fontWeight: 600 }}>
          ⚠️ The receiver must confirm this payment before it affects balances.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function BalancesPage() {
  const { activeRoom } = useRoom();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [paymentModal, setPaymentModal] = useState<null | { from: any; to: any; amount: number }>(null);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['balances', activeRoom?.id, selectedMonth],
    queryFn: () => balancesApi.get(activeRoom!.id, selectedMonth),
    enabled: !!activeRoom,
  });

  const { data: repayments } = useQuery({
    queryKey: ['repayments', activeRoom?.id],
    queryFn: () => repaymentsApi.list(activeRoom!.id),
    enabled: !!activeRoom,
  });

  const handleConfirmPayment = async (repaymentId: string) => {
    try {
      await repaymentsApi.confirm(activeRoom!.id, repaymentId);
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      queryClient.invalidateQueries({ queryKey: ['repayments'] });
      showToast('Payment confirmed!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to confirm', 'error');
    }
  };

  if (!activeRoom) return <div className="empty-state"><p>No room selected</p></div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="heading-lg">Balances</h1>
          <p style={{ color: '#6B625B', fontSize: '0.9rem' }}>{activeRoom.name}</p>
        </div>
        <input
          type="month"
          className="form-input"
          style={{ width: 'auto' }}
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          aria-label="Select month"
        />
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <>
          {/* Member Balances */}
          <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
            {summary?.members.map((m, i) => (
              <motion.div
                key={m.user_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`nb-card ${m.net_balance > 0 ? 'nb-mint' : m.net_balance < 0 ? 'nb-peach' : 'nb-muted'}`}
                style={{ padding: 16 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <Avatar name={m.display_name} url={m.avatar_url} size="lg" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                        {m.display_name}{m.user_id === profile?.id ? ' (you)' : ''}
                      </span>
                      {m.net_balance > 0 && <span className="badge" style={{ background: '#B8F2D0', fontSize: '0.7rem' }}>To Receive</span>}
                      {m.net_balance < 0 && <span className="badge" style={{ background: '#FFB8A2', fontSize: '0.7rem' }}>Owes</span>}
                      {m.net_balance === 0 && <span className="badge" style={{ background: '#F4F0E8', fontSize: '0.7rem' }}>Settled ✓</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', color: '#6B625B', fontWeight: 600 }}>
                        Paid: {formatINR(m.total_paid)}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#6B625B', fontWeight: 600 }}>
                        Share: {formatINR(m.total_share)}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      <BalanceSign value={m.net_balance} />
                      <span className="text-money" style={{
                        fontSize: '1.2rem',
                        color: m.net_balance > 0 ? '#15803D' : m.net_balance < 0 ? '#DC2626' : '#6B625B',
                      }}>
                        {m.net_balance === 0 ? '₹0' : (m.net_balance > 0 ? '+' : '–') + formatINR(Math.abs(m.net_balance))}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#6B625B', marginTop: 2 }}>
                      {m.net_balance > 0 ? 'to receive' : m.net_balance < 0 ? 'to pay' : 'balanced'}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Settlement Suggestions */}
          {summary && summary.settlements.length > 0 && (
            <div className="nb-card nb-yellow" style={{ marginBottom: 24 }}>
              <h2 className="heading-md" style={{ marginBottom: 14 }}>💡 Suggested Settlements</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {summary.settlements.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'rgba(255,255,255,0.7)', padding: '12px 14px',
                      borderRadius: 10, border: '1.5px solid #292524', gap: 12, flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.from_display_name}</span>
                      <ArrowRight size={14} />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.to_display_name}</span>
                      <span className="text-money" style={{ fontSize: '1rem' }}>{formatINR(s.amount)}</span>
                    </div>
                    <button
                      onClick={() => setPaymentModal({ from: { id: s.from_user_id, name: s.from_display_name }, to: { id: s.to_user_id, name: s.to_display_name }, amount: s.amount })}
                      className="btn btn-secondary btn-sm"
                    >
                      Record Payment
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Repayments */}
          {repayments && repayments.length > 0 && (
            <div className="nb-card">
              <h2 className="heading-md" style={{ marginBottom: 14 }}>Recent Payments</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {repayments.slice(0, 10).map(r => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E8E4DC',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                          {r.debtor?.display_name || r.debtor_id}
                        </span>
                        <ArrowRight size={12} />
                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                          {r.creditor?.display_name || r.creditor_id}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#6B625B' }}>
                        {r.payment_method.toUpperCase()} · {r.paid_at ? format(new Date(r.paid_at), 'MMM d') : 'Pending'}
                      </span>
                    </div>
                    <span className="text-money" style={{ fontSize: '0.95rem' }}>{formatINR(r.amount)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.status === 'confirmed' && <CheckCircle size={16} color="#15803D" />}
                      {r.status === 'pending' && <Clock size={16} color="#B45309" />}
                      {r.status === 'rejected' && <XCircle size={16} color="#DC2626" />}
                      {r.status === 'pending' && r.creditor_id === profile?.id && (
                        <button
                          onClick={() => handleConfirmPayment(r.id)}
                          className="btn btn-mint btn-sm"
                        >
                          Confirm
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {paymentModal && (
        <RecordPaymentModal
          isOpen={!!paymentModal}
          onClose={() => setPaymentModal(null)}
          fromUserId={paymentModal.from.id}
          fromName={paymentModal.from.name}
          toUserId={paymentModal.to.id}
          toName={paymentModal.to.name}
          suggestedAmount={paymentModal.amount}
          roomId={activeRoom.id}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['repayments'] });
            queryClient.invalidateQueries({ queryKey: ['balances'] });
            setPaymentModal(null);
          }}
        />
      )}
    </div>
  );
}
