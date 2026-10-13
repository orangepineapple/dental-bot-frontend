const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Access token lives in memory only. The httpOnly refresh cookie (set by the backend)
// restores it after a page reload via /auth/refresh.
let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // FastAPI validation errors
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => {
        const field = d.loc?.filter((p) => p !== "body").join(".");
        return field ? `${field}: ${d.msg}` : (d.msg ?? "");
      })
      .join("; ");
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (auth && accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the backend running?");
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(body, res.statusText));
  return body as T;
}

export type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  phone_number: string | null;
};
export type User = { id: string; email: string; patient: Patient };
export type RegisterInput = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  phone_number?: string;
};
export const MAX_CONVERSATION_MESSAGES = 100;
export type ChatReply = { conversation_id: string; reply: string; degraded: boolean };

type TokenResponse = { access_token: string };

export async function login(email: string, password: string): Promise<void> {
  const data = await request<TokenResponse>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    false,
  );
  accessToken = data.access_token;
}

export async function register(input: RegisterInput): Promise<User> {
  return request<User>("/auth/register", { method: "POST", body: JSON.stringify(input) }, false);
}

/** Restore a session from the refresh cookie. Concurrent calls share one request
 * because refresh tokens rotate and a second use of the same token would fail. */
export function restoreSession(): Promise<boolean> {
  if (accessToken) return Promise.resolve(true);
  refreshInFlight ??= request<TokenResponse>("/auth/refresh", { method: "POST" }, false)
    .then((data) => {
      accessToken = data.access_token;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export async function logout(): Promise<void> {
  accessToken = null;
  await request<void>("/auth/logout", { method: "POST" }, false).catch(() => undefined);
}

export function getMe(): Promise<User> {
  return request<User>("/auth/me");
}

/** Authenticated request. If the 15-minute access token expired, refresh once and retry. */
async function authedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await request<T>(path, init);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      accessToken = null;
      if (await restoreSession()) return request<T>(path, init);
    }
    throw err;
  }
}

export function sendChatMessage(
  message: string,
  conversationId: string | null,
): Promise<ChatReply> {
  return authedRequest<ChatReply>("/chat/messages", {
    method: "POST",
    body: JSON.stringify({ message, conversation_id: conversationId }),
  });
}

export type ConversationSummary = {
  id: string;
  title: string;
  message_count: number;
  updated_at: string;
};
export type TranscriptMessage = {
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export function listConversations(): Promise<ConversationSummary[]> {
  return authedRequest<ConversationSummary[]>("/chat/conversations");
}

export function getConversationMessages(id: string): Promise<TranscriptMessage[]> {
  return authedRequest<TranscriptMessage[]>(`/chat/conversations/${id}/messages`);
}
