export type PlatformRole = "COACH" | "ATHLETE";

export interface AccountResponse {
  id: string;
  displayName: string;
  email: string;
  countryCode: string | null;
  role: string;
  canCoach: boolean;
  canTrain: boolean;
  coachId: string | null;
  coachName: string | null;
  athleteProfileId: string | null;
  bodyWeightKg?: number | null;
  competitionWeightClass?: string | null;
  squatOneRepMaxKg?: number | null;
  benchOneRepMaxKg?: number | null;
  deadliftOneRepMaxKg?: number | null;
  upcomingMeet?: string | null;
  dateOfBirth?: string | null;
  sex?: "Female" | "Male" | "NonBinary" | "PreferNotToSay" | null;
  experience?: "Novice" | "Experienced" | null;
  equipment?: "Classic" | "Equipped" | null;
  federationCode?: string | null;
  competitionAgeDivision?: string | null;
}

export interface SessionResponse {
  accessToken: string;
  account: AccountResponse;
}

export interface InvitationContextResponse {
  coachName: string;
  recipientEmail: string;
  expiresAt: string;
  existingAccount: boolean;
  role: "strength" | "nutrition" | "rehab" | "technique" | "meetDay";
  accessLevel: "readOnly" | "comment" | "program" | "full";
  isPrimary: boolean;
}

export interface CoachInvitationResponse {
  id: string;
  recipientEmail: string;
  expiresAt: string;
  acceptanceUrl: string;
  recipientHasAccount: boolean;
  emailSent: boolean;
}

export type ExerciseBodyPart = "back" | "chest" | "shoulders" | "arms" | "legs" | "glutes" | "core";

export interface ExerciseLibraryItemResponse {
  id: string;
  name: string;
  bodyPart: ExerciseBodyPart;
  isSystem: boolean;
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

export interface LiveTrainingDayUpdateRequest {
  name: string;
  focus: string;
  scheduledFor: string;
  exercises: Array<{
    exerciseId: string;
    name: string;
    exerciseType: LiveTrainingExerciseResponse["exerciseType"];
    sets: number;
    repetitions: number;
    prescriptionMode: LiveTrainingExerciseResponse["prescriptionMode"];
    prescriptionValue: number;
    weightUnit: "kg" | "lb";
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
const requestTimeoutMs = 8_000;

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
      countryCode: "US",
      role: "COACH",
      canCoach: true,
      canTrain: false,
      coachId: null,
      coachName: null,
      athleteProfileId: "profile-coach-taylor"
    }
  },
  {
    password: staticDemoCredentials.athlete.password,
    account: {
      id: "platform-alex-morgan",
      displayName: "Alex Morgan",
      email: staticDemoCredentials.athlete.email,
      countryCode: "US",
      role: "ATHLETE",
      canCoach: false,
      canTrain: true,
      coachId: "c2f9e76a-bc73-43e1-bd0c-0d761cc2bc20",
      coachName: "Coach Taylor",
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      signal: init.signal ?? controller.signal,
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
  finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    let message = response.status === 401
      ? "Your session has expired. Sign in again to continue."
      : "The Iron Forge server could not complete this request.";
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

export function signIn(email: string, password: string, invitationToken?: string) {
  if (isStaticDemo) {
    const demoAccount = staticDemoAccounts.find(({ account, password: demoPassword }) => account.email.toLowerCase() === email.trim().toLowerCase() && demoPassword === password);
    return demoAccount
      ? Promise.resolve({ accessToken: staticDemoToken(demoAccount.account), account: demoAccount.account })
      : staticDemoError("Use one of the supplied Iron Forge demo accounts.", 401);
  }
  return request<SessionResponse>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password, invitationToken }) });
}

export function registerAccount(input: { displayName: string; email: string; password: string; countryCode: string; role: PlatformRole; invitationToken?: string }) {
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

export function updateCurrentAccount(accessToken: string, input: { displayName: string; countryCode?: string; bodyWeightKg?: number; competitionWeightClass?: string; squatOneRepMaxKg?: number; benchOneRepMaxKg?: number; deadliftOneRepMaxKg?: number; upcomingMeet?: string; dateOfBirth?: string; sex?: "Female" | "Male"; experience?: "Novice" | "Experienced"; equipment?: "Classic" | "Equipped"; federationCode?: string; competitionAgeDivision?: string }) {
  if (isStaticDemo) return getCurrentAccount(accessToken);
  return request<AccountResponse>("/api/auth/me", { method: "PATCH", body: JSON.stringify(input) }, accessToken);
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

export function getExerciseLibrary(accessToken: string) {
  if (isStaticDemo) {
    return Promise.resolve([] as ExerciseLibraryItemResponse[]);
  }
  return request<ExerciseLibraryItemResponse[]>("/api/exercise-library", {}, accessToken);
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

export async function getCurrentLiveTrainingLog(accessToken: string): Promise<LiveTrainingLogResponse | null> {
  if (isStaticDemo) {
    return null;
  }
  try {
    return await request<LiveTrainingLogResponse | undefined>("/api/live-training/current", {}, accessToken) ?? null;
  }
  catch (error) {
    throw error;
  }
}

export async function getAthleteLiveTrainingLog(accessToken: string, athleteProfileId: string): Promise<LiveTrainingLogResponse | null> {
  if (isStaticDemo) {
    return null;
  }
  try {
    return await request<LiveTrainingLogResponse | undefined>(`/api/live-training/athletes/${encodeURIComponent(athleteProfileId)}`, {}, accessToken) ?? null;
  }
  catch (error) {
    throw error;
  }
}

export function updateLiveTrainingDay(accessToken: string, trainingDayId: string, update: LiveTrainingDayUpdateRequest) {
  if (isStaticDemo) {
    return Promise.resolve();
  }
  return request<void>(`/api/live-training/days/${encodeURIComponent(trainingDayId)}`, { method: "PUT", body: JSON.stringify(update) }, accessToken);
}

export function removeLiveTrainingBlock(accessToken: string, blockId: string) {
  if (isStaticDemo) {
    return Promise.resolve();
  }
  return request<void>(`/api/live-training/blocks/${encodeURIComponent(blockId)}`, { method: "DELETE" }, accessToken);
}

export function duplicateLiveTrainingWeek(accessToken: string, trainingWeekId: string) {
  if (isStaticDemo) {
    return Promise.resolve();
  }
  return request<void>(`/api/live-training/weeks/${encodeURIComponent(trainingWeekId)}/duplicate`, { method: "POST" }, accessToken);
}

export function duplicateLiveTrainingDay(accessToken: string, trainingDayId: string) {
  if (isStaticDemo) {
    return Promise.resolve();
  }
  return request<void>(`/api/live-training/days/${encodeURIComponent(trainingDayId)}/duplicate`, { method: "POST" }, accessToken);
}

export function synchronizeLoggedSet(accessToken: string, input: LoggedSetRequest) {
  if (isStaticDemo) {
    return staticDemoError("Training synchronization requires the hosted API.");
  }
  return request<SyncCommandOutcome>("/api/sync/logged-set", { method: "POST", body: JSON.stringify(input) }, accessToken);
}

export function leaveCurrentCoach(accessToken: string) {
  return request<AccountResponse>("/api/auth/coach", { method: "DELETE" }, accessToken);
}

export interface CoachingAssignmentResponse {
  id: string;
  coachId: string;
  coachName: string;
  athleteUserId: string;
  athleteName: string;
  role: "strength" | "nutrition" | "rehab" | "technique" | "meetDay";
  accessLevel: "readOnly" | "comment" | "program" | "full";
  status: "pending" | "active" | "completed" | "revoked" | "declined";
  isPrimary: boolean;
  startsAt: string;
  endsAt: string | null;
  movementScope: string | null;
}

export function getCoachingAssignments(accessToken: string) {
  return request<CoachingAssignmentResponse[]>("/api/coaching-assignments", {}, accessToken);
}

export function revokeCoachingAssignment(accessToken: string, assignmentId: string) {
  return request<void>(`/api/coaching-assignments/${encodeURIComponent(assignmentId)}`, { method: "DELETE" }, accessToken);
}

export interface AthleteCareerResponse {
  id: string;
  displayName: string;
  countryCode: string | null;
  sex: string;
  competitionWeightClass: string;
  bestOfficialTotalKg: number;
  availableFederations: Array<{ id: string; code: string; name: string; countryCode: string; websiteUrl: string | null }>;
  memberships: Array<{ id: string; federationCode: string; federationName: string; membershipNumber: string | null; status: string; startsOn: string; endsOn: string | null }>;
  qualificationProgress: Array<{ id: string; federationCode: string; name: string; scope: string; competitionDivision: string; equipmentCategory: string; requiredTotalKg: number; gapKg: number; qualified: boolean; effectiveFrom: string; effectiveTo: string | null; sourceUrl: string; sourceRetrievedAt: string }>;
  qualifierTotals: Array<{ id: string; federationCode: string; federationName: string; name: string; scope: string; competitionDivision: string; equipmentCategory: string; sexCategory: string; weightClass: string; qualifierTotalKg: number; effectiveFrom: string; effectiveTo: string | null; sourceUrl: string; sourceRetrievedAt: string }>;
  results: Array<{ id: string; meetName: string; meetDate: string; countryCode: string; equipmentCategory: string; weightClass: string; totalKg: number; dots: number | null; goodlift: number | null; place: number | null; sourceName: string; sourceUrl: string | null }>;
  rankings: Array<{ id: string; rankingDate: string; scope: string; scopeCode: string; equipmentCategory: string; weightClass: string; metric: string; score: number; rank: number; rankedLifterCount: number; sourceName: string; sourceUrl: string }>;
  externalIdentities: Array<{ id: string; provider: string; externalId: string; profileUrl: string | null; verifiedByAthlete: boolean }>;
  programHistory: Array<{ id: string; name: string; tag: string; startsOn: string; endsOn: string; isActive: boolean; status: "pending" | "accepted" | "declined" | "completed"; coachId: string | null; coachName: string | null }>;
}

function normalizeAthleteCareer(response: AthleteCareerResponse): AthleteCareerResponse {
  return {
    ...response,
    availableFederations: Array.isArray(response.availableFederations) ? response.availableFederations : [],
    memberships: Array.isArray(response.memberships) ? response.memberships : [],
    qualificationProgress: Array.isArray(response.qualificationProgress) ? response.qualificationProgress : [],
    qualifierTotals: Array.isArray(response.qualifierTotals) ? response.qualifierTotals : [],
    results: Array.isArray(response.results) ? response.results : [],
    rankings: Array.isArray(response.rankings) ? response.rankings : [],
    externalIdentities: Array.isArray(response.externalIdentities) ? response.externalIdentities : [],
    programHistory: Array.isArray(response.programHistory) ? response.programHistory : []
  };
}

export function getAthleteCareer(accessToken: string, athleteProfileId: string) {
  if (isStaticDemo) {
    return Promise.resolve<AthleteCareerResponse>({ id: athleteProfileId, displayName: "Demo athlete", countryCode: null, sex: "Unspecified", competitionWeightClass: "Unspecified", bestOfficialTotalKg: 0, availableFederations: [], memberships: [], qualificationProgress: [], qualifierTotals: [], results: [], rankings: [], externalIdentities: [], programHistory: [] });
  }
  return request<AthleteCareerResponse>(`/api/athletes/${encodeURIComponent(athleteProfileId)}/career`, {}, accessToken)
    .then(normalizeAthleteCareer);
}

export function updateAthleteCountry(accessToken: string, athleteProfileId: string, countryCode: string | null) {
  if (isStaticDemo) return Promise.resolve();
  return request<void>(`/api/athletes/${encodeURIComponent(athleteProfileId)}/career/identity`, { method: "PATCH", body: JSON.stringify({ countryCode }) }, accessToken);
}

export function addAthleteFederationMembership(accessToken: string, athleteProfileId: string, input: { federationCode: string; membershipNumber?: string; startsOn: string }) {
  if (isStaticDemo) return staticDemoError("Federation memberships require the hosted API.");
  return request<{ id: string }>(`/api/athletes/${encodeURIComponent(athleteProfileId)}/career/memberships`, { method: "POST", body: JSON.stringify(input) }, accessToken);
}

export function linkAthleteExternalIdentity(accessToken: string, athleteProfileId: string, input: { provider: string; externalId: string; profileUrl?: string }) {
  if (isStaticDemo) return staticDemoError("External competition identities require the hosted API.");
  return request<{ id: string }>(`/api/athletes/${encodeURIComponent(athleteProfileId)}/career/external-identities`, { method: "POST", body: JSON.stringify(input) }, accessToken);
}

export function acceptCoachInvitation(accessToken: string, token: string) {
  return request<AccountResponse>(`/api/auth/invitations/${encodeURIComponent(token)}/accept`, { method: "POST" }, accessToken);
}

export interface ProgramTemplateRequest {
  name: string;
  goal: string;
  phase: string | null;
  trainingDaysPerWeek: number;
  weeks: Array<{
    weekNumber: number;
    name: string;
    days: Array<{
      dayNumber: number;
      name: string;
      focus: string;
      exercises: Array<{
        sortOrder: number;
        name: string;
        exerciseType: LiveTrainingExerciseResponse["exerciseType"];
        sets: number;
        repetitions: number;
        prescriptionMode: LiveTrainingExerciseResponse["prescriptionMode"];
        prescriptionValue: number;
        weightUnit: "kg" | "lb";
      }>;
    }>;
  }>;
}

export interface ProgramTemplateResponse extends Omit<ProgramTemplateRequest, "weeks"> {
  id: string;
  updatedAt: string;
  weeks: Array<Omit<ProgramTemplateRequest["weeks"][number], "days"> & {
    id: string;
    days: Array<Omit<ProgramTemplateRequest["weeks"][number]["days"][number], "exercises"> & {
      id: string;
      exercises: Array<ProgramTemplateRequest["weeks"][number]["days"][number]["exercises"][number] & { id: string }>;
    }>;
  }>;
}

export interface ProgramAssignmentResponse {
  id: string;
  athleteProfileId: string;
  programTemplateId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  status: "pending" | "accepted" | "declined" | "completed";
}

export interface ProgramOfferResponse {
  id: string;
  name: string;
  coachName: string;
  phase: string | null;
  goal: string;
  trainingDaysPerWeek: number;
  startsOn: string;
  endsOn: string;
  offeredAt: string;
}

export function createProgramTemplate(accessToken: string, template: ProgramTemplateRequest) {
  if (isStaticDemo) {
    return staticDemoError("Hosted program assignment requires the API.");
  }
  return request<ProgramTemplateResponse>("/api/program-templates", { method: "POST", body: JSON.stringify(template) }, accessToken);
}

export function getProgramTemplates(accessToken: string) {
  if (isStaticDemo) return Promise.resolve([] as ProgramTemplateResponse[]);
  return request<ProgramTemplateResponse[]>("/api/program-templates", {}, accessToken);
}

export function replaceProgramTemplate(accessToken: string, templateId: string, template: ProgramTemplateRequest) {
  if (isStaticDemo) return staticDemoError("Hosted template updates require the API.");
  return request<void>(`/api/program-templates/${encodeURIComponent(templateId)}`, { method: "PUT", body: JSON.stringify(template) }, accessToken);
}

export function deleteProgramTemplate(accessToken: string, templateId: string) {
  if (isStaticDemo) return staticDemoError("Hosted template deletion requires the API.");
  return request<void>(`/api/program-templates/${encodeURIComponent(templateId)}`, { method: "DELETE" }, accessToken);
}

export function shareProgramTemplate(accessToken: string, templateId: string, recipientEmail: string) {
  if (isStaticDemo) return staticDemoError("Template sharing requires the hosted API.");
  return request<ProgramTemplateResponse>(`/api/program-templates/${encodeURIComponent(templateId)}/shares`, {
    method: "POST",
    body: JSON.stringify({ recipientEmail })
  }, accessToken);
}

export function assignProgramTemplate(accessToken: string, templateId: string, athleteProfileId: string, startDate: string) {
  if (isStaticDemo) {
    return staticDemoError("Hosted program assignment requires the API.");
  }
  return request<ProgramAssignmentResponse>(`/api/program-templates/${encodeURIComponent(templateId)}/assignments`, {
    method: "POST",
    body: JSON.stringify({ athleteProfileId, startDate })
  }, accessToken);
}

export function getProgramOffers(accessToken: string) {
  if (isStaticDemo) {
    return Promise.resolve([] as ProgramOfferResponse[]);
  }
  return request<ProgramOfferResponse[]>("/api/live-training/offers", {}, accessToken);
}

export function acceptProgramOffer(accessToken: string, offerId: string) {
  if (isStaticDemo) {
    return staticDemoError("Program offers require the hosted API.");
  }
  return request<LiveTrainingLogResponse>(`/api/live-training/offers/${encodeURIComponent(offerId)}/accept`, { method: "POST" }, accessToken);
}

export function declineProgramOffer(accessToken: string, offerId: string) {
  if (isStaticDemo) {
    return staticDemoError("Program offers require the hosted API.");
  }
  return request<void>(`/api/live-training/offers/${encodeURIComponent(offerId)}/decline`, { method: "POST" }, accessToken);
}

export function activateTrainingBlock(accessToken: string, blockId: string) {
  if (isStaticDemo) {
    return staticDemoError("Switching training blocks requires the hosted API.");
  }
  return request<LiveTrainingLogResponse>(`/api/live-training/blocks/${encodeURIComponent(blockId)}/activate`, { method: "POST" }, accessToken);
}