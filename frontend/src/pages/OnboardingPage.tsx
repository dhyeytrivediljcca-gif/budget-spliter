import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Key, Home, ArrowRight, Loader2, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import { roomsApi, profileApi } from '../api';
import { showToast } from '../components/ui/Toast';

const createRoomSchema = z.object({
  name: z.string().min(2, 'Room name must be at least 2 characters').max(60),
  monthly_budget: z.number().positive('Budget must be positive'),
  currency: z.string().default('INR'),
  description: z.string().optional(),
});

const joinRoomSchema = z.object({
  token: z.string().min(4, 'Enter a valid invitation code').trim(),
});

const profileSchema = z.object({
  display_name: z.string().min(2, 'Name must be at least 2 characters').max(50),
});

type CreateRoomForm = z.infer<typeof createRoomSchema>;
type JoinRoomForm = z.infer<typeof joinRoomSchema>;
type ProfileForm = z.infer<typeof profileSchema>;

export default function OnboardingPage() {
  const { profile, setProfile, refreshProfile } = useAuth();
  const { activeRoom, setActiveRoom } = useRoom();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'join' ? 'join' : 'create';
  const [tab, setTab] = useState<'create' | 'join' | 'rooms'>(initialTab);
  const queryClient = useQueryClient();

  const { data: userRooms, isLoading: loadingRooms } = useQuery({
    queryKey: ['my-rooms'],
    queryFn: roomsApi.list,
  });

  // If user has a profile and has existing rooms, automatically select primary room and go to dashboard
  useEffect(() => {
    if (profile && userRooms && userRooms.length > 0) {
      if (!activeRoom) {
        setActiveRoom(userRooms[0]);
      }
      navigate('/');
    }
  }, [profile, userRooms, activeRoom, setActiveRoom, navigate]);

  // Profile setup form
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: profile?.display_name || '',
    },
  });

  // Create room form
  const createForm = useForm<CreateRoomForm>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      name: '',
      monthly_budget: 15000,
      currency: 'INR',
      description: '',
    },
  });

  // Join room form
  const joinForm = useForm<JoinRoomForm>({
    resolver: zodResolver(joinRoomSchema),
    defaultValues: {
      token: searchParams.get('code') || '',
    },
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);

  const onSaveProfile = async (values: ProfileForm) => {
    try {
      setSavingProfile(true);
      const updated = await profileApi.create({ display_name: values.display_name });
      setProfile(updated);
      showToast('Profile created successfully!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to save profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const onCreateRoom = async (values: CreateRoomForm) => {
    try {
      setCreatingRoom(true);
      const newRoom = await roomsApi.create({
        name: values.name,
        monthly_budget: values.monthly_budget,
        currency: values.currency,
      });
      setActiveRoom(newRoom);
      queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
      showToast(`Room "${newRoom.name}" created!`, 'success');
      navigate('/');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to create room', 'error');
    } finally {
      setCreatingRoom(false);
    }
  };

  const onJoinRoom = async (values: JoinRoomForm) => {
    try {
      setJoiningRoom(true);
      const res = await roomsApi.join(values.token);
      showToast(res.message || 'Joined room successfully!', 'success');
      const rooms = await roomsApi.list();
      const joined = rooms.find(r => r.id === res.room_id) || rooms[0];
      if (joined) {
        setActiveRoom(joined);
      }
      queryClient.invalidateQueries({ queryKey: ['my-rooms'] });
      navigate('/');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Invalid or expired invite code', 'error');
    } finally {
      setJoiningRoom(false);
    }
  };

  const selectExistingRoom = (room: any) => {
    setActiveRoom(room);
    showToast(`Switched to ${room.name}`, 'info');
    navigate('/');
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#FFFDF7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="nb-card"
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#FFFFFF',
          padding: 32,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: '#FFE66D',
              border: '2px solid #292524',
              boxShadow: '4px 4px 0 #292524',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              marginBottom: 12,
            }}
          >
            🏠
          </div>
          <h1 className="heading-lg">Welcome to RoomieSplit</h1>
          <p style={{ color: '#6B625B', fontSize: '0.9rem', marginTop: 4 }}>
            {!profile ? 'Set up your roommate profile first' : 'Manage your household or jump into a flat'}
          </p>
        </div>

        {/* Step 1: Profile if not yet created */}
        {!profile ? (
          <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
            <div>
              <label className="label">What should your roommates call you?</label>
              <input
                type="text"
                placeholder="e.g. Alex, Rahul, Sam"
                className="input"
                {...profileForm.register('display_name')}
              />
              {profileForm.formState.errors.display_name && (
                <p className="text-xs text-red-500 font-bold mt-1">
                  {profileForm.formState.errors.display_name.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="btn btn-primary w-full justify-center"
              style={{ marginTop: 16 }}
            >
              {savingProfile ? <Loader2 size={18} className="animate-spin" /> : 'Continue to Rooms'}
            </button>
          </form>
        ) : (
          <div>
            {/* Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: userRooms && userRooms.length > 0 ? '1fr 1fr 1fr' : '1fr 1fr',
                gap: 8,
                marginBottom: 24,
              }}
            >
              <button
                type="button"
                onClick={() => setTab('create')}
                className={`btn btn-sm justify-center ${tab === 'create' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Plus size={15} /> Create
              </button>
              <button
                type="button"
                onClick={() => setTab('join')}
                className={`btn btn-sm justify-center ${tab === 'join' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Key size={15} /> Join
              </button>
              {userRooms && userRooms.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTab('rooms')}
                  className={`btn btn-sm justify-center ${tab === 'rooms' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  <Home size={15} /> My Rooms ({userRooms.length})
                </button>
              )}
            </div>

            {/* TAB: CREATE */}
            {tab === 'create' && (
              <form onSubmit={createForm.handleSubmit(onCreateRoom)} className="space-y-4">
                <div>
                  <label className="label">Room / Flat Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Flat 304, Green Park PG, Baker Street"
                    className="input"
                    {...createForm.register('name')}
                  />
                  {createForm.formState.errors.name && (
                    <p className="text-xs text-red-500 font-bold mt-1">
                      {createForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="label">Target Monthly Budget (₹ INR)</label>
                  <input
                    type="number"
                    step="500"
                    placeholder="15000"
                    className="input"
                    {...createForm.register('monthly_budget', { valueAsNumber: true })}
                  />
                  {createForm.formState.errors.monthly_budget && (
                    <p className="text-xs text-red-500 font-bold mt-1">
                      {createForm.formState.errors.monthly_budget.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="label">Description / Flat Rules (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. WiFi bills on 1st, groceries split equally"
                    className="input"
                    {...createForm.register('description')}
                  />
                </div>

                <button
                  type="submit"
                  disabled={creatingRoom}
                  className="btn btn-primary w-full justify-center"
                  style={{ marginTop: 20 }}
                >
                  {creatingRoom ? <Loader2 size={18} className="animate-spin" /> : (
                    <>
                      Create Flat & Start Splitting <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB: JOIN */}
            {tab === 'join' && (
              <form onSubmit={joinForm.handleSubmit(onJoinRoom)} className="space-y-4">
                <div>
                  <label className="label">Invitation Token / Code</label>
                  <input
                    type="text"
                    placeholder="Paste invite token here (e.g. 8fa19e...)"
                    className="input"
                    {...joinForm.register('token')}
                  />
                  {joinForm.formState.errors.token && (
                    <p className="text-xs text-red-500 font-bold mt-1">
                      {joinForm.formState.errors.token.message}
                    </p>
                  )}
                </div>
                <p style={{ fontSize: '0.8rem', color: '#6B625B' }}>
                  Ask your roommate or flat leader to share the invite link or code from the Members section.
                </p>

                <button
                  type="submit"
                  disabled={joiningRoom}
                  className="btn btn-primary w-full justify-center"
                  style={{ marginTop: 20 }}
                >
                  {joiningRoom ? <Loader2 size={18} className="animate-spin" /> : (
                    <>
                      Join Room <Check size={16} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB: MY ROOMS */}
            {tab === 'rooms' && (
              <div className="space-y-3">
                {userRooms?.map(room => (
                  <div
                    key={room.id}
                    onClick={() => selectExistingRoom(room)}
                    style={{
                      padding: '14px 16px',
                      background: activeRoom?.id === room.id ? '#FFF9D2' : '#F9F8F6',
                      border: '2px solid #292524',
                      borderRadius: 12,
                      boxShadow: '3px 3px 0 #292524',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'transform 0.1s ease',
                    }}
                    className="hover:-translate-y-0.5"
                  >
                    <div>
                      <p style={{ fontWeight: 800, fontSize: '0.95rem' }}>{room.name}</p>
                      <p style={{ fontSize: '0.75rem', color: '#6B625B' }}>
                        Budget: ₹{room.monthly_budget.toLocaleString('en-IN')} / mo
                      </p>
                    </div>
                    {activeRoom?.id === room.id ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="btn btn-secondary btn-sm !py-1">Select</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
