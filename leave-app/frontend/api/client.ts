import { Leave, UserInfo, Allowances, Holiday, CreateLeaveRequest, UpdateLeaveRequest } from "../types";

// Read the API base URL from environment (Vite provides import.meta.env for client code).
// Use a sensible fallback for local dev when using the Vite dev proxy.
const API_BASE = (import.meta as any).env?.VITE_API_BASE || "/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  // Validate token before making request
  if (!token || token.trim() === "") {
    throw new ApiError(401, "Authentication token is required");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = "An unexpected error occurred";
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      errorMessage = response.statusText;
    }
    throw new ApiError(response.status, errorMessage);
  }

  // Some endpoints might return 204 No Content. Avoid parsing empty body as JSON.
  if (response.status === 204) {
    // Return undefined casted to T for convenience; callers should handle that if needed
    return undefined as unknown as T;
  }

  // Parse JSON body safely
  const text = await response.text();
  if (!text) return undefined as unknown as T;
  return JSON.parse(text) as T;
}

export const api = {
  getMe: async (token: string): Promise<UserInfo> => {
    // log response from debugging
    const response = await request<UserInfo>("/me", token);
    return response;
  },

  getUsers: async (token: string): Promise<UserInfo[]> => {
    return request<UserInfo[]>("/users", token);
  },

  updateGlobalAllowances: async (
    token: string,
    allowances: Allowances,
  ): Promise<void> => {
    return request<void>("/admin/allowances", token, {
      method: "PUT",
      body: JSON.stringify(allowances),
    });
  },

  updateUserRole: async (
    token: string,
    userId: string,
    role: "admin" | "user",
  ): Promise<UserInfo> => {
    return request<UserInfo>(`/users/${userId}/role`, token, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  },

  getLeaves: async (token: string): Promise<Leave[]> => {
    return request<Leave[]>("/leaves", token);
  },

  createLeave: async (
    token: string,
    data: CreateLeaveRequest,
  ): Promise<Leave> => {
    return request<Leave>("/leaves", token, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getLeaveById: async (token: string, id: string): Promise<Leave> => {
    return request<Leave>(`/leaves/${id}`, token);
  },

  updateLeave: async (
    token: string,
    id: string,
    data: UpdateLeaveRequest,
  ): Promise<Leave> => {
    return request<Leave>(`/leaves/${id}`, token, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteLeave: async (token: string, id: string): Promise<void> => {
    return request<void>(`/leaves/${id}`, token, {
      method: "DELETE",
    });
  },

  approveLeave: async (
    token: string,
    id: string,
    comment?: string,
  ): Promise<Leave> => {
    return request<Leave>(`/leaves/${id}`, token, {
      method: "PUT",
      body: JSON.stringify({ status: "approved", comment }),
    });
  },

  rejectLeave: async (
    token: string,
    id: string,
    comment?: string,
  ): Promise<Leave> => {
    return request<Leave>(`/leaves/${id}`, token, {
      method: "PUT",
      body: JSON.stringify({ status: "rejected", comment }),
    });
  },

  getHolidays: async (token: string): Promise<Holiday[]> => {
    return request<Holiday[]>("/holidays", token);
  },
};
