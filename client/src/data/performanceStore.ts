import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";

import { useSession } from "../auth/AuthSessionContext";
import { appendPerformanceEvent, deletePerformanceEvents, exportPerformanceEvents, getPerformanceEvents, isStaticDemo, type AppendPerformanceEventRequest, type PerformanceEventKind, type PerformanceEventResponse } from "../lib/platformApi";
import type { AdaptiveRecommendation, RecoverySignal } from "./adaptiveEngine";
import type { ExerciseCategory, PrescriptionMode, TrainingProgram, WeightUnit } from "./programWorkspaceStore";

export interface RecoveryCheckIn extends RecoverySignal {
  id: string;
  athleteId: string;
  bodyWeightKg?: number;
  notes?: string;
  cycleContext?: string;
}

export interface MeetPlan {
  athleteId: string;
  meetDate: string;
  federation: string;
  targetLift: "squat" | "bench" | "deadlift";
  targetKg: number;
  barWeightKg: number;
  collarWeightKg?: number;
  displayUnit?: "kg" | "lb";
  plateInventory?: Array<{ weightKg: number; leftCount: number; rightCount: number }>;
  flightsAway: number;
  liftersPerFlight: number;
  liftersAhead?: number;
  weighInAt?: string;
  sessionStartAt?: string;
  attempts: Record<"squat" | "bench" | "deadlift", [number, number, number]>;
  checklist: Record<string, boolean>;
  rulesEffectiveDate?: string;
  rulesCachedAt?: string;
  revision?: number;
  updatedAt: string;
}

export interface CompetitionAttemptRecord {
  id: string;
  athleteId: string;
  meetDate: string;
  lift: "squat" | "bench" | "deadlift";
  attemptNumber: 1 | 2 | 3;
  weightKg: number;
  status: "submitted" | "changed";
  sequence: number;
  recordedAt: string;
}

export interface CompetitionResultRecord {
  id: string;
  athleteId: string;
  attemptId: string;
  meetDate: string;
  lift: "squat" | "bench" | "deadlift";
  attemptNumber: 1 | 2 | 3;
  weightKg: number;
  outcome: "good" | "missed";
  sequence: number;
  recordedAt: string;
}

export interface MeetPlanConflict {
  athleteId: string;
  revision: number;
  local: MeetPlan;
  remote: MeetPlan;
  detectedAt: string;
}

export interface CoachDecision {
  id: string;
  coachId: string;
  athleteId: string;
  programId?: string;
  recommendationId?: string;
  action: string;
  status: "approved" | "rejected" | "journal";
  reason: string;
  before?: string;
  after?: string;
  expectedOutcome?: string;
  reviewDate?: string;
  baselineMetrics?: CoachDecisionMetrics;
  reviewMetrics?: CoachDecisionMetrics;
  outcome?: "improved" | "neutral" | "worsened" | "inconclusive";
  actualOutcome?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface CoachDecisionMetrics {
  readiness: number;
  fatigue: number;
  adherencePercent: number;
  averageRpeError: number | null;
  recordedAt: string;
}

export interface ExceptionDisposition {
  id: string;
  coachId: string;
  athleteId: string;
  exceptionKey: string;
  status: "snoozed" | "resolved";
  note?: string;
  snoozedUntil?: string;
  createdAt: string;
}

export interface ExerciseLibraryItem {
  id: string;
  coachId: string;
  name: string;
  category: ExerciseCategory;
  sets: number;
  repetitions: number;
  prescriptionMode: PrescriptionMode;
  prescriptionValue: number;
  weightUnit: WeightUnit;
  tags: string[];
  notes?: string;
  updatedAt: string;
}

export interface ProgramVersionRecord {
  id: string;
  programId: string;
  athleteId: string;
  coachId: string;
  version: number;
  reason: string;
  createdAt: string;
  snapshot: TrainingProgram;
}

export interface VideoAnnotation {
  id: string;
  athleteId: string;
  coachId: string;
  analysisKey: string;
  timestampSeconds: number;
  body: string;
  createdAt: string;
}

export interface AthleteGroup {
  id: string;
  coachId: string;
  name: string;
  athleteIds: string[];
  createdAt: string;
}

export interface ConsentSettings {
  athleteId: string;
  operationalData: boolean;
  modelTraining: boolean;
  videoModelTraining: boolean;
  updatedAt: string;
}

interface PendingPerformanceEvent extends AppendPerformanceEventRequest {
  queueId: string;
  athleteId: string;
  ownerUserId: string;
}

interface PendingPerformanceDeletion {
  athleteId: string;
  ownerUserId: string;
}

interface PerformanceSnapshot {
  recovery: RecoveryCheckIn[];
  recommendations: AdaptiveRecommendation[];
  meetPlans: MeetPlan[];
  competitionAttempts: CompetitionAttemptRecord[];
  competitionResults: CompetitionResultRecord[];
  meetPlanConflicts: MeetPlanConflict[];
  decisions: CoachDecision[];
  versions: ProgramVersionRecord[];
  annotations: VideoAnnotation[];
  groups: AthleteGroup[];
  consents: ConsentSettings[];
  exceptionDispositions: ExceptionDisposition[];
  exerciseLibrary: ExerciseLibraryItem[];
  pendingEvents: PendingPerformanceEvent[];
  pendingDeletions: PendingPerformanceDeletion[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncError: string | null;
  lastSyncedAt: string | null;
}

interface PerformanceStore extends PerformanceSnapshot {
  saveRecovery: (input: Omit<RecoveryCheckIn, "id" | "recordedAt">) => Promise<void>;
  recordRecommendation: (recommendation: AdaptiveRecommendation) => Promise<void>;
  saveMeetPlan: (plan: Omit<MeetPlan, "updatedAt" | "revision"> & { revision?: number }, expectedRevision?: number) => Promise<void>;
  resolveMeetPlanConflict: (athleteId: string, choice: "local" | "remote") => Promise<void>;
  recordCompetitionAttempt: (attempt: Omit<CompetitionAttemptRecord, "id" | "sequence" | "recordedAt">) => Promise<CompetitionAttemptRecord>;
  recordCompetitionResult: (result: Omit<CompetitionResultRecord, "id" | "sequence" | "recordedAt">) => Promise<void>;
  recordDecision: (decision: Omit<CoachDecision, "id" | "createdAt">) => Promise<void>;
  reviewDecision: (decisionId: string, outcome: NonNullable<CoachDecision["outcome"]>, actualOutcome: string, reviewMetrics: CoachDecisionMetrics) => Promise<void>;
  recordVersion: (input: Omit<ProgramVersionRecord, "id" | "version" | "createdAt">) => Promise<void>;
  addAnnotation: (annotation: Omit<VideoAnnotation, "id" | "createdAt">) => Promise<void>;
  saveGroup: (group: Omit<AthleteGroup, "id" | "createdAt"> & { id?: string }) => Promise<void>;
  saveExceptionDisposition: (disposition: Omit<ExceptionDisposition, "id" | "createdAt">) => Promise<void>;
  saveExerciseLibraryItem: (athleteId: string, item: Omit<ExerciseLibraryItem, "id" | "updatedAt"> & { id?: string }) => Promise<void>;
  setConsent: (consent: Omit<ConsentSettings, "updatedAt">) => Promise<void>;
  deleteAthleteData: (athleteId: string) => Promise<void>;
  syncNow: () => Promise<void>;
  exportAthleteData: (athleteId: string) => Promise<string>;
}

const storageKey = "iron-forge/performance-domain-v1";
const listeners = new Set<() => void>();
let data: PerformanceSnapshot = { recovery: [], recommendations: [], meetPlans: [], competitionAttempts: [], competitionResults: [], meetPlanConflicts: [], decisions: [], versions: [], annotations: [], groups: [], consents: [], exceptionDispositions: [], exerciseLibrary: [], pendingEvents: [], pendingDeletions: [], isLoading: true, isSyncing: false, lastSyncError: null, lastSyncedAt: null };
let loadPromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();
let syncQueue = Promise.resolve();

function id(prefix: string) {
  return `${prefix}-${typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function publish(next: PerformanceSnapshot) {
  data = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return data;
}

async function restore() {
  try {
    const stored = await AsyncStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<PerformanceSnapshot>;
      publish({
        recovery: Array.isArray(parsed.recovery) ? parsed.recovery : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        meetPlans: Array.isArray(parsed.meetPlans) ? parsed.meetPlans : [],
        competitionAttempts: Array.isArray(parsed.competitionAttempts) ? parsed.competitionAttempts : [],
        competitionResults: Array.isArray(parsed.competitionResults) ? parsed.competitionResults : [],
        meetPlanConflicts: Array.isArray(parsed.meetPlanConflicts) ? parsed.meetPlanConflicts : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        versions: Array.isArray(parsed.versions) ? parsed.versions : [],
        annotations: Array.isArray(parsed.annotations) ? parsed.annotations : [],
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        consents: Array.isArray(parsed.consents) ? parsed.consents : [],
        exceptionDispositions: Array.isArray(parsed.exceptionDispositions) ? parsed.exceptionDispositions : [],
        exerciseLibrary: Array.isArray(parsed.exerciseLibrary) ? parsed.exerciseLibrary : [],
        pendingEvents: Array.isArray(parsed.pendingEvents) ? parsed.pendingEvents : [],
        pendingDeletions: Array.isArray(parsed.pendingDeletions) ? parsed.pendingDeletions : [],
        isLoading: false,
        isSyncing: false,
        lastSyncError: typeof parsed.lastSyncError === "string" ? parsed.lastSyncError : null,
        lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null
      });
      return;
    }
  }
  catch {
  }
  publish({ ...data, isLoading: false });
}

function ensureLoaded() {
  loadPromise ??= restore();
  return loadPromise;
}

async function persist(next: PerformanceSnapshot) {
  const previous = data;
  publish(next);
  const write = writeQueue.then(() => AsyncStorage.setItem(storageKey, JSON.stringify({ ...next, isLoading: undefined, isSyncing: undefined })));
  writeQueue = write.catch(() => undefined);
  try {
    await write;
  }
  catch (error) {
    if (data === next) publish(previous);
    throw error;
  }
}

function upsertById<T extends { id: string }>(items: T[], next: T) {
  return [...items.filter((item) => item.id !== next.id), next];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeRemoteEvents(current: PerformanceSnapshot, events: PerformanceEventResponse[]) {
  let next = current;
  for (const event of [...events].reverse()) {
    if (!isRecord(event.payload)) continue;
    const payload = event.payload;
    if (event.kind === "recoveryCheckIn" && typeof payload.id === "string" && typeof payload.athleteId === "string") {
      next = { ...next, recovery: upsertById(next.recovery, payload as unknown as RecoveryCheckIn) };
    }
    else if (event.kind === "recommendation" && typeof payload.id === "string" && typeof payload.athleteId === "string") {
      next = { ...next, recommendations: upsertById(next.recommendations, payload as unknown as AdaptiveRecommendation) };
    }
    else if (event.kind === "competitionPlan" && typeof payload.athleteId === "string") {
      const plan = payload as unknown as MeetPlan;
      const local = next.meetPlans.find((item) => item.athleteId === plan.athleteId);
      const localRevision = local?.revision ?? 0;
      const remoteRevision = plan.revision ?? 0;
      if (local && localRevision === remoteRevision && JSON.stringify(local) !== JSON.stringify(plan)) {
        const conflict: MeetPlanConflict = { athleteId: plan.athleteId, revision: localRevision, local, remote: plan, detectedAt: new Date().toISOString() };
        next = { ...next, meetPlans: [...next.meetPlans.filter((item) => item.athleteId !== plan.athleteId), local.updatedAt >= plan.updatedAt ? local : plan], meetPlanConflicts: [...next.meetPlanConflicts.filter((item) => item.athleteId !== plan.athleteId), conflict] };
      }
      else if (!local || remoteRevision > localRevision || (remoteRevision === localRevision && plan.updatedAt > local.updatedAt)) {
        next = { ...next, meetPlans: [...next.meetPlans.filter((item) => item.athleteId !== plan.athleteId), plan] };
      }
    }
    else if (event.kind === "competitionAttempt" && typeof payload.id === "string" && typeof payload.athleteId === "string") {
      next = { ...next, competitionAttempts: upsertById(next.competitionAttempts, payload as unknown as CompetitionAttemptRecord) };
    }
    else if (event.kind === "competitionResult" && typeof payload.id === "string" && typeof payload.athleteId === "string") {
      next = { ...next, competitionResults: upsertById(next.competitionResults, payload as unknown as CompetitionResultRecord) };
    }
    else if (event.kind === "coachDecision" && typeof payload.id === "string" && typeof payload.athleteId === "string") {
      next = { ...next, decisions: upsertById(next.decisions, payload as unknown as CoachDecision) };
    }
    else if (event.kind === "programVersion" && typeof payload.id === "string" && typeof payload.athleteId === "string") {
      next = { ...next, versions: upsertById(next.versions, payload as unknown as ProgramVersionRecord) };
    }
    else if (event.kind === "videoAnnotation" && typeof payload.id === "string" && typeof payload.athleteId === "string") {
      next = { ...next, annotations: upsertById(next.annotations, payload as unknown as VideoAnnotation) };
    }
    else if (event.kind === "athleteGroup" && typeof payload.id === "string") {
      next = { ...next, groups: upsertById(next.groups, payload as unknown as AthleteGroup) };
    }
    else if (event.kind === "consentGrant" && typeof payload.athleteId === "string") {
      const consent = payload as unknown as ConsentSettings;
      const localConsent = next.consents.find((item) => item.athleteId === consent.athleteId);
      if (!localConsent || localConsent.updatedAt <= consent.updatedAt) {
        next = { ...next, consents: [...next.consents.filter((item) => item.athleteId !== consent.athleteId), consent] };
      }
    }
    else if (event.kind === "exceptionDisposition" && typeof payload.id === "string" && typeof payload.athleteId === "string") {
      next = { ...next, exceptionDispositions: upsertById(next.exceptionDispositions, payload as unknown as ExceptionDisposition) };
    }
    else if (event.kind === "exerciseLibraryItem" && typeof payload.id === "string" && typeof payload.coachId === "string") {
      const item = payload as unknown as ExerciseLibraryItem;
      const localItem = next.exerciseLibrary.find((candidate) => candidate.id === item.id);
      if (!localItem || localItem.updatedAt <= item.updatedAt) {
        next = { ...next, exerciseLibrary: upsertById(next.exerciseLibrary, item) };
      }
    }
  }
  return next;
}

async function synchronize(accessToken: string, ownerUserId: string, athleteId: string) {
  if (isStaticDemo || !athleteId) return;
  const sync = syncQueue.then(async () => {
    publish({ ...data, isSyncing: true, lastSyncError: null });
    try {
      const completedDeletionKeys: string[] = [];
      for (const deletion of data.pendingDeletions.filter((item) => item.ownerUserId === ownerUserId)) {
        await deletePerformanceEvents(accessToken, deletion.athleteId);
        completedDeletionKeys.push(`${deletion.ownerUserId}:${deletion.athleteId}`);
      }
      const completedQueueIds: string[] = [];
      for (const event of data.pendingEvents.filter((item) => item.ownerUserId === ownerUserId)) {
        const { queueId, athleteId: eventAthleteId, ownerUserId: _, ...request } = event;
        await appendPerformanceEvent(accessToken, eventAthleteId, request);
        completedQueueIds.push(queueId);
      }
      const remoteEvents = await getPerformanceEvents(accessToken, athleteId);
      const withoutCompleted = {
        ...data,
        pendingEvents: data.pendingEvents.filter((item) => !completedQueueIds.includes(item.queueId)),
        pendingDeletions: data.pendingDeletions.filter((item) => !completedDeletionKeys.includes(`${item.ownerUserId}:${item.athleteId}`)),
        isSyncing: false,
        lastSyncError: null,
        lastSyncedAt: new Date().toISOString()
      };
      await persist(mergeRemoteEvents(withoutCompleted, remoteEvents));
    }
    catch (error) {
      await persist({ ...data, isSyncing: false, lastSyncError: error instanceof Error ? error.message : "Performance data could not be synchronized." });
    }
  });
  syncQueue = sync.catch(() => undefined);
  return sync;
}

export function usePerformanceStore(): PerformanceStore {
  const { session } = useSession();
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => { void ensureLoaded(); }, []);
  useEffect(() => {
    if (!session?.activeAthleteId) return;
    void ensureLoaded().then(() => synchronize(session.accessToken, session.userId, session.activeAthleteId));
  }, [session?.accessToken, session?.activeAthleteId, session?.userId]);

  function queuedEvent(kind: PerformanceEventKind, athleteId: string, occurredAtUtc: string, payload: object, provenance: string): PendingPerformanceEvent | null {
    if (!session || isStaticDemo) return null;
    const queueId = id("event");
    return { queueId, ownerUserId: session.userId, athleteId, kind, occurredAtUtc, source: "expo-client", schemaVersion: 1, provenance, payload, stableKey: `${athleteId}:${kind}:${queueId}` };
  }

  async function commit(next: PerformanceSnapshot, event: PendingPerformanceEvent | null) {
    await persist({ ...next, pendingEvents: event ? [...data.pendingEvents, event] : data.pendingEvents });
    if (event && session) void synchronize(session.accessToken, session.userId, event.athleteId);
  }

  async function saveRecovery(input: Omit<RecoveryCheckIn, "id" | "recordedAt">) {
    await ensureLoaded();
    const record = { ...input, id: id("recovery"), recordedAt: new Date().toISOString() };
    await commit({ ...data, recovery: [...data.recovery, record] }, queuedEvent("recoveryCheckIn", input.athleteId, record.recordedAt, record, "athlete recovery check-in"));
  }

  async function recordRecommendation(recommendation: AdaptiveRecommendation) {
    await ensureLoaded();
    if (data.recommendations.some((item) => item.id === recommendation.id && item.generatedAt === recommendation.generatedAt)) return;
    await commit({ ...data, recommendations: upsertById(data.recommendations, recommendation) }, queuedEvent("recommendation", recommendation.athleteId, recommendation.generatedAt, recommendation, `${recommendation.ruleVersion} recommendation evidence`));
  }

  async function saveMeetPlan(plan: Omit<MeetPlan, "updatedAt" | "revision"> & { revision?: number }, expectedRevision?: number) {
    await ensureLoaded();
    const existing = data.meetPlans.find((item) => item.athleteId === plan.athleteId);
    const currentRevision = existing?.revision ?? 0;
    if (expectedRevision !== undefined && expectedRevision !== currentRevision) throw new Error("The meet plan changed on another device. Resolve the latest version before saving.");
    const record: MeetPlan = { ...plan, revision: currentRevision + 1, updatedAt: new Date().toISOString() };
    await commit({ ...data, meetPlans: [...data.meetPlans.filter((item) => item.athleteId !== plan.athleteId), record], meetPlanConflicts: data.meetPlanConflicts.filter((item) => item.athleteId !== plan.athleteId) }, queuedEvent("competitionPlan", plan.athleteId, record.updatedAt, record, `athlete meet-day plan revision ${record.revision}`));
  }

  async function resolveMeetPlanConflict(athleteId: string, choice: "local" | "remote") {
    await ensureLoaded();
    const conflict = data.meetPlanConflicts.find((item) => item.athleteId === athleteId);
    if (!conflict) return;
    const selected = conflict[choice];
    const record: MeetPlan = { ...selected, revision: Math.max(conflict.local.revision ?? 0, conflict.remote.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
    await commit({ ...data, meetPlans: [...data.meetPlans.filter((item) => item.athleteId !== athleteId), record], meetPlanConflicts: data.meetPlanConflicts.filter((item) => item.athleteId !== athleteId) }, queuedEvent("competitionPlan", athleteId, record.updatedAt, record, `resolved meet-plan conflict using ${choice} revision`));
  }

  async function recordCompetitionAttempt(attempt: Omit<CompetitionAttemptRecord, "id" | "sequence" | "recordedAt">) {
    await ensureLoaded();
    const sequence = Math.max(0, ...data.competitionAttempts.filter((item) => item.athleteId === attempt.athleteId).map((item) => item.sequence), ...data.competitionResults.filter((item) => item.athleteId === attempt.athleteId).map((item) => item.sequence)) + 1;
    const record: CompetitionAttemptRecord = { ...attempt, id: id("attempt"), sequence, recordedAt: new Date().toISOString() };
    await commit({ ...data, competitionAttempts: [...data.competitionAttempts, record] }, queuedEvent("competitionAttempt", attempt.athleteId, record.recordedAt, record, `meet attempt ${attempt.lift} ${attempt.attemptNumber}`));
    return record;
  }

  async function recordCompetitionResult(result: Omit<CompetitionResultRecord, "id" | "sequence" | "recordedAt">) {
    await ensureLoaded();
    const sequence = Math.max(0, ...data.competitionAttempts.filter((item) => item.athleteId === result.athleteId).map((item) => item.sequence), ...data.competitionResults.filter((item) => item.athleteId === result.athleteId).map((item) => item.sequence)) + 1;
    const record: CompetitionResultRecord = { ...result, id: id("result"), sequence, recordedAt: new Date().toISOString() };
    await commit({ ...data, competitionResults: [...data.competitionResults, record] }, queuedEvent("competitionResult", result.athleteId, record.recordedAt, record, `meet result ${result.lift} ${result.attemptNumber}`));
  }

  async function recordDecision(decision: Omit<CoachDecision, "id" | "createdAt">) {
    await ensureLoaded();
    const record = { ...decision, id: id("decision"), createdAt: new Date().toISOString() };
    await commit({ ...data, decisions: [...data.decisions, record] }, queuedEvent("coachDecision", decision.athleteId, record.createdAt, record, "coach decision workflow"));
  }

  async function reviewDecision(decisionId: string, outcome: NonNullable<CoachDecision["outcome"]>, actualOutcome: string, reviewMetrics: CoachDecisionMetrics) {
    await ensureLoaded();
    const existing = data.decisions.find((item) => item.id === decisionId);
    if (!existing) throw new Error("The decision no longer exists.");
    if (!actualOutcome.trim()) throw new Error("Describe the observed outcome before completing the review.");
    const record = { ...existing, outcome, actualOutcome: actualOutcome.trim(), reviewMetrics, reviewedAt: new Date().toISOString() };
    await commit({ ...data, decisions: upsertById(data.decisions, record) }, queuedEvent("coachDecision", existing.athleteId, record.reviewedAt, record, "coach intervention outcome review"));
  }

  async function recordVersion(input: Omit<ProgramVersionRecord, "id" | "version" | "createdAt">) {
    await ensureLoaded();
    const version = Math.max(0, ...data.versions.filter((item) => item.programId === input.programId).map((item) => item.version)) + 1;
    const record = { ...input, id: id("version"), version, createdAt: new Date().toISOString(), snapshot: JSON.parse(JSON.stringify(input.snapshot)) as TrainingProgram };
    await commit({ ...data, versions: [...data.versions, record] }, queuedEvent("programVersion", input.athleteId, record.createdAt, record, `immutable program version ${version}`));
  }

  async function addAnnotation(annotation: Omit<VideoAnnotation, "id" | "createdAt">) {
    await ensureLoaded();
    const record = { ...annotation, id: id("annotation"), createdAt: new Date().toISOString() };
    await commit({ ...data, annotations: [...data.annotations, record] }, queuedEvent("videoAnnotation", annotation.athleteId, record.createdAt, record, `time-coded review at ${annotation.timestampSeconds}s`));
  }

  async function saveGroup(group: Omit<AthleteGroup, "id" | "createdAt"> & { id?: string }) {
    await ensureLoaded();
    const next = { ...group, id: group.id ?? id("group"), createdAt: data.groups.find((item) => item.id === group.id)?.createdAt ?? new Date().toISOString() };
    const athleteId = next.athleteIds[0];
    await commit({ ...data, groups: [...data.groups.filter((item) => item.id !== next.id), next] }, athleteId ? queuedEvent("athleteGroup", athleteId, new Date().toISOString(), next, "coach athlete-group assignment") : null);
  }

  async function saveExceptionDisposition(disposition: Omit<ExceptionDisposition, "id" | "createdAt">) {
    await ensureLoaded();
    const record = { ...disposition, id: id("disposition"), createdAt: new Date().toISOString() };
    await commit({ ...data, exceptionDispositions: [...data.exceptionDispositions, record] }, queuedEvent("exceptionDisposition", disposition.athleteId, record.createdAt, record, `coach ${disposition.status} exception`));
  }

  async function saveExerciseLibraryItem(athleteId: string, item: Omit<ExerciseLibraryItem, "id" | "updatedAt"> & { id?: string }) {
    await ensureLoaded();
    const record = { ...item, id: item.id ?? id("exercise"), name: item.name.trim(), tags: item.tags.map((tag) => tag.trim()).filter(Boolean), updatedAt: new Date().toISOString() };
    if (!record.name) throw new Error("Exercise name is required.");
    await commit({ ...data, exerciseLibrary: upsertById(data.exerciseLibrary, record) }, queuedEvent("exerciseLibraryItem", athleteId, record.updatedAt, record, "coach exercise library"));
  }

  async function setConsent(consent: Omit<ConsentSettings, "updatedAt">) {
    await ensureLoaded();
    const record = { ...consent, updatedAt: new Date().toISOString() };
    await commit({ ...data, consents: [...data.consents.filter((item) => item.athleteId !== consent.athleteId), record] }, queuedEvent("consentGrant", consent.athleteId, record.updatedAt, record, "athlete consent preference"));
  }

  async function deleteAthleteData(athleteId: string) {
    await ensureLoaded();
    const pendingDeletions = session && !isStaticDemo ? [...data.pendingDeletions.filter((item) => item.athleteId !== athleteId || item.ownerUserId !== session.userId), { athleteId, ownerUserId: session.userId }] : data.pendingDeletions;
    await persist({ ...data, recovery: data.recovery.filter((item) => item.athleteId !== athleteId), recommendations: data.recommendations.filter((item) => item.athleteId !== athleteId), meetPlans: data.meetPlans.filter((item) => item.athleteId !== athleteId), competitionAttempts: data.competitionAttempts.filter((item) => item.athleteId !== athleteId), competitionResults: data.competitionResults.filter((item) => item.athleteId !== athleteId), meetPlanConflicts: data.meetPlanConflicts.filter((item) => item.athleteId !== athleteId), decisions: data.decisions.filter((item) => item.athleteId !== athleteId), versions: data.versions.filter((item) => item.athleteId !== athleteId), annotations: data.annotations.filter((item) => item.athleteId !== athleteId), groups: data.groups.map((item) => ({ ...item, athleteIds: item.athleteIds.filter((idValue) => idValue !== athleteId) })), consents: data.consents.filter((item) => item.athleteId !== athleteId), exceptionDispositions: data.exceptionDispositions.filter((item) => item.athleteId !== athleteId), pendingEvents: data.pendingEvents.filter((item) => item.athleteId !== athleteId), pendingDeletions });
    if (session) void synchronize(session.accessToken, session.userId, athleteId);
  }

  async function syncNow() {
    await ensureLoaded();
    if (session?.activeAthleteId) await synchronize(session.accessToken, session.userId, session.activeAthleteId);
  }

  async function exportAthleteData(athleteId: string) {
    await ensureLoaded();
    if (session && !isStaticDemo) {
      try {
        return JSON.stringify(await exportPerformanceEvents(session.accessToken, athleteId), null, 2);
      }
      catch {
      }
    }
    return JSON.stringify({ athleteId, exportedAtUtc: new Date().toISOString(), schemaVersion: 1, recovery: data.recovery.filter((item) => item.athleteId === athleteId), recommendations: data.recommendations.filter((item) => item.athleteId === athleteId), meetPlans: data.meetPlans.filter((item) => item.athleteId === athleteId), competitionAttempts: data.competitionAttempts.filter((item) => item.athleteId === athleteId), competitionResults: data.competitionResults.filter((item) => item.athleteId === athleteId), decisions: data.decisions.filter((item) => item.athleteId === athleteId), versions: data.versions.filter((item) => item.athleteId === athleteId), annotations: data.annotations.filter((item) => item.athleteId === athleteId), exceptionDispositions: data.exceptionDispositions.filter((item) => item.athleteId === athleteId), consent: data.consents.find((item) => item.athleteId === athleteId) ?? null }, null, 2);
  }

  return { ...current, saveRecovery, recordRecommendation, saveMeetPlan, resolveMeetPlanConflict, recordCompetitionAttempt, recordCompetitionResult, recordDecision, reviewDecision, recordVersion, addAnnotation, saveGroup, saveExceptionDisposition, saveExerciseLibraryItem, setConsent, deleteAthleteData, syncNow, exportAthleteData };
}