export type Role = "user" | "admin";

export type LeaveType = "sick" | "annual" | "casual";

export type LeaveStatus = "pending" | "approved" | "rejected";

export interface Allowances {
  sick: number;
  annual: number;
  casual: number;
}

export interface UserInfo {
  id: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  allowances: Allowances;
}

export interface LeaveDay {
  id: string;
  leaveId: string;
  date: string;
  isHalfDay: boolean;
  halfDayPeriod: "morning" | "evening" | null;
}

export interface Leave {
  id: string;
  userId: string;
  userEmail: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  totalLeaveDays: number;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
  approverComment?: string;
  isHalfDay?: boolean;
  halfDayPeriod?: "morning" | "evening" | null;
  days: LeaveDay[];
}

export interface CreateLeaveRequest {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  isHalfDay?: boolean;
  halfDayPeriod?: "morning" | "evening" | null;
}

export interface UpdateLeaveRequest {
  startDate?: string;
  endDate?: string;
  isHalfDay?: boolean;
  halfDayPeriod?: "morning" | "evening" | null;
  status?: LeaveStatus;
  comment?: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface LeaveSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  byType: Record<LeaveType, number>;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // "YYYY-MM-DD"
}
