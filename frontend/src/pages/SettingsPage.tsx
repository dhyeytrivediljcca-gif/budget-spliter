import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Settings, Home, User, AlertTriangle, Shield,
  Save, LogOut, Trash2, Plus, Key, Loader2, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import { roomsApi, profileApi } from '../api';
import Modal from '../components/ui/Modal';
import { showToast } from '../components/ui/Toast';

const roomSchema = z.object({
  name: z.string().min(2, 'Room name must be at least 2 characters').max(60),
  monthly_budget: z.number().positive('Must be positive'),
  currency: z.string().min(1, 'Currency required'),
});

type RoomFormValues = z.infer<typeof roomSchema>;

export default function SettingsPage() {
  const { profile, setProfile } = useAuth();
  const { activeRoom, setActiveRoom } = useRoom();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [savingRoom, setSavingRoom] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const { data: userRooms } = useQuery({
    queryKey: ['my-rooms'],
    queryFn: roomsApi.list,
  });

  const { data: members } = useQuery({
    queryKey: ['members', activeRoom?.id],
    queryFn: () => roomsApi.getMembers(activeRoom!.id),
    enabled: !!activeRoom,
  });

  const currentMember = members?.find(m => m.user_id === profile?.id);
  const isLeader = currentMember?.role === 'leader';

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: activeRoom?.name || '',
      monthly_budget: activeRoom?.monthly_budget || 15000,
      currency: activeRoom?.currency || 'INR',
    },
  });

  useEffect(() => {
    if (activeRoom) {
      reset({
        name: activeRoom.name,
        monthly_budget: activeRoom.monthly_budget,
        currency: activeRoom.currency,
      });
    }
  }, [activeRoom, reset]);

  const onUpdateRoom = async (values: RoomFormValues) => {
    if (!activeRoom || !isLeader) return;
    try {
      setSavingRoom(true);
      const updated = await roomsApi.update(activeRoom.id, values);
      setActiveRoom(updated);
      queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
      showToast('Room settings updated successfully!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to update room settings', 'error');
    } finally {
      setSavingRoom(false);
    }
  };

  const onUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    try {
      setSavingProfile(true);
      const updated = await profileApi.updateMe({ display_name: displayName.trim() });
      setProfile(updated);
      showToast('Profile name updated!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom || !profile) return;
    try {
      setLeaving(true);
      await roomsApi.removeMember(activeRoom.id, profile.id);
      showToast(`Left ${activeRoom.name}`, 'info');
      setActiveRoom(null);
      queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
      setLeaveModalOpen(false);
      navigate('/onboarding');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Could not leave room. Ensure you are not the sole leader or clear pending balances.', 'error');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10, background: '#FFE66D',
            border: '2px solid #292524', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <Settings size={20} />
        </div>
        <div>
          <h1 className="heading-lg">Room & Profile Settings</h1>
          <p style={{ color: '#6B625B', fontSize: '0.875rem' }}>
            Manage room configuration, active flat, and personal details
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Active Room Switcher */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="nb-card"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Home size={18} />
              <h2 style={{ fontWeight: 800, fontSize: '1rem' }}>Switch Active Room</h2>
            </div>
            <button
              onClick={() => navigate('/onboarding')}
              className="btn btn-secondary btn-sm"
            >
              <Plus size={14} /> Add / Join Room
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {userRooms?.map(room => {
              const isActive = activeRoom?.id === room.id;
              return (
                <div
                  key={room.id}
                  onClick={() => {
                    setActiveRoom(room);
                    showToast(`Active room switched to "${room.name}"`, 'info');
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '2px solid #292524',
                    background: isActive ? '#FFF9D2' : '#FFFFFF',
                    boxShadow: isActive ? '3px 3px 0 #292524' : '2px 2px 0 #292524',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 800, fontSize: '0.9rem' }}>{room.name}</p>
                    <p style={{ fontSize: '0.75rem', color: '#6B625B', marginTop: 2 }}>
                      Budget: ₹{room.monthly_budget.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    {isActive ? (
                      <span className="badge badge-success !text-[0.65rem]">Active</span>
                    ) : (
                      <span className="text-xs font-bold text-stone-500 hover:text-stone-900">Switch →</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Room Configuration (Leader only) */}
        {activeRoom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="nb-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} />
                <h2 style={{ fontWeight: 800, fontSize: '1rem' }}>Room Configuration ({activeRoom.name})</h2>
              </div>
              {!isLeader && (
                <span className="badge badge-secondary !text-[0.65rem]">Leader-only</span>
              )}
            </div>

            <form onSubmit={handleSubmit(onUpdateRoom)} className="space-y-4">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                <div>
                  <label className="label">Room Name</label>
                  <input
                    type="text"
                    disabled={!isLeader}
                    className="input disabled:bg-stone-100"
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-500 font-bold mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="label">Target Monthly Budget (₹)</label>
                  <input
                    type="number"
                    step="500"
                    disabled={!isLeader}
                    className="input disabled:bg-stone-100"
                    {...register('monthly_budget', { valueAsNumber: true })}
                  />
                  {errors.monthly_budget && (
                    <p className="text-xs text-red-500 font-bold mt-1">{errors.monthly_budget.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="label">Currency</label>
                <select
                  disabled={!isLeader}
                  className="input disabled:bg-stone-100"
                  {...register('currency')}
                >
                  <option value="INR">INR (₹ - Indian Rupee)</option>
                  <option value="USD">USD ($ - US Dollar)</option>
                  <option value="EUR">EUR (€ - Euro)</option>
                  <option value="GBP">GBP (£ - British Pound)</option>
                </select>
              </div>

              {isLeader && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button
                    type="submit"
                    disabled={savingRoom}
                    className="btn btn-primary"
                  >
                    {savingRoom ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save Room Changes
                  </button>
                </div>
              )}
            </form>
          </motion.div>
        )}

        {/* Profile Details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="nb-card"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <User size={18} />
            <h2 style={{ fontWeight: 800, fontSize: '1rem' }}>Personal Profile</h2>
          </div>

          <form onSubmit={onUpdateProfile} className="space-y-4">
            <div>
              <label className="label">Display Name (How roommates see you)</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="input"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={savingProfile || !displayName.trim()}
                className="btn btn-secondary"
              >
                {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Update Name
              </button>
            </div>
          </form>
        </motion.div>

        {/* Danger Zone */}
        {activeRoom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="nb-card !border-red-900 bg-red-50/50"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#B91C1C' }}>
              <AlertTriangle size={18} />
              <h2 style={{ fontWeight: 800, fontSize: '1rem' }}>Danger Zone</h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#6B625B', marginBottom: 16 }}>
              Leaving this room will disconnect you from all mutual expense histories and calculations for {activeRoom.name}.
            </p>

            <button
              type="button"
              onClick={() => setLeaveModalOpen(true)}
              className="btn btn-primary bg-red-400 hover:bg-red-500 !border-red-900"
            >
              <LogOut size={16} />
              Leave Room
            </button>
          </motion.div>
        )}
      </div>

      {/* Leave Room Modal */}
      <Modal
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        title="Leave Room Confirmation"
        maxWidth="440px"
      >
        <div className="space-y-4">
          <p style={{ fontWeight: 600 }}>
            Are you sure you want to leave <strong>{activeRoom?.name}</strong>?
          </p>
          <p style={{ fontSize: '0.85rem', color: '#6B625B' }}>
            If you have outstanding balances with other roommates, please settle them before leaving.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button
              onClick={() => setLeaveModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleLeaveRoom}
              disabled={leaving}
              className="btn btn-primary bg-red-400 hover:bg-red-500 !border-red-900"
            >
              {leaving ? <Loader2 size={16} className="animate-spin" /> : 'Confirm & Leave'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
