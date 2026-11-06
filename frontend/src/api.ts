import axios from 'axios';
import type {
  Profile, Room, RoomMember, Invitation, Expense, Repayment,
  BalanceSummary, MonthlyReport, CategoryStat,
  CreateRoomInput, CreateExpenseInput, CreateRepaymentInput,
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Inject Supabase JWT into every request
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export const profileApi = {
  create: (data: { display_name: string; avatar_url?: string }) =>
    api.post<Profile>('/api/profile', data).then(r => r.data),

  getMe: () => api.get<Profile>('/api/profile/me').then(r => r.data),

  updateMe: (data: { display_name?: string; avatar_url?: string }) =>
    api.patch<Profile>('/api/profile/me', data).then(r => r.data),
};

// ─── Rooms ────────────────────────────────────────────────────────────────────

export const roomsApi = {
  create: (data: CreateRoomInput) =>
    api.post<Room>('/api/rooms', data).then(r => r.data),

  list: () => api.get<Room[]>('/api/rooms').then(r => r.data),

  get: (roomId: string) =>
    api.get<Room>(`/api/rooms/${roomId}`).then(r => r.data),

  update: (roomId: string, data: Partial<CreateRoomInput>) =>
    api.patch<Room>(`/api/rooms/${roomId}`, data).then(r => r.data),

  createInvitation: (roomId: string, expiresHours = 48) =>
    api.post<Invitation>(`/api/rooms/${roomId}/invitations`, { expires_hours: expiresHours }).then(r => r.data),

  join: (token: string) =>
    api.post<{ room_id: string; message: string }>('/api/rooms/join', { token }).then(r => r.data),

  getMembers: (roomId: string) =>
    api.get<RoomMember[]>(`/api/rooms/${roomId}/members`).then(r => r.data),

  updateMemberRole: (roomId: string, memberId: string, role: 'leader' | 'member') =>
    api.patch<RoomMember>(`/api/rooms/${roomId}/members/${memberId}`, { role }).then(r => r.data),

  removeMember: (roomId: string, memberId: string) =>
    api.delete(`/api/rooms/${roomId}/members/${memberId}`),

  transferLeadership: (roomId: string, newLeaderId: string) =>
    api.post(`/api/rooms/${roomId}/transfer-leadership`, { new_leader_id: newLeaderId }).then(r => r.data),
};

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const expensesApi = {
  create: (roomId: string, data: CreateExpenseInput) =>
    api.post<Expense>(`/api/rooms/${roomId}/expenses`, data).then(r => r.data),

  list: (roomId: string, params?: {
    category?: string;
    paid_by?: string;
    status?: string;
    month?: string;
    skip?: number;
    limit?: number;
  }) => api.get<Expense[]>(`/api/rooms/${roomId}/expenses`, { params }).then(r => r.data),

  get: (roomId: string, expenseId: string) =>
    api.get<Expense>(`/api/rooms/${roomId}/expenses/${expenseId}`).then(r => r.data),

  update: (roomId: string, expenseId: string, data: Partial<CreateExpenseInput>) =>
    api.patch<Expense>(`/api/rooms/${roomId}/expenses/${expenseId}`, data).then(r => r.data),

  void: (roomId: string, expenseId: string, reason: string) =>
    api.post(`/api/rooms/${roomId}/expenses/${expenseId}/void`, { reason }).then(r => r.data),
};

// ─── Balances ─────────────────────────────────────────────────────────────────

export const balancesApi = {
  get: (roomId: string, month?: string) =>
    api.get<BalanceSummary>(`/api/rooms/${roomId}/balances`, { params: { month } }).then(r => r.data),
};

// ─── Repayments ───────────────────────────────────────────────────────────────

export const repaymentsApi = {
  create: (roomId: string, data: CreateRepaymentInput) =>
    api.post<Repayment>(`/api/rooms/${roomId}/repayments`, data).then(r => r.data),

  list: (roomId: string) =>
    api.get<Repayment[]>(`/api/rooms/${roomId}/repayments`).then(r => r.data),

  confirm: (roomId: string, repaymentId: string) =>
    api.post(`/api/rooms/${roomId}/repayments/${repaymentId}/confirm`).then(r => r.data),
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export const reportsApi = {
  monthly: (roomId: string, month?: string) =>
    api.get<MonthlyReport>(`/api/rooms/${roomId}/reports/monthly`, { params: { month } }).then(r => r.data),

  categories: (roomId: string, month?: string) =>
    api.get<CategoryStat[]>(`/api/rooms/${roomId}/reports/categories`, { params: { month } }).then(r => r.data),
};

export default api;
