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

export async function sendChatMessage(
  message: string,
  conversationId: string | null,
): Promise<ChatReply> {
  const body = { message, conversation_id: conversationId };
  try {
    return await request<ChatReply>("/chat/messages", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Access token expired (15 min): refresh once and retry.
    if (err instanceof ApiError && err.status === 401) {
      accessToken = null;
      if (await restoreSession()) {
        return request<ChatReply>("/chat/messages", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
    }
    throw err;
  }
}
