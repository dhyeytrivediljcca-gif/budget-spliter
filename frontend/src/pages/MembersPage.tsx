import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Users, UserPlus, Shield, ShieldCheck, Trash2, Copy,
  Check, Clock, Share2, AlertTriangle, ArrowRight, Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import { roomsApi } from '../api';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import { showToast } from '../components/ui/Toast';
import type { RoomMember, Invitation } from '../types';

export default function MembersPage() {
  const { profile } = useAuth();
  const { activeRoom } = useRoom();
  const queryClient = useQueryClient();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [expiresHours, setExpiresHours] = useState(48);
  const [createdInvite, setCreatedInvite] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  // Selected member for action
  const [memberToRemove, setMemberToRemove] = useState<RoomMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const { data: members, isLoading } = useQuery({
    queryKey: ['members', activeRoom?.id],
    queryFn: () => roomsApi.getMembers(activeRoom!.id),
    enabled: !!activeRoom,
  });

  const currentMember = members?.find(m => m.user_id === profile?.id);
  const isLeader = currentMember?.role === 'leader';

  const handleGenerateInvite = async () => {
    if (!activeRoom) return;
    try {
      setGeneratingInvite(true);
      const inv = await roomsApi.createInvitation(activeRoom.id, expiresHours);
      setCreatedInvite(inv);
      showToast('Invite code generated!', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to generate invitation', 'error');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const copyInviteToClipboard = () => {
    if (!createdInvite) return;
    const inviteUrl = `${window.location.origin}/onboarding?tab=join&code=${createdInvite.token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    showToast('Invite link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const copyTokenOnly = () => {
    if (!createdInvite) return;
    navigator.clipboard.writeText(createdInvite.token);
    setCopied(true);
    showToast('Code copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleRole = async (member: RoomMember) => {
    if (!activeRoom || !isLeader) return;
    const newRole = member.role === 'leader' ? 'member' : 'leader';
    try {
      await roomsApi.updateMemberRole(activeRoom.id, member.user_id, newRole);
      queryClient.invalidateQueries({ queryKey: ['members', activeRoom.id] });
      showToast(`${member.profile?.display_name || 'Member'} is now a ${newRole}`, 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to update member role', 'error');
    }
  };

  const handleRemoveMember = async () => {
    if (!activeRoom || !memberToRemove) return;
    try {
      setRemoving(true);
      await roomsApi.removeMember(activeRoom.id, memberToRemove.user_id);
      queryClient.invalidateQueries({ queryKey: ['members', activeRoom.id] });
      showToast(`${memberToRemove.profile?.display_name || 'Member'} removed from room`, 'info');
      setMemberToRemove(null);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to remove member', 'error');
    } finally {
      setRemoving(false);
    }
  };

  if (!activeRoom) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ fontWeight: 700 }}>Please select or create a room first.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      {/* Top Banner */}
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
                width: 36, height: 36, borderRadius: 10, background: '#B8F2D0',
                border: '2px solid #292524', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <Users size={20} />
            </div>
            <h1 className="heading-lg">Roommates & Members</h1>
          </div>
          <p style={{ color: '#6B625B', fontSize: '0.875rem', marginTop: 4 }}>
            {activeRoom.name} · {members?.length || 0} active {members?.length === 1 ? 'member' : 'members'}
          </p>
        </div>

        <button
          onClick={() => {
            setCreatedInvite(null);
            setInviteModalOpen(true);
          }}
          className="btn btn-primary"
        >
          <UserPlus size={16} />
          Invite Roommate
        </button>
      </div>

      {/* Members List */}
      <div className="space-y-3">
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Loader2 className="animate-spin inline-block" size={24} />
            <p style={{ fontWeight: 600, marginTop: 8 }}>Loading roommates…</p>
          </div>
        ) : (
          members?.map(member => {
            const isMe = member.user_id === profile?.id;
            return (
              <motion.div
                key={member.user_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="nb-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  background: isMe ? '#FFFDEB' : '#FFFFFF',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Avatar name={member.profile?.display_name || 'Member'} url={member.profile?.avatar_url} size="md" />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem' }}>
                        {member.profile?.display_name || 'Member'}
                      </span>
                      {isMe && <span className="badge badge-warning !text-[0.65rem] !py-0.5">You</span>}
                      {member.role === 'leader' ? (
                        <span className="badge badge-success !text-[0.65rem] !py-0.5 flex items-center gap-1">
                          <ShieldCheck size={12} /> Leader
                        </span>
                      ) : (
                        <span className="badge badge-secondary !text-[0.65rem] !py-0.5">Member</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#6B625B', marginTop: 2 }}>
                      Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Leader action controls */}
                {isLeader && !isMe && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => handleToggleRole(member)}
                      className="btn btn-secondary btn-sm"
                      title={member.role === 'leader' ? 'Demote to Member' : 'Promote to Leader'}
                    >
                      <Shield size={14} />
                      {member.role === 'leader' ? 'Make Member' : 'Make Leader'}
                    </button>
                    <button
                      onClick={() => setMemberToRemove(member)}
                      className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50 !border-red-300"
                      title="Remove from room"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Invite Roommate Modal */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite New Roommate"
        maxWidth="480px"
      >
        <div className="space-y-4">
          {!createdInvite ? (
            <>
              <p style={{ fontSize: '0.875rem', color: '#6B625B' }}>
                Generate a secure invitation link or code to share with your roommate. They can use it to join <strong>{activeRoom.name}</strong> instantly.
              </p>

              <div>
                <label className="label">Code Expiration</label>
                <select
                  value={expiresHours}
                  onChange={e => setExpiresHours(Number(e.target.value))}
                  className="input"
                >
                  <option value={24}>24 hours (1 day)</option>
                  <option value={48}>48 hours (2 days - standard)</option>
                  <option value={168}>7 days (1 week)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateInvite}
                  disabled={generatingInvite}
                  className="btn btn-primary"
                >
                  {generatingInvite ? <Loader2 size={16} className="animate-spin" /> : 'Create Invite'}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div
                style={{
                  background: '#B8F2D0',
                  border: '2px solid #292524',
                  boxShadow: '3px 3px 0 #292524',
                  padding: 16,
                  borderRadius: 12,
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Room Invitation Code
                </p>
                <p style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '0.1em', marginTop: 4, fontFamily: 'monospace' }}>
                  {createdInvite.token}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#44403C', marginTop: 4 }}>
                  Expires {format(new Date(createdInvite.expires_at), 'PPp')}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={copyInviteToClipboard}
                  className="btn btn-primary justify-center"
                >
                  {copied ? <Check size={16} /> : <Share2 size={16} />}
                  Copy Full Link
                </button>
                <button
                  onClick={copyTokenOnly}
                  className="btn btn-secondary justify-center"
                >
                  <Copy size={16} />
                  Copy Code Only
                </button>
              </div>

              <p style={{ fontSize: '0.75rem', color: '#6B625B', textAlign: 'center' }}>
                Roommates can enter this token on the join screen or click the copied link directly.
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Remove Member Confirmation Modal */}
      <Modal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        title="Remove Roommate"
        maxWidth="440px"
      >
        <div className="space-y-4">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ color: '#EF4444', flexShrink: 0, marginTop: 2 }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <p style={{ fontWeight: 700 }}>
                Are you sure you want to remove {memberToRemove?.profile?.display_name || 'this member'}?
              </p>
              <p style={{ fontSize: '0.85rem', color: '#6B625B', marginTop: 4 }}>
                Please ensure all mutual expenses and balances have been settled before removing a member.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button
              onClick={() => setMemberToRemove(null)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleRemoveMember}
              disabled={removing}
              className="btn btn-primary bg-red-400 hover:bg-red-500 !border-red-900"
            >
              {removing ? <Loader2 size={16} className="animate-spin" /> : 'Yes, Remove'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
