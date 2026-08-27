export type PlatformRole = "COACH" | "ATHLETE";

export interface AccountResponse {
  id: string;
  displayName: string;
  email: string;
  role: string;
  coachId: string | null;
  athleteProfileId: string | null;
}

export interface SessionResponse {
  accessToken: string;
  account: AccountResponse;
}

export interface InvitationContextResponse {
  coachName: string;
  recipientEmail: string;
  expiresAt: string;
}

export interface CoachAthleteResponse {
  athleteProfileId: string;
  userId: string;
  displayName: string;
  email: string;
}

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5080").replace(/\/$/, "");

export class PlatformApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers
    }
  });
  if (!response.ok) {
    let message = "The Iron Forge server could not complete this request.";
    try {
      const payload = await response.json() as { title?: string; detail?: string };
      message = payload.detail ?? payload.title ?? message;
    }
    catch {
    }
    throw new PlatformApiError(message, response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function signIn(email: string, password: string) {
  return request<SessionResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function registerAccount(input: { displayName: string; email: string; password: string; role: PlatformRole; invitationToken?: string }) {
  return request<SessionResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export function getCurrentAccount(accessToken: string) {
  return request<AccountResponse>("/api/auth/me", {}, accessToken);
}

export function getInvitationContext(token: string) {
  return request<InvitationContextResponse>(`/api/auth/invitations/${encodeURIComponent(token)}`);
}

export function getCoachAthletes(accessToken: string) {
  return request<CoachAthleteResponse[]>("/api/coach/athletes", {}, accessToken);
}

export function createAthleteInvitation(accessToken: string, email: string) {
  return request<{ id: string; recipientEmail: string; expiresAt: string; registrationUrl: string }>("/api/coach/athlete-invitations", { method: "POST", body: JSON.stringify({ email }) }, accessToken);
}