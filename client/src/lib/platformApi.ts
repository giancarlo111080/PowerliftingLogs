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

export interface CoachInvitationResponse {
  id: string;
  recipientEmail: string;
  expiresAt: string;
  registrationUrl: string;
  emailSent: boolean;
}

export interface CoachAthleteResponse {
  athleteProfileId: string;
  userId: string;
  displayName: string;
  email: string;
}

export const isStaticDemo = process.env.EXPO_PUBLIC_STATIC_DEMO === "true";
export const staticDemoCredentials = {
  coach: { email: "coach@ironforge.demo", password: "demo-coach" },
  athlete: { email: "athlete@ironforge.demo", password: "demo-athlete" }
} as const;

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5080").replace(/\/$/, "");

export class PlatformApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

const staticDemoAccounts: Array<{ password: string; account: AccountResponse }> = [
  {
    password: staticDemoCredentials.coach.password,
    account: {
      id: "c2f9e76a-bc73-43e1-bd0c-0d761cc2bc20",
      displayName: "Coach Taylor",
      email: staticDemoCredentials.coach.email,
      role: "COACH",
      coachId: null,
      athleteProfileId: null
    }
  },
  {
    password: staticDemoCredentials.athlete.password,
    account: {
      id: "platform-alex-morgan",
      displayName: "Alex Morgan",
      email: staticDemoCredentials.athlete.email,
      role: "ATHLETE",
      coachId: "c2f9e76a-bc73-43e1-bd0c-0d761cc2bc20",
      athleteProfileId: "a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9"
    }
  }
];

const staticDemoAthletes: CoachAthleteResponse[] = [
  { athleteProfileId: "a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9", userId: "platform-alex-morgan", displayName: "Alex Morgan", email: staticDemoCredentials.athlete.email }
];

function staticDemoToken(account: AccountResponse) {
  return `iron-forge-static-demo:${account.id}`;
}

function staticDemoAccount(accessToken: string) {
  return staticDemoAccounts.find(({ account }) => staticDemoToken(account) === accessToken)?.account ?? null;
}

function staticDemoError(message: string, status = 400): Promise<never> {
  return Promise.reject(new PlatformApiError(message, status));
}

async function request<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers
      }
    });
  }
  catch {
    throw new PlatformApiError(`Could not reach the Iron Forge API at ${apiBaseUrl}. Confirm the API is running and restart it after changing CORS settings.`, 0);
  }
  if (!response.ok) {
    let message = "The Iron Forge server could not complete this request.";
    try {
      const payload = await response.json() as { title?: string; detail?: string; errors?: Record<string, string[]> };
      const validationMessage = payload.errors ? Object.values(payload.errors).flat().find(Boolean) : undefined;
      message = validationMessage ?? payload.detail ?? payload.title ?? message;
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
  if (isStaticDemo) {
    const demoAccount = staticDemoAccounts.find(({ account, password: demoPassword }) => account.email.toLowerCase() === email.trim().toLowerCase() && demoPassword === password);
    return demoAccount
      ? Promise.resolve({ accessToken: staticDemoToken(demoAccount.account), account: demoAccount.account })
      : staticDemoError("Use one of the supplied Iron Forge demo accounts.", 401);
  }
  return request<SessionResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function registerAccount(input: { displayName: string; email: string; password: string; role: PlatformRole; invitationToken?: string }) {
  if (isStaticDemo) {
    return staticDemoError("Account registration is unavailable in the static demo. Deploy the API to enable real accounts.");
  }
  return request<SessionResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export function getCurrentAccount(accessToken: string) {
  if (isStaticDemo) {
    const account = staticDemoAccount(accessToken);
    return account ? Promise.resolve(account) : staticDemoError("Your static demo session has expired. Sign in again.", 401);
  }
  return request<AccountResponse>("/api/auth/me", {}, accessToken);
}

export function getInvitationContext(token: string) {
  if (isStaticDemo) {
    return staticDemoError("Coach invitations require the hosted API.", 404);
  }
  return request<InvitationContextResponse>(`/api/auth/invitations/${encodeURIComponent(token)}`);
}

export function getCoachAthletes(accessToken: string) {
  if (isStaticDemo) {
    const account = staticDemoAccount(accessToken);
    return account?.role === "COACH" ? Promise.resolve(staticDemoAthletes) : staticDemoError("Coach access is required.", 403);
  }
  return request<CoachAthleteResponse[]>("/api/coach/athletes", {}, accessToken);
}

export function createAthleteInvitation(accessToken: string, email: string) {
  if (isStaticDemo) {
    return staticDemoError("Coach invitations require the hosted API.");
  }
  return request<CoachInvitationResponse>("/api/coach/athlete-invitations", { method: "POST", body: JSON.stringify({ email }) }, accessToken);
}

export function requestPasswordReset(email: string) {
  if (isStaticDemo) {
    return staticDemoError("Password reset is unavailable for fixed demo accounts. Use a demo workspace button to sign in.");
  }
  return request<{ message: string; resetUrl: string | null }>("/api/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) });
}

export function completePasswordReset(token: string, password: string) {
  if (isStaticDemo) {
    return staticDemoError("Password reset is unavailable for fixed demo accounts.");
  }
  return request<void>("/api/auth/password-reset/complete", { method: "POST", body: JSON.stringify({ token, password }) });
}