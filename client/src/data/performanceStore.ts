import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";

import type { RecoverySignal } from "./adaptiveEngine";
import type { TrainingProgram } from "./programWorkspaceStore";

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
  flightsAway: number;
  liftersPerFlight: number;
  attempts: Record<"squat" | "bench" | "deadlift", [number, number, number]>;
  checklist: Record<string, boolean>;
  updatedAt: string;
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
  createdAt: string;
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

interface PerformanceSnapshot {
  recovery: RecoveryCheckIn[];
  meetPlans: MeetPlan[];
  decisions: CoachDecision[];
  versions: ProgramVersionRecord[];
  annotations: VideoAnnotation[];
  groups: AthleteGroup[];
  consents: ConsentSettings[];
  isLoading: boolean;
}

interface PerformanceStore extends PerformanceSnapshot {
  saveRecovery: (input: Omit<RecoveryCheckIn, "id" | "recordedAt">) => Promise<void>;
  saveMeetPlan: (plan: Omit<MeetPlan, "updatedAt">) => Promise<void>;
  recordDecision: (decision: Omit<CoachDecision, "id" | "createdAt">) => Promise<void>;
  recordVersion: (input: Omit<ProgramVersionRecord, "id" | "version" | "createdAt">) => Promise<void>;
  addAnnotation: (annotation: Omit<VideoAnnotation, "id" | "createdAt">) => Promise<void>;
  saveGroup: (group: Omit<AthleteGroup, "id" | "createdAt"> & { id?: string }) => Promise<void>;
  setConsent: (consent: Omit<ConsentSettings, "updatedAt">) => Promise<void>;
  deleteAthleteData: (athleteId: string) => Promise<void>;
}

const storageKey = "iron-forge/performance-domain-v1";
const listeners = new Set<() => void>();
let data: PerformanceSnapshot = { recovery: [], meetPlans: [], decisions: [], versions: [], annotations: [], groups: [], consents: [], isLoading: true };
let loadPromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();

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
        meetPlans: Array.isArray(parsed.meetPlans) ? parsed.meetPlans : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
        versions: Array.isArray(parsed.versions) ? parsed.versions : [],
        annotations: Array.isArray(parsed.annotations) ? parsed.annotations : [],
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        consents: Array.isArray(parsed.consents) ? parsed.consents : [],
        isLoading: false
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
  const write = writeQueue.then(() => AsyncStorage.setItem(storageKey, JSON.stringify({ ...next, isLoading: undefined })));
  writeQueue = write.catch(() => undefined);
  try {
    await write;
  }
  catch (error) {
    if (data === next) publish(previous);
    throw error;
  }
}

export function usePerformanceStore(): PerformanceStore {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => { void ensureLoaded(); }, []);

  async function saveRecovery(input: Omit<RecoveryCheckIn, "id" | "recordedAt">) {
    await ensureLoaded();
    await persist({ ...data, recovery: [...data.recovery, { ...input, id: id("recovery"), recordedAt: new Date().toISOString() }] });
  }

  async function saveMeetPlan(plan: Omit<MeetPlan, "updatedAt">) {
    await ensureLoaded();
    await persist({ ...data, meetPlans: [...data.meetPlans.filter((item) => item.athleteId !== plan.athleteId), { ...plan, updatedAt: new Date().toISOString() }] });
  }

  async function recordDecision(decision: Omit<CoachDecision, "id" | "createdAt">) {
    await ensureLoaded();
    await persist({ ...data, decisions: [...data.decisions, { ...decision, id: id("decision"), createdAt: new Date().toISOString() }] });
  }

  async function recordVersion(input: Omit<ProgramVersionRecord, "id" | "version" | "createdAt">) {
    await ensureLoaded();
    const version = Math.max(0, ...data.versions.filter((item) => item.programId === input.programId).map((item) => item.version)) + 1;
    await persist({ ...data, versions: [...data.versions, { ...input, id: id("version"), version, createdAt: new Date().toISOString(), snapshot: JSON.parse(JSON.stringify(input.snapshot)) as TrainingProgram }] });
  }

  async function addAnnotation(annotation: Omit<VideoAnnotation, "id" | "createdAt">) {
    await ensureLoaded();
    await persist({ ...data, annotations: [...data.annotations, { ...annotation, id: id("annotation"), createdAt: new Date().toISOString() }] });
  }

  async function saveGroup(group: Omit<AthleteGroup, "id" | "createdAt"> & { id?: string }) {
    await ensureLoaded();
    const next = { ...group, id: group.id ?? id("group"), createdAt: data.groups.find((item) => item.id === group.id)?.createdAt ?? new Date().toISOString() };
    await persist({ ...data, groups: [...data.groups.filter((item) => item.id !== next.id), next] });
  }

  async function setConsent(consent: Omit<ConsentSettings, "updatedAt">) {
    await ensureLoaded();
    await persist({ ...data, consents: [...data.consents.filter((item) => item.athleteId !== consent.athleteId), { ...consent, updatedAt: new Date().toISOString() }] });
  }

  async function deleteAthleteData(athleteId: string) {
    await ensureLoaded();
    await persist({ ...data, recovery: data.recovery.filter((item) => item.athleteId !== athleteId), meetPlans: data.meetPlans.filter((item) => item.athleteId !== athleteId), decisions: data.decisions.filter((item) => item.athleteId !== athleteId), versions: data.versions.filter((item) => item.athleteId !== athleteId), annotations: data.annotations.filter((item) => item.athleteId !== athleteId), groups: data.groups.map((item) => ({ ...item, athleteIds: item.athleteIds.filter((idValue) => idValue !== athleteId) })), consents: data.consents.filter((item) => item.athleteId !== athleteId) });
  }

  return { ...current, saveRecovery, saveMeetPlan, recordDecision, recordVersion, addAnnotation, saveGroup, setConsent, deleteAthleteData };
}