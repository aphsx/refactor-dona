import type { PermissionRole } from "@/lib/mill";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

const BASE = "/api/v1";
const TOKEN_KEY = "dona.token";
const SESSION_KEY = "dona.session";

type Actor = {
  role: PermissionRole;
  farmerId?: string;
};

export type AuthSession = {
  token: string;
  username: string;
  displayName: string;
  role: PermissionRole;
};

let actor: Actor = { role: "mill" };
let accessToken = "";

export function setApiActor(next: Actor) {
  actor = next;
}

export function getApiActor() {
  return actor;
}

export function getApiToken() {
  return accessToken;
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession) {
  accessToken = session.token;
  actor = { role: session.role };
  if (typeof window !== "undefined") {
    sessionStorage.setItem(TOKEN_KEY, session.token);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

export function clearAuthSession() {
  accessToken = "";
  actor = { role: "mill" };
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }
}

export function restoreAuthSession() {
  const session = getAuthSession();
  if (!session?.token) {
    clearAuthSession();
    return null;
  }
  accessToken = session.token;
  actor = { role: session.role };
  return session;
}

function requestHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  // kept for compatibility while some tools still send actor headers
  headers["X-Actor-Role"] = actor.role;
  if (actor.farmerId) headers["X-Actor-Farmer-Id"] = actor.farmerId;
  return headers;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...requestHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login") {
      clearAuthSession();
    }
    throw new ApiError(typeof body?.error === "string" ? body.error : "เกิดข้อผิดพลาด", response.status);
  }
  return body as T;
}

export async function apiLogin(username: string, password: string) {
  const data = await apiRequest<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  const session: AuthSession = {
    token: data.token,
    username: data.username,
    displayName: data.displayName || data.username,
    role: data.role,
  };
  setAuthSession(session);
  return session;
}

export async function apiListAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  for (;;) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await apiRequest<Page<T>>(`${path}${sep}page=${page}&pageSize=100`);
    items.push(...(data.items ?? []));
    if (!data.hasMore) break;
    page += 1;
  }
  return items;
}

export function apiMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้";
}
