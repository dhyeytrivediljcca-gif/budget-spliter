// ─── Core Types ───────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  currency: string;
  monthly_budget: number;
  budget_start_day: number;
  created_by: string;
  created_at: string;
}

export type MemberRole = 'leader' | 'member';
export type MemberStatus = 'active' | 'removed';

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  profile?: Profile;
}

export interface Invitation {
  id: string;
  room_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export type ExpenseCategory =
  | 'vegetables'
  | 'groceries'
  | 'milk_dairy'
  | 'drinking_water'
  | 'household_supplies'
  | 'utilities'
  | 'other';

export type SharingMethod = 'equal' | 'custom' | 'percentage';
export type ExpenseStatus = 'active' | 'voided';

export interface ExpenseShare {
  id: string;
  member_id: string;
  share_amount: number;
  member?: Profile;
}

export interface Expense {
  id: string;
  room_id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  paid_by: string;
  created_by: string;
  expense_date: string;
  sharing_method: SharingMethod;
  description: string | null;
  merchant_name: string | null;
  status: ExpenseStatus;
  shares: ExpenseShare[];
  payer?: Profile;
  created_at: string;
  updated_at: string | null;
}

export type RepaymentStatus = 'pending' | 'confirmed' | 'rejected';
export type PaymentMethod = 'cash' | 'upi' | 'other';

export interface Repayment {
  id: string;
  room_id: string;
  debtor_id: string;
  creditor_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_note: string | null;
  status: RepaymentStatus;
  recorded_by: string;
  confirmed_by: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  debtor?: Profile;
  creditor?: Profile;
}

export interface MemberBalance {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_paid: number;
  total_share: number;
  net_balance: number;
}

export interface SettlementTransfer {
  from_user_id: string;
  from_display_name: string;
  to_user_id: string;
  to_display_name: string;
  amount: number;
}

export interface BalanceSummary {
  members: MemberBalance[];
  settlements: SettlementTransfer[];
  total_room_spending: number;
  selected_period: string;
}

export interface CategoryStat {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface MonthlyReport {
  month: string;
  total_spending: number;
  budget: number;
  remaining: number;
  utilization_pct: number;
  categories: CategoryStat[];
  member_contributions: Array<{
    user_id: string;
    display_name: string;
    amount_paid: number;
    percentage: number;
  }>;
  expense_count: number;
}

// ─── API Request Types ────────────────────────────────────────────────────────

export interface CreateRoomInput {
  name: string;
  currency?: string;
  monthly_budget: number;
  budget_start_day?: number;
}

export interface CreateExpenseInput {
  title: string;
  amount: number;
  category: ExpenseCategory;
  paid_by: string;
  expense_date: string;
  sharing_method: SharingMethod;
  description?: string;
  merchant_name?: string;
  member_ids: string[];
  custom_shares?: Array<{ member_id: string; amount: number }>;
  percentage_shares?: Record<string, number>;
}

export interface CreateRepaymentInput {
  debtor_id: string;
  creditor_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_note?: string;
  paid_at?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  vegetables: 'Vegetables',
  groceries: 'Groceries',
  milk_dairy: 'Milk & Dairy',
  drinking_water: 'Drinking Water',
  household_supplies: 'Household',
  utilities: 'Utilities',
  other: 'Other',
};

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  vegetables: '#B8F2D0',
  groceries: '#FFE66D',
  milk_dairy: '#C9D5FF',
  drinking_water: '#B8F2D0',
  household_supplies: '#FFB8A2',
  utilities: '#E5D5FF',
  other: '#FFD6E7',
};

export const CATEGORY_EMOJIS: Record<ExpenseCategory, string> = {
  vegetables: '🥬',
  groceries: '🛒',
  milk_dairy: '🥛',
  drinking_water: '💧',
  household_supplies: '🧹',
  utilities: '⚡',
  other: '📦',
};
