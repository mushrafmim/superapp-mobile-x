import { useState, useEffect, useMemo, useCallback } from "react";
import { Leave, LeaveType, LeaveStatus, UserInfo, CreateLeaveRequest } from "../types";
import { api } from "../api/client";
import { formatDuration } from "../utils/formatters";

interface UseLeavesProps {
  token: string | null;
  isAdmin: boolean;
  user: UserInfo | null;
}

export const useLeaves = ({ token, isAdmin, user }: UseLeavesProps) => {
  const [rawLeaves, setRawLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [holidays, setHolidays] = useState<string[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<LeaveType | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchLeaves = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getLeaves(token);
      setRawLeaves(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchHolidays = useCallback(async () => {
    if (!token) return;

    try {
      const data = await api.getHolidays(token);
      const holidayDates = data.map((h) => h.date);
      setHolidays(holidayDates);
    } catch (e) {
      console.error("Failed to fetch holidays", e);
    }
  }, [token]);

  useEffect(() => {
    fetchLeaves();
    fetchHolidays();
  }, [fetchLeaves, fetchHolidays, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const balances = useMemo(() => {
    if (!user) return { sick: 0, annual: 0, casual: 0 };

    const myActiveLeaves = rawLeaves.filter(
      (l) =>
        l.userId === user.id &&
        (l.status === "approved" || l.status === "pending"),
    );

    const used = { sick: 0, annual: 0, casual: 0 };

    myActiveLeaves.forEach((l) => {
      const days = l.totalLeaveDays;
      if (used[l.type] !== undefined) {
        used[l.type] += days;
      }
    });

    return {
      sick: Math.max(0, user.allowances.sick - used.sick),
      annual: Math.max(0, user.allowances.annual - used.annual),
      casual: Math.max(0, user.allowances.casual - used.casual),
      total: user.allowances,
      used,
    };
  }, [rawLeaves, user, holidays]);

  const leaves = useMemo(() => {
    let data = rawLeaves;

    if (!isAdmin && user) {
      data = data.filter((l) => l.userId === user.id);
    }

    if (search) {
      const lower = search.toLowerCase();
      data = data.filter((l) => l.reason.toLowerCase().includes(lower));
    }

    if (statusFilter !== "all") {
      data = data.filter((l) => l.status === statusFilter);
    }

    if (typeFilter !== "all") {
      data = data.filter((l) => l.type === typeFilter);
    }

    if (startDate) {
      data = data.filter((l) => l.startDate >= startDate);
    }
    if (endDate) {
      data = data.filter((l) => l.startDate <= endDate);
    }

    return data.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [
    rawLeaves,
    isAdmin,
    user,
    search,
    statusFilter,
    typeFilter,
    startDate,
    endDate,
  ]);

  const deleteLeave = async (id: string) => {
    if (!token) return;
    setRawLeaves((prev) => prev.filter((l) => l.id !== id));
    await api.deleteLeave(token, id);
    refresh();
  };

  const approveLeave = async (id: string, comment?: string) => {
    if (!token) return;
    await api.approveLeave(token, id, comment);
    refresh();
  };

  const rejectLeave = async (id: string, comment?: string) => {
    if (!token) return;
    await api.rejectLeave(token, id, comment);
    refresh();
  };

  const createLeave = async (data: CreateLeaveRequest) => {
    if (!token) return;

    const start = new Date(`${data.startDate.split("T")[0].split(" ")[0]}T00:00:00`);
    const end = new Date(`${data.endDate.split("T")[0].split(" ")[0]}T00:00:00`);

    if (start > end) {
      throw new Error("Start date cannot be after end date");
    }

    const days = data.isHalfDay
      ? 0.5
      : formatDuration(data.startDate, data.endDate, holidays);

    const remaining = balances[data.type];

    if (days > remaining) {
      throw new Error(
        `Insufficient ${data.type} leave balance. You have ${remaining} days left.`,
      );
    }

    await api.createLeave(token, data);
    refresh();
  };

  return {
    leaves,
    rawLeaves,
    holidays,
    balances,
    loading,
    refresh,
    filters: {
      search,
      setSearch,
      statusFilter,
      setStatusFilter,
      typeFilter,
      setTypeFilter,
      startDate,
      setStartDate,
      endDate,
      setEndDate,
    },
    actions: {
      deleteLeave,
      approveLeave,
      rejectLeave,
      createLeave,
    },
  };
};
