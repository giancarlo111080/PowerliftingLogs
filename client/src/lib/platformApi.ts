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

export type PerformanceEventKind = "recoveryCheckIn" | "techniqueObservation" | "recommendation" | "coachDecision" | "programVersion" | "competitionPlan" | "competitionAttempt" | "competitionResult" | "consentGrant" | "modelPrediction" | "videoAnnotation" | "athleteGroup" | "exerciseLibraryItem" | "exceptionDisposition";

export interface PerformanceEventResponse<TPayload extends object = Record<string, unknown>> {
  id: string;
  tenantId: string;
  athleteProfileId: string;
  actorUserId: string | null;
  kind: PerformanceEventKind;
  occurredAtUtc: string;
  source: string;
  schemaVersion: number;
  provenance: string;
  payload: TPayload;
  correlationId: string | null;
  stableKey: string | null;
  createdAt: string;
}

export interface AppendPerformanceEventRequest {
  kind: PerformanceEventKind;
  occurredAtUtc: string;
  source: string;
  schemaVersion: 1;
  provenance: string;
  payload: object;
  correlationId?: string;
  stableKey: string;
}

export type LiveSetCompletionStatus = "pending" | "done" | "skipped";
export type LiveSetOutcomeReason = "failed" | "interrupted" | "rescheduled" | "painLimited" | "unavailableEquipment" | "other";

export interface LiveTrainingSetResponse {
  id: string;
  setNumber: number;
  targetRepetitions: number;
  targetLoadKg: number;
  targetRpe: number;
  completionStatus: LiveSetCompletionStatus;
  actualLoadKg: number | null;
  actualRepetitions: number | null;
  actualRpe: number | null;
  meanVelocityMps: number | null;
  restSeconds: number | null;
  outcomeReason: LiveSetOutcomeReason | null;
  completedAt: string | null;
  instagramVideoUrl: string | null;
}

export interface LiveTrainingExerciseResponse {
  id: string;
  sortOrder: number;
  name: string;
  exerciseType: "squat" | "benchPress" | "deadlift" | "overheadPress" | "accessory" | "conditioning";
  prescriptionMode: "rpe" | "percentageOfOneRepMax" | "exactLoad";
  prescriptionValue: number;
  weightUnit: "kg" | "lb";
  sets: LiveTrainingSetResponse[];
}

export interface LiveTrainingLogResponse {
  id: string;
  athleteProfileId: string;
  coachId: string | null;
  programTemplateId: string | null;
  name: string;
  phase: string | null;
  goal: string;
  trainingDaysPerWeek: number;
  startsOn: string;
  endsOn: string;
  updatedAt: string;
  weeks: Array<{
    id: string;
    weekNumber: number;
    startsOn: string;
    days: Array<{
      id: string;
      name: string;
      focus: string;
      scheduledFor: string;
      exercises: LiveTrainingExerciseResponse[];
    }>;
  }>;
}

export interface LoggedSetRequest {
  idempotencyKey: string;
  athleteProfileId: string;
  trainingSetId: string;
  completionStatus: LiveSetCompletionStatus;
  actualLoadKg: number | null;
  actualRepetitions: number | null;
  actualRpe: number | null;
  actualEstimatedOneRepMaxKg: null;
  actualEffortPercentage: null;
  instagramVideoUrl: string | null;
  athleteNote: string | null;
  meanVelocityMps: number | null;
  restSeconds: number | null;
  outcomeReason: LiveSetOutcomeReason | null;
}

export interface SyncCommandOutcome {
  commandId: string;
  status: "pending" | "processed" | "rejected";
  rejectionReason: string | null;
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

export function getPerformanceEvents(accessToken: string, athleteProfileId: string) {
  if (isStaticDemo) {
    return Promise.resolve([] as PerformanceEventResponse[]);
  }
  return request<PerformanceEventResponse[]>(`/api/performance/athletes/${encodeURIComponent(athleteProfileId)}/events?take=500`, {}, accessToken);
}

export function appendPerformanceEvent(accessToken: string, athleteProfileId: string, event: AppendPerformanceEventRequest) {
  if (isStaticDemo) {
    return staticDemoError("Performance synchronization requires the hosted API.");
  }
  return request<PerformanceEventResponse>(`/api/performance/athletes/${encodeURIComponent(athleteProfileId)}/events`, { method: "POST", body: JSON.stringify(event) }, accessToken);
}

export function exportPerformanceEvents(accessToken: string, athleteProfileId: string) {
  if (isStaticDemo) {
    return staticDemoError("Performance export requires the hosted API.");
  }
  return request<{ athleteProfileId: string; exportedAtUtc: string; schemaVersion: number; events: PerformanceEventResponse[] }>(`/api/performance/athletes/${encodeURIComponent(athleteProfileId)}/export`, {}, accessToken);
}

export function deletePerformanceEvents(accessToken: string, athleteProfileId: string) {
  if (isStaticDemo) {
    return Promise.resolve();
  }
  return request<void>(`/api/performance/athletes/${encodeURIComponent(athleteProfileId)}/events`, { method: "DELETE" }, accessToken);
}

export async function getCurrentLiveTrainingLog(accessToken: string) {
  if (isStaticDemo) {
    return null;
  }
  try {
    return await request<LiveTrainingLogResponse>("/api/live-training/current", {}, accessToken);
  }
  catch (error) {
    if (error instanceof PlatformApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function getAthleteLiveTrainingLog(accessToken: string, athleteProfileId: string) {
  if (isStaticDemo) {
    return null;
  }
  try {
    return await request<LiveTrainingLogResponse>(`/api/live-training/athletes/${encodeURIComponent(athleteProfileId)}`, {}, accessToken);
  }
  catch (error) {
    if (error instanceof PlatformApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function synchronizeLoggedSet(accessToken: string, input: LoggedSetRequest) {
  if (isStaticDemo) {
    return staticDemoError("Training synchronization requires the hosted API.");
  }
  return request<SyncCommandOutcome>("/api/sync/logged-set", { method: "POST", body: JSON.stringify(input) }, accessToken);
}