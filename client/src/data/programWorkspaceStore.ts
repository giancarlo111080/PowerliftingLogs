import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";

import { isLiftVideoAnalysis, type LiftVideoAnalysis } from "../lib/liftAnalysis";
import { isStaticDemo } from "../lib/platformApi";

export type ProgramPhase = "Hypertrophy" | "Strength" | "Peak" | "Recovery";
export type ProgramStatus = "draft" | "active" | "completed";
export type ExerciseCategory = "squat" | "bench" | "deadlift" | "accessory";
export type PrescriptionMode = "rpe" | "rir" | "percent" | "exact";
export type WeightUnit = "kg" | "lb";
export type DayScheduleAuthor = "coach" | "lifter";
export type ProgramSetCompletionStatus = "pending" | "done" | "skipped";

export interface ProgramExercise {
  id: string;
  category: ExerciseCategory;
  name: string;
  sets: number;
  repetitions: number;
  prescriptionMode: PrescriptionMode;
  prescriptionValue: number;
  weightUnit: WeightUnit;
}

export interface ProgramDay {
  id: string;
  sequence: number;
  name: string;
  focus: string;
  scheduledDate: string;
  scheduleUpdatedBy: DayScheduleAuthor;
  scheduleUpdatedAt: string;
  exercises: ProgramExercise[];
}

export interface ProgramWeek {
  id: string;
  weekNumber: number;
  name: string;
  days: ProgramDay[];
}

export interface ProgramComment {
  id: string;
  programId: string;
  dayId: string;
  authorProfileId: string;
  authorName: string;
  authorRole: "lifter" | "coach";
  body: string;
  createdAt: string;
}

export interface ProgramDaySetLog {
  exerciseId: string;
  setNumber: number;
  completionStatus: ProgramSetCompletionStatus;
  completedAt?: string;
  actualWeight?: number;
  weightUnit?: WeightUnit;
  instagramVideoUrl?: string;
  videoAnalysis?: LiftVideoAnalysis;
}

export interface ProgramDayLog {
  programId: string;
  dayId: string;
  sets: ProgramDaySetLog[];
  sessionRating?: number;
  ratedAt?: string;
  updatedAt: string;
}

export interface TrainingProgram {
  id: string;
  athleteId: string;
  coachId?: string;
  templateId?: string;
  name: string;
  phase: ProgramPhase;
  goal: string;
  startDate: string;
  endDate: string;
  trainingDaysPerWeek: number;
  status: ProgramStatus;
  updatedAt: string;
  weeks: ProgramWeek[];
}

export type ProgramInput = Omit<TrainingProgram, "id" | "athleteId" | "updatedAt" | "weeks">;

export interface ProgramTemplateDay {
  id: string;
  sequence: number;
  name: string;
  focus: string;
  exercises: ProgramExercise[];
}

export interface ProgramTemplateWeek {
  id: string;
  weekNumber: number;
  name: string;
  days: ProgramTemplateDay[];
}

export interface ProgramTemplate {
  id: string;
  coachId: string;
  name: string;
  phase: ProgramPhase;
  goal: string;
  trainingDaysPerWeek: number;
  createdAt: string;
  updatedAt: string;
  weeks: ProgramTemplateWeek[];
}

export type ProgramTemplateInput = Pick<ProgramTemplate, "name" | "phase" | "goal" | "trainingDaysPerWeek">;

interface ProgramWorkspaceStore {
  programs: TrainingProgram[];
  templates: ProgramTemplate[];
  comments: ProgramComment[];
  dayLogs: ProgramDayLog[];
  isLoading: boolean;
  createProgram: (athleteId: string, input: ProgramInput) => Promise<void>;
  updateProgram: (programId: string, input: ProgramInput) => Promise<void>;
  deleteProgram: (programId: string) => Promise<void>;
  createTemplate: (coachId: string, input: ProgramTemplateInput) => Promise<ProgramTemplate>;
  updateTemplate: (templateId: string, input: ProgramTemplateInput) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  addTemplateWeek: (templateId: string) => Promise<void>;
  updateTemplateWeek: (templateId: string, weekId: string, name: string) => Promise<void>;
  addTemplateDay: (templateId: string, weekId: string, day: Pick<ProgramTemplateDay, "name" | "focus">) => Promise<ProgramTemplateDay>;
  updateTemplateDay: (templateId: string, weekId: string, dayId: string, day: Pick<ProgramTemplateDay, "name" | "focus">) => Promise<void>;
  addTemplateExercise: (templateId: string, weekId: string, dayId: string, category: ExerciseCategory, input?: Partial<Pick<ProgramExercise, "name" | "sets" | "repetitions" | "prescriptionMode" | "prescriptionValue" | "weightUnit">>) => Promise<ProgramExercise>;
  updateTemplateExercise: (templateId: string, weekId: string, dayId: string, exercise: ProgramExercise) => Promise<void>;
  assignTemplate: (templateId: string, athleteId: string, startDate: string) => Promise<TrainingProgram>;
  addWeek: (programId: string) => Promise<void>;
  updateWeek: (programId: string, weekId: string, name: string) => Promise<void>;
  deleteWeek: (programId: string, weekId: string) => Promise<void>;
  addDay: (programId: string, weekId: string, day: Pick<ProgramDay, "name" | "focus"> & Partial<Pick<ProgramDay, "scheduledDate">>) => Promise<ProgramDay>;
  updateDay: (programId: string, weekId: string, dayId: string, day: Pick<ProgramDay, "name" | "focus"> & Partial<Pick<ProgramDay, "scheduledDate">>) => Promise<void>;
  deleteDay: (programId: string, weekId: string, dayId: string) => Promise<void>;
  rescheduleDay: (programId: string, weekId: string, dayId: string, scheduledDate: string, updatedBy: DayScheduleAuthor) => Promise<void>;
  rescheduleWeek: (programId: string, weekId: string, startDate: string, updatedBy: DayScheduleAuthor) => Promise<void>;
  addExercise: (programId: string, weekId: string, dayId: string, category: ExerciseCategory, input?: Partial<Pick<ProgramExercise, "name" | "sets" | "repetitions" | "prescriptionMode" | "prescriptionValue" | "weightUnit">>) => Promise<ProgramExercise>;
  updateExercise: (programId: string, weekId: string, dayId: string, exercise: ProgramExercise) => Promise<void>;
  deleteExercise: (programId: string, weekId: string, dayId: string, exerciseId: string) => Promise<void>;
  logDaySet: (programId: string, dayId: string, exerciseId: string, setNumber: number, completionStatus: ProgramSetCompletionStatus, actualWeight?: number, weightUnit?: WeightUnit) => Promise<void>;
  updateDaySetInstagramLink: (programId: string, dayId: string, exerciseId: string, setNumber: number, instagramVideoUrl: string) => Promise<void>;
  updateDaySetVideoAnalysis: (programId: string, dayId: string, exerciseId: string, setNumber: number, videoAnalysis: LiftVideoAnalysis) => Promise<void>;
  updateDayRating: (programId: string, dayId: string, sessionRating: number | null) => Promise<void>;
  addComment: (comment: Omit<ProgramComment, "id" | "createdAt">) => Promise<void>;
}

interface ProgramWorkspaceSnapshot {
  programs: TrainingProgram[];
  templates: ProgramTemplate[];
  comments: ProgramComment[];
  dayLogs: ProgramDayLog[];
  isLoading: boolean;
}

const programStorageKey = "iron-forge/coach-programs";
const templateStorageKey = "iron-forge/program-templates";
const commentStorageKey = "iron-forge/program-day-comments";
const dayLogStorageKey = "iron-forge/program-day-logs";
const legacyProgramStorageKey = "powerlifting-program/coach-programs";
const legacyCommentStorageKey = "powerlifting-program/program-day-comments";
const legacyDayLogStorageKey = "powerlifting-program/program-day-logs";
const workspaceListeners = new Set<() => void>();

function notifyWorkspaceListeners() {
  workspaceListeners.forEach((listener) => listener());
}

function createId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isIsoDate(value: string | undefined): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
}

function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function createExercise(category: ExerciseCategory, name?: string): ProgramExercise {
  const defaults: Record<ExerciseCategory, Omit<ProgramExercise, "id" | "category" | "name">> = {
    squat: { sets: 4, repetitions: 4, prescriptionMode: "rpe", prescriptionValue: 7, weightUnit: "kg" },
    bench: { sets: 4, repetitions: 5, prescriptionMode: "rpe", prescriptionValue: 7, weightUnit: "kg" },
    deadlift: { sets: 3, repetitions: 3, prescriptionMode: "rpe", prescriptionValue: 7, weightUnit: "kg" },
    accessory: { sets: 3, repetitions: 10, prescriptionMode: "rir", prescriptionValue: 2, weightUnit: "kg" }
  };
  const labels: Record<ExerciseCategory, string> = {
    squat: "Competition Squat",
    bench: "Competition Bench Press",
    deadlift: "Competition Deadlift",
    accessory: "Accessory Exercise"
  };
  return { id: createId("exercise"), category, name: name ?? labels[category], ...defaults[category] };
}

function createDay(name: string, focus: string, exercises: ProgramExercise[] = [], scheduledDate = "", sequence = 0): ProgramDay {
  return { id: createId("day"), sequence, name, focus, scheduledDate, scheduleUpdatedBy: "coach", scheduleUpdatedAt: new Date().toISOString(), exercises };
}

function createWeek(weekNumber: number, name = `Week ${weekNumber}`): ProgramWeek {
  return { id: createId("week"), weekNumber, name, days: [] };
}

function seedWeeks(days: ProgramDay[], startDate: string, seedPrefix?: string): ProgramWeek[] {
  const seededDays = days.map((day, dayIndex) => ({
    ...day,
    id: seedPrefix ? `${seedPrefix}-day-${dayIndex + 1}` : day.id,
    exercises: day.exercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      id: seedPrefix ? `${seedPrefix}-day-${dayIndex + 1}-exercise-${exerciseIndex + 1}` : exercise.id
    }))
  }));
  return [
    { id: seedPrefix ? `${seedPrefix}-week-1` : createId("week"), weekNumber: 1, name: "Week 1", days: seededDays.map((day, index) => ({ ...day, sequence: index + 1, scheduledDate: isIsoDate(day.scheduledDate) ? day.scheduledDate : addCalendarDays(startDate, index), scheduleUpdatedBy: "coach", scheduleUpdatedAt: seedPrefix ? `${startDate}T00:00:00.000Z` : new Date().toISOString() })) },
    { id: seedPrefix ? `${seedPrefix}-week-2` : createId("week"), weekNumber: 2, name: "Week 2", days: [] },
    { id: seedPrefix ? `${seedPrefix}-week-3` : createId("week"), weekNumber: 3, name: "Week 3", days: [] },
    { id: seedPrefix ? `${seedPrefix}-week-4` : createId("week"), weekNumber: 4, name: "Week 4", days: [] }
  ];
}

const demoPrograms: TrainingProgram[] = [
  {
    id: "program-alex-peak",
    athleteId: "a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9",
    name: "Autumn Open Peak",
    phase: "Peak",
    goal: "Convert strength into confident competition attempts for the Autumn Open.",
    startDate: "2026-08-03",
    endDate: "2026-08-30",
    trainingDaysPerWeek: 4,
    status: "active",
    updatedAt: "2026-08-27T16:25:00.000Z",
    weeks: seedWeeks([
      createDay("Day 1", "Competition squat and bench volume", [
        createExercise("squat", "Competition Squat"),
        createExercise("bench", "Paused Bench Press"),
        createExercise("accessory", "Chest-Supported Row")
      ]),
      createDay("Day 2", "Deadlift exposure and upper back", [
        createExercise("deadlift", "Competition Deadlift"),
        createExercise("accessory", "Lat Pulldown")
      ])
    ], "2026-08-03", "program-alex-peak")
  }
];

const legacyDemoProgramIds = new Set(["program-alex-peak", "program-jordan-strength", "program-mina-hypertrophy", "program-sam-peak"]);
const fallbackPrograms = isStaticDemo ? demoPrograms : [];

let programs = fallbackPrograms;
let templates: ProgramTemplate[] = [];
let comments: ProgramComment[] = [];
let dayLogs: ProgramDayLog[] = [];
let isLoading = true;
let workspaceSnapshot: ProgramWorkspaceSnapshot = { programs, templates, comments, dayLogs, isLoading };
let workspaceRestorePromise: Promise<void> | null = null;
let workspaceWriteQueue = Promise.resolve();

function publishWorkspaceSnapshot() {
  workspaceSnapshot = { programs, templates, comments, dayLogs, isLoading };
  notifyWorkspaceListeners();
}

function subscribeToWorkspace(listener: () => void) {
  workspaceListeners.add(listener);
  return () => workspaceListeners.delete(listener);
}

function getWorkspaceSnapshot() {
  return workspaceSnapshot;
}

function restoreItems<T>(serialized: string | null, normalize: (value: unknown) => T | null, fallback: T[]): T[] {
  if (!serialized) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(serialized) as unknown;
    return Array.isArray(parsed)
      ? parsed.map(normalize).filter((item): item is T => item !== null)
      : fallback;
  }
  catch {
    return fallback;
  }
}

async function readMigratedWorkspaceItem(key: string, legacyKey?: string) {
  const storedValue = await AsyncStorage.getItem(key);
  if (storedValue !== null || !legacyKey) {
    return storedValue;
  }
  const legacyValue = await AsyncStorage.getItem(legacyKey);
  if (legacyValue !== null) {
    await AsyncStorage.setItem(key, legacyValue);
    await AsyncStorage.removeItem(legacyKey);
  }
  return legacyValue;
}

async function restoreWorkspace() {
  try {
    const [storedPrograms, storedTemplates, storedComments, storedDayLogs] = await Promise.all([
      readMigratedWorkspaceItem(programStorageKey, legacyProgramStorageKey),
      readMigratedWorkspaceItem(templateStorageKey),
      readMigratedWorkspaceItem(commentStorageKey, legacyCommentStorageKey),
      readMigratedWorkspaceItem(dayLogStorageKey, legacyDayLogStorageKey)
    ]);
    const restoredPrograms = restoreItems(storedPrograms, normalizeProgram, fallbackPrograms);
    programs = restoredPrograms.filter((program) => isStaticDemo ? program.id === "program-alex-peak" || !legacyDemoProgramIds.has(program.id) : !legacyDemoProgramIds.has(program.id));
    templates = restoreItems(storedTemplates, normalizeTemplate, []);
    const retainedProgramIds = new Set(programs.map((program) => program.id));
    const restoredComments = restoreItems(storedComments, (value) => isComment(value) ? value : null, []);
    const restoredDayLogs = restoreItems(storedDayLogs, (value) => isDayLog(value) ? value : null, []);
    comments = restoredComments.filter((comment) => retainedProgramIds.has(comment.programId));
    dayLogs = restoredDayLogs.filter((dayLog) => retainedProgramIds.has(dayLog.programId));
    const cleanupWrites: Promise<void>[] = [];
    if (storedPrograms !== null && programs.length !== restoredPrograms.length) cleanupWrites.push(AsyncStorage.setItem(programStorageKey, JSON.stringify(programs)));
    if (storedComments !== null && comments.length !== restoredComments.length) cleanupWrites.push(AsyncStorage.setItem(commentStorageKey, JSON.stringify(comments)));
    if (storedDayLogs !== null && dayLogs.length !== restoredDayLogs.length) cleanupWrites.push(AsyncStorage.setItem(dayLogStorageKey, JSON.stringify(dayLogs)));
    await Promise.all(cleanupWrites).catch(() => undefined);
  }
  catch {
    programs = fallbackPrograms;
    templates = [];
    comments = [];
    dayLogs = [];
  }
  finally {
    isLoading = false;
    publishWorkspaceSnapshot();
  }
}

function ensureWorkspaceLoaded() {
  workspaceRestorePromise ??= restoreWorkspace();
  return workspaceRestorePromise;
}

function writeWorkspaceItem(key: string, value: string) {
  const write = workspaceWriteQueue.then(() => AsyncStorage.setItem(key, value));
  workspaceWriteQueue = write.catch(() => undefined);
  return write;
}

function isProgramStatus(value: unknown): value is ProgramStatus {
  return value === "draft" || value === "active" || value === "completed";
}

function isProgramPhase(value: unknown): value is ProgramPhase {
  return value === "Hypertrophy" || value === "Strength" || value === "Peak" || value === "Recovery";
}

function isProgram(value: unknown): value is TrainingProgram {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<TrainingProgram>;
  return typeof candidate.id === "string" &&
    typeof candidate.athleteId === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.goal === "string" &&
    typeof candidate.startDate === "string" &&
    typeof candidate.endDate === "string" &&
    typeof candidate.trainingDaysPerWeek === "number" &&
    isProgramPhase(candidate.phase) &&
    isProgramStatus(candidate.status) &&
    typeof candidate.updatedAt === "string";
}

function categoryFromName(name: string): ExerciseCategory {
  const normalized = name.toLowerCase();
  if (normalized.includes("squat")) {
    return "squat";
  }
  if (normalized.includes("bench")) {
    return "bench";
  }
  if (normalized.includes("deadlift")) {
    return "deadlift";
  }
  return "accessory";
}

function normalizeProgram(value: unknown): TrainingProgram | null {
  if (!isProgram(value)) {
    return null;
  }
  const candidate = value as TrainingProgram & { exercises?: unknown; weeks?: unknown };
  if (Array.isArray(candidate.weeks)) {
    return {
      ...candidate,
      weeks: candidate.weeks.map((rawWeek, weekIndex) => {
        const week = rawWeek as ProgramWeek;
        const weekNumber = typeof week.weekNumber === "number" ? week.weekNumber : weekIndex + 1;
        return {
          ...week,
          weekNumber,
          days: Array.isArray(week.days) ? week.days.map((rawDay, dayIndex) => {
            const day = rawDay as ProgramDay;
            return {
              ...day,
              sequence: Number.isInteger(day.sequence) && day.sequence > 0 ? day.sequence : dayIndex + 1,
              scheduledDate: isIsoDate(day.scheduledDate) ? day.scheduledDate : addCalendarDays(candidate.startDate, ((weekNumber - 1) * 7) + dayIndex),
              scheduleUpdatedBy: day.scheduleUpdatedBy === "lifter" ? "lifter" : "coach",
              scheduleUpdatedAt: typeof day.scheduleUpdatedAt === "string" ? day.scheduleUpdatedAt : candidate.updatedAt
            };
          }) : []
        };
      })
    };
  }
  const legacyExercises = Array.isArray(candidate.exercises) ? candidate.exercises.filter((exercise): exercise is string => typeof exercise === "string") : [];
  return {
    ...candidate,
    weeks: seedWeeks([createDay("Day 1", "Primary competition lifts", legacyExercises.map((exercise) => createExercise(categoryFromName(exercise), exercise)))], candidate.startDate)
  };
}

function isComment(value: unknown): value is ProgramComment {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ProgramComment>;
  return typeof candidate.id === "string" &&
    typeof candidate.programId === "string" &&
    typeof candidate.dayId === "string" &&
    typeof candidate.authorProfileId === "string" &&
    typeof candidate.authorName === "string" &&
    (candidate.authorRole === "lifter" || candidate.authorRole === "coach") &&
    typeof candidate.body === "string" &&
    typeof candidate.createdAt === "string";
}

function isDayLog(value: unknown): value is ProgramDayLog {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ProgramDayLog>;
  return typeof candidate.programId === "string" &&
    typeof candidate.dayId === "string" &&
    typeof candidate.updatedAt === "string" &&
    Array.isArray(candidate.sets) &&
    candidate.sets.every((set) => typeof set.exerciseId === "string" &&
      Number.isInteger(set.setNumber) &&
      set.setNumber > 0 &&
      (set.completionStatus === "pending" || set.completionStatus === "done" || set.completionStatus === "skipped") &&
      (set.completedAt === undefined || typeof set.completedAt === "string") &&
      (set.actualWeight === undefined || (typeof set.actualWeight === "number" && Number.isFinite(set.actualWeight) && set.actualWeight > 0)) &&
      (set.weightUnit === undefined || set.weightUnit === "kg" || set.weightUnit === "lb") &&
      (set.instagramVideoUrl === undefined || typeof set.instagramVideoUrl === "string") &&
      (set.videoAnalysis === undefined || isLiftVideoAnalysis(set.videoAnalysis))) &&
    (candidate.sessionRating === undefined || (Number.isInteger(candidate.sessionRating) && candidate.sessionRating >= 1 && candidate.sessionRating <= 10)) &&
    (candidate.ratedAt === undefined || typeof candidate.ratedAt === "string");
}

function updateProgramStructure(program: TrainingProgram, weekId: string, change: (week: ProgramWeek) => ProgramWeek): TrainingProgram {
  return { ...program, updatedAt: new Date().toISOString(), weeks: program.weeks.map((week) => week.id === weekId ? change(week) : week) };
}

export function useProgramWorkspaceStore(): ProgramWorkspaceStore {
  const snapshot = useSyncExternalStore(subscribeToWorkspace, getWorkspaceSnapshot, getWorkspaceSnapshot);

  useEffect(() => {
    void ensureWorkspaceLoaded();
  }, []);

  async function persistPrograms(nextPrograms: TrainingProgram[]) {
    const previousPrograms = programs;
    programs = nextPrograms;
    publishWorkspaceSnapshot();
    try {
      await writeWorkspaceItem(programStorageKey, JSON.stringify(nextPrograms));
    }
    catch (error) {
      if (programs === nextPrograms) {
        programs = previousPrograms;
        publishWorkspaceSnapshot();
      }
      throw error;
    }
  }

  async function persistTemplates(nextTemplates: ProgramTemplate[]) {
    const previousTemplates = templates;
    templates = nextTemplates;
    publishWorkspaceSnapshot();
    try {
      await writeWorkspaceItem(templateStorageKey, JSON.stringify(nextTemplates));
    }
    catch (error) {
      if (templates === nextTemplates) {
        templates = previousTemplates;
        publishWorkspaceSnapshot();
      }
      throw error;
    }
  }

  async function persistComments(nextComments: ProgramComment[]) {
    const previousComments = comments;
    comments = nextComments;
    publishWorkspaceSnapshot();
    try {
      await writeWorkspaceItem(commentStorageKey, JSON.stringify(nextComments));
    }
    catch (error) {
      if (comments === nextComments) {
        comments = previousComments;
        publishWorkspaceSnapshot();
      }
      throw error;
    }
  }

  async function persistDayLogs(nextDayLogs: ProgramDayLog[]) {
    const previousDayLogs = dayLogs;
    dayLogs = nextDayLogs;
    publishWorkspaceSnapshot();
    try {
      await writeWorkspaceItem(dayLogStorageKey, JSON.stringify(nextDayLogs));
    }
    catch (error) {
      if (dayLogs === nextDayLogs) {
        dayLogs = previousDayLogs;
        publishWorkspaceSnapshot();
      }
      throw error;
    }
  }

  async function createProgram(athleteId: string, input: ProgramInput) {
    await ensureWorkspaceLoaded();
    const nextProgram: TrainingProgram = { ...input, id: createId("program"), athleteId, updatedAt: new Date().toISOString(), weeks: [createWeek(1)] };
    const nextPrograms = input.status === "active"
      ? programs.map((program) => program.athleteId === athleteId && program.status === "active" ? { ...program, status: "draft" as const } : program)
      : programs;
    await persistPrograms([...nextPrograms, nextProgram]);
  }

  async function updateProgram(programId: string, input: ProgramInput) {
    await ensureWorkspaceLoaded();
    const targetProgram = programs.find((program) => program.id === programId);
    const nextPrograms = programs.map((program) => {
      if (program.id === programId) {
        return { ...program, ...input, updatedAt: new Date().toISOString() };
      }
      if (input.status === "active" && program.athleteId === targetProgram?.athleteId && program.status === "active") {
        return { ...program, status: "draft" as const };
      }
      return program;
    });
    await persistPrograms(nextPrograms);
  }

  async function deleteProgram(programId: string) {
    await ensureWorkspaceLoaded();
    await persistPrograms(programs.filter((program) => program.id !== programId));
    await persistComments(comments.filter((comment) => comment.programId !== programId));
    await persistDayLogs(dayLogs.filter((dayLog) => dayLog.programId !== programId));
  }

  async function createTemplate(coachId: string, input: ProgramTemplateInput): Promise<ProgramTemplate> {
    await ensureWorkspaceLoaded();
    const now = new Date().toISOString();
    const template: ProgramTemplate = { ...input, id: createId("template"), coachId, createdAt: now, updatedAt: now, weeks: [createTemplateWeek(1)] };
    await persistTemplates([...templates, template]);
    return template;
  }

  async function updateTemplate(templateId: string, input: ProgramTemplateInput) {
    await ensureWorkspaceLoaded();
    await persistTemplates(templates.map((template) => template.id === templateId ? { ...template, ...input, updatedAt: new Date().toISOString() } : template));
  }

  async function deleteTemplate(templateId: string) {
    await ensureWorkspaceLoaded();
    await persistTemplates(templates.filter((template) => template.id !== templateId));
  }

  async function addTemplateWeek(templateId: string) {
    await ensureWorkspaceLoaded();
    await persistTemplates(templates.map((template) => template.id === templateId
      ? { ...template, updatedAt: new Date().toISOString(), weeks: [...template.weeks, createTemplateWeek(template.weeks.length + 1)] }
      : template));
  }

  async function updateTemplateWeek(templateId: string, weekId: string, name: string) {
    await ensureWorkspaceLoaded();
    await persistTemplates(templates.map((template) => template.id === templateId
      ? updateTemplateStructure(template, weekId, (week) => ({ ...week, name: name.trim() || `Week ${week.weekNumber}` }))
      : template));
  }

  async function addTemplateDay(templateId: string, weekId: string, day: Pick<ProgramTemplateDay, "name" | "focus">): Promise<ProgramTemplateDay> {
    await ensureWorkspaceLoaded();
    const template = templates.find((candidate) => candidate.id === templateId);
    const targetWeek = template?.weeks.find((week) => week.id === weekId);
    if (!template || !targetWeek) {
      throw new Error("The template week is no longer available.");
    }
    const nextDay = createTemplateDay(day.name.trim() || `Day ${targetWeek.days.length + 1}`, day.focus.trim() || "Training day", [], Math.max(0, ...targetWeek.days.map((currentDay) => currentDay.sequence)) + 1);
    await persistTemplates(templates.map((candidate) => candidate.id === templateId
      ? updateTemplateStructure(candidate, weekId, (week) => ({ ...week, days: [...week.days, nextDay] }))
      : candidate));
    return nextDay;
  }

  async function updateTemplateDay(templateId: string, weekId: string, dayId: string, day: Pick<ProgramTemplateDay, "name" | "focus">) {
    await ensureWorkspaceLoaded();
    await persistTemplates(templates.map((template) => template.id === templateId
      ? updateTemplateStructure(template, weekId, (week) => ({ ...week, days: week.days.map((currentDay) => currentDay.id === dayId ? { ...currentDay, name: day.name.trim() || currentDay.name, focus: day.focus.trim() || currentDay.focus } : currentDay) }))
      : template));
  }

  async function addTemplateExercise(templateId: string, weekId: string, dayId: string, category: ExerciseCategory, input?: Partial<Pick<ProgramExercise, "name" | "sets" | "repetitions" | "prescriptionMode" | "prescriptionValue" | "weightUnit">>): Promise<ProgramExercise> {
    await ensureWorkspaceLoaded();
    const targetDay = templates.find((template) => template.id === templateId)?.weeks.find((week) => week.id === weekId)?.days.find((day) => day.id === dayId);
    if (!targetDay) {
      throw new Error("The template training day is no longer available.");
    }
    const nextExercise = { ...createExercise(category), ...input };
    await persistTemplates(templates.map((template) => template.id === templateId
      ? updateTemplateStructure(template, weekId, (week) => ({ ...week, days: week.days.map((day) => day.id === dayId ? { ...day, exercises: [...day.exercises, nextExercise] } : day) }))
      : template));
    return nextExercise;
  }

  async function updateTemplateExercise(templateId: string, weekId: string, dayId: string, exercise: ProgramExercise) {
    await ensureWorkspaceLoaded();
    await persistTemplates(templates.map((template) => template.id === templateId
      ? updateTemplateStructure(template, weekId, (week) => ({ ...week, days: week.days.map((day) => day.id === dayId ? { ...day, exercises: day.exercises.map((currentExercise) => currentExercise.id === exercise.id ? exercise : currentExercise) } : day) }))
      : template));
  }

  async function assignTemplate(templateId: string, athleteId: string, startDate: string): Promise<TrainingProgram> {
    await ensureWorkspaceLoaded();
    const template = templates.find((candidate) => candidate.id === templateId);
    if (!template) {
      throw new Error("The master template is no longer available.");
    }
    if (!isIsoDate(startDate)) {
      throw new Error("Choose a valid start date as YYYY-MM-DD.");
    }
    const existingTrainingLog = programs.find((program) => program.athleteId === athleteId && program.status === "active" && (
      program.templateId === template.id ||
      (program.coachId === template.coachId && program.name === template.name)
    ));
    if (existingTrainingLog) {
      return existingTrainingLog;
    }
    const now = new Date().toISOString();
    const clonedWeeks = [...template.weeks].sort((left, right) => left.weekNumber - right.weekNumber).map((week) => ({
      id: createId("week"),
      weekNumber: week.weekNumber,
      name: week.name,
      days: [...week.days].sort((left, right) => left.sequence - right.sequence).map((day) => ({
        id: createId("day"),
        sequence: day.sequence,
        name: day.name,
        focus: day.focus,
        scheduledDate: addCalendarDays(startDate, ((week.weekNumber - 1) * 7) + day.sequence - 1),
        scheduleUpdatedBy: "coach" as const,
        scheduleUpdatedAt: now,
        exercises: day.exercises.map((exercise) => ({ ...exercise, id: createId("exercise") }))
      }))
    }));
    const finalScheduledDate = clonedWeeks.flatMap((week) => week.days).map((day) => day.scheduledDate).sort().at(-1) ?? startDate;
    const trainingLog: TrainingProgram = { id: createId("live-log"), athleteId, coachId: template.coachId, templateId: template.id, name: template.name, phase: template.phase, goal: template.goal, startDate, endDate: finalScheduledDate, trainingDaysPerWeek: template.trainingDaysPerWeek, status: "active", updatedAt: now, weeks: clonedWeeks };
    await persistPrograms([...programs.map((program) => program.athleteId === athleteId && program.status === "active" ? { ...program, status: "completed" as const } : program), trainingLog]);
    return trainingLog;
  }

  async function addWeek(programId: string) {
    await ensureWorkspaceLoaded();
    const nextPrograms = programs.map((program) => program.id === programId
      ? { ...program, updatedAt: new Date().toISOString(), weeks: [...program.weeks, createWeek(program.weeks.length + 1)] }
      : program);
    await persistPrograms(nextPrograms);
  }

  async function updateWeek(programId: string, weekId: string, name: string) {
    await ensureWorkspaceLoaded();
    const nextPrograms = programs.map((program) => program.id === programId
      ? updateProgramStructure(program, weekId, (week) => ({ ...week, name: name.trim() || `Week ${week.weekNumber}` }))
      : program);
    await persistPrograms(nextPrograms);
  }

  async function deleteWeek(programId: string, weekId: string) {
    await ensureWorkspaceLoaded();
    const removedDayIds = programs.find((program) => program.id === programId)?.weeks
      .find((week) => week.id === weekId)?.days.map((day) => day.id) ?? [];
    const nextPrograms = programs.map((program) => program.id === programId
      ? { ...program, updatedAt: new Date().toISOString(), weeks: program.weeks.filter((week) => week.id !== weekId).map((week, index) => ({ ...week, weekNumber: index + 1 })) }
      : program);
    await persistPrograms(nextPrograms);
    await persistComments(comments.filter((comment) => comment.programId !== programId || !removedDayIds.includes(comment.dayId)));
    await persistDayLogs(dayLogs.filter((dayLog) => dayLog.programId !== programId || !removedDayIds.includes(dayLog.dayId)));
  }

  async function addDay(programId: string, weekId: string, day: Pick<ProgramDay, "name" | "focus"> & Partial<Pick<ProgramDay, "scheduledDate">>): Promise<ProgramDay> {
    await ensureWorkspaceLoaded();
    const program = programs.find((candidate) => candidate.id === programId);
    const targetWeek = program?.weeks.find((week) => week.id === weekId);
    if (!program || !targetWeek) {
      throw new Error("The program week is no longer available.");
    }
    const nextDay = createDay(
      day.name.trim() || `Day ${targetWeek.days.length + 1}`,
      day.focus.trim() || "Training day",
      [],
      isIsoDate(day.scheduledDate) ? day.scheduledDate : addCalendarDays(program.startDate, ((targetWeek.weekNumber - 1) * 7) + targetWeek.days.length),
      Math.max(0, ...targetWeek.days.map((currentDay) => currentDay.sequence)) + 1
    );
    const nextPrograms = programs.map((program) => program.id === programId
      ? updateProgramStructure(program, weekId, (week) => ({ ...week, days: [...week.days, nextDay] }))
      : program);
    await persistPrograms(nextPrograms);
    return nextDay;
  }

  async function updateDay(programId: string, weekId: string, dayId: string, day: Pick<ProgramDay, "name" | "focus"> & Partial<Pick<ProgramDay, "scheduledDate">>) {
    await ensureWorkspaceLoaded();
    const nextPrograms = programs.map((program) => program.id === programId
      ? updateProgramStructure(program, weekId, (week) => ({ ...week, days: week.days.map((currentDay) => currentDay.id === dayId ? { ...currentDay, name: day.name.trim() || currentDay.name, focus: day.focus.trim() || currentDay.focus, ...(isIsoDate(day.scheduledDate) ? { scheduledDate: day.scheduledDate, scheduleUpdatedBy: "coach" as const, scheduleUpdatedAt: new Date().toISOString() } : {}) } : currentDay) }))
      : program);
    await persistPrograms(nextPrograms);
  }

  async function deleteDay(programId: string, weekId: string, dayId: string) {
    await ensureWorkspaceLoaded();
    const nextPrograms = programs.map((program) => program.id === programId
      ? updateProgramStructure(program, weekId, (week) => ({ ...week, days: week.days.filter((day) => day.id !== dayId) }))
      : program);
    await persistPrograms(nextPrograms);
    await persistComments(comments.filter((comment) => comment.dayId !== dayId));
    await persistDayLogs(dayLogs.filter((dayLog) => dayLog.programId !== programId || dayLog.dayId !== dayId));
  }

  async function rescheduleDay(programId: string, weekId: string, dayId: string, scheduledDate: string, updatedBy: DayScheduleAuthor) {
    await ensureWorkspaceLoaded();
    const nextPrograms = programs.map((program) => program.id === programId
      ? updateProgramStructure(program, weekId, (week) => ({ ...week, days: week.days.map((day) => day.id === dayId ? { ...day, scheduledDate, scheduleUpdatedBy: updatedBy, scheduleUpdatedAt: new Date().toISOString() } : day) }))
      : program);
    await persistPrograms(nextPrograms);
  }

  async function rescheduleWeek(programId: string, weekId: string, startDate: string, updatedBy: DayScheduleAuthor) {
    await ensureWorkspaceLoaded();
    const nextPrograms = programs.map((program) => program.id === programId
      ? updateProgramStructure(program, weekId, (week) => ({ ...week, days: [...week.days].sort((left, right) => left.sequence - right.sequence).map((day, index) => ({ ...day, scheduledDate: addCalendarDays(startDate, index), scheduleUpdatedBy: updatedBy, scheduleUpdatedAt: new Date().toISOString() })) }))
      : program);
    await persistPrograms(nextPrograms);
  }

  async function addExercise(programId: string, weekId: string, dayId: string, category: ExerciseCategory, input?: Partial<Pick<ProgramExercise, "name" | "sets" | "repetitions" | "prescriptionMode" | "prescriptionValue" | "weightUnit">>): Promise<ProgramExercise> {
    await ensureWorkspaceLoaded();
    const targetDay = programs.find((program) => program.id === programId)?.weeks.find((week) => week.id === weekId)?.days.find((day) => day.id === dayId);
    if (!targetDay) {
      throw new Error("The training day is no longer available.");
    }
    const nextExercise = { ...createExercise(category), ...input };
    const nextPrograms = programs.map((program) => program.id === programId
      ? updateProgramStructure(program, weekId, (week) => ({ ...week, days: week.days.map((day) => day.id === dayId ? { ...day, exercises: [...day.exercises, nextExercise] } : day) }))
      : program);
    await persistPrograms(nextPrograms);
    return nextExercise;
  }

  async function updateExercise(programId: string, weekId: string, dayId: string, exercise: ProgramExercise) {
    await ensureWorkspaceLoaded();
    const nextPrograms = programs.map((program) => program.id === programId
      ? updateProgramStructure(program, weekId, (week) => ({ ...week, days: week.days.map((day) => day.id === dayId ? { ...day, exercises: day.exercises.map((currentExercise) => currentExercise.id === exercise.id ? exercise : currentExercise) } : day) }))
      : program);
    await persistPrograms(nextPrograms);
  }

  async function deleteExercise(programId: string, weekId: string, dayId: string, exerciseId: string) {
    await ensureWorkspaceLoaded();
    const nextPrograms = programs.map((program) => program.id === programId
      ? updateProgramStructure(program, weekId, (week) => ({ ...week, days: week.days.map((day) => day.id === dayId ? { ...day, exercises: day.exercises.filter((exercise) => exercise.id !== exerciseId) } : day) }))
      : program);
    await persistPrograms(nextPrograms);
    await persistDayLogs(dayLogs.map((dayLog) => dayLog.programId === programId && dayLog.dayId === dayId
      ? { ...dayLog, sets: dayLog.sets.filter((set) => set.exerciseId !== exerciseId), updatedAt: new Date().toISOString() }
      : dayLog).filter((dayLog) => dayLog.sets.length));
  }

  async function logDaySet(programId: string, dayId: string, exerciseId: string, setNumber: number, completionStatus: ProgramSetCompletionStatus, actualWeight?: number, weightUnit?: WeightUnit) {
    await ensureWorkspaceLoaded();
    const now = new Date().toISOString();
    const exercise = programs.find((program) => program.id === programId)?.weeks.flatMap((week) => week.days).find((day) => day.id === dayId)?.exercises.find((candidate) => candidate.id === exerciseId);
    if (completionStatus === "done" && exercise?.prescriptionMode !== "exact" && (!Number.isFinite(actualWeight) || actualWeight === undefined || actualWeight <= 0)) {
      throw new Error("Enter the weight lifted before completing an RPE or RIR set.");
    }
    const existingDayLog = dayLogs.find((dayLog) => dayLog.programId === programId && dayLog.dayId === dayId);
    const existingSets = existingDayLog?.sets ?? [];
    const previousSet = existingSets.find((set) => set.exerciseId === exerciseId && set.setNumber === setNumber);
    const nextSet: ProgramDaySetLog = completionStatus === "pending"
      ? { exerciseId, setNumber, completionStatus, instagramVideoUrl: previousSet?.instagramVideoUrl, videoAnalysis: previousSet?.videoAnalysis }
      : {
        exerciseId,
        setNumber,
        completionStatus,
        completedAt: now,
        ...(completionStatus === "done" ? { actualWeight: exercise?.prescriptionMode === "exact" ? exercise.prescriptionValue : actualWeight, weightUnit: exercise?.weightUnit ?? weightUnit } : {}),
        ...(previousSet?.instagramVideoUrl ? { instagramVideoUrl: previousSet.instagramVideoUrl } : {}),
        ...(previousSet?.videoAnalysis ? { videoAnalysis: previousSet.videoAnalysis } : {})
      };
    const nextSets = [
      ...existingSets.filter((set) => set.exerciseId !== exerciseId || set.setNumber !== setNumber),
      nextSet
    ].filter((set) => set.completionStatus !== "pending" || Boolean(set.instagramVideoUrl) || Boolean(set.videoAnalysis));
    const otherDayLogs = dayLogs.filter((dayLog) => dayLog.programId !== programId || dayLog.dayId !== dayId);
    const nextDayLogs = nextSets.length
      ? [...otherDayLogs, { programId, dayId, sets: nextSets, sessionRating: existingDayLog?.sessionRating, ratedAt: existingDayLog?.ratedAt, updatedAt: now }]
      : otherDayLogs;
    await persistDayLogs(nextDayLogs);
  }

  async function updateDaySetInstagramLink(programId: string, dayId: string, exerciseId: string, setNumber: number, instagramVideoUrl: string) {
    await ensureWorkspaceLoaded();
    const now = new Date().toISOString();
    const existingDayLog = dayLogs.find((dayLog) => dayLog.programId === programId && dayLog.dayId === dayId);
    const existingSets = existingDayLog?.sets ?? [];
    const previousSet = existingSets.find((set) => set.exerciseId === exerciseId && set.setNumber === setNumber);
    const nextSets = [
      ...existingSets.filter((set) => set.exerciseId !== exerciseId || set.setNumber !== setNumber),
      { exerciseId, setNumber, completionStatus: previousSet?.completionStatus ?? "pending", completedAt: previousSet?.completedAt, actualWeight: previousSet?.actualWeight, weightUnit: previousSet?.weightUnit, instagramVideoUrl, videoAnalysis: previousSet?.videoAnalysis }
    ];
    const otherDayLogs = dayLogs.filter((dayLog) => dayLog.programId !== programId || dayLog.dayId !== dayId);
    await persistDayLogs([...otherDayLogs, { programId, dayId, sets: nextSets, sessionRating: existingDayLog?.sessionRating, ratedAt: existingDayLog?.ratedAt, updatedAt: now }]);
  }

  async function updateDaySetVideoAnalysis(programId: string, dayId: string, exerciseId: string, setNumber: number, videoAnalysis: LiftVideoAnalysis) {
    await ensureWorkspaceLoaded();
    const now = new Date().toISOString();
    const existingDayLog = dayLogs.find((dayLog) => dayLog.programId === programId && dayLog.dayId === dayId);
    const existingSets = existingDayLog?.sets ?? [];
    const previousSet = existingSets.find((set) => set.exerciseId === exerciseId && set.setNumber === setNumber);
    const nextSets = [
      ...existingSets.filter((set) => set.exerciseId !== exerciseId || set.setNumber !== setNumber),
      { exerciseId, setNumber, completionStatus: previousSet?.completionStatus ?? "pending", completedAt: previousSet?.completedAt, actualWeight: previousSet?.actualWeight, weightUnit: previousSet?.weightUnit, instagramVideoUrl: previousSet?.instagramVideoUrl, videoAnalysis }
    ];
    const otherDayLogs = dayLogs.filter((dayLog) => dayLog.programId !== programId || dayLog.dayId !== dayId);
    await persistDayLogs([...otherDayLogs, { programId, dayId, sets: nextSets, sessionRating: existingDayLog?.sessionRating, ratedAt: existingDayLog?.ratedAt, updatedAt: now }]);
  }

  async function updateDayRating(programId: string, dayId: string, sessionRating: number | null) {
    await ensureWorkspaceLoaded();
    const now = new Date().toISOString();
    const existingDayLog = dayLogs.find((dayLog) => dayLog.programId === programId && dayLog.dayId === dayId);
    const otherDayLogs = dayLogs.filter((dayLog) => dayLog.programId !== programId || dayLog.dayId !== dayId);
    if (sessionRating === null && !existingDayLog?.sets.length) {
      await persistDayLogs(otherDayLogs);
      return;
    }
    await persistDayLogs([...otherDayLogs, {
      programId,
      dayId,
      sets: existingDayLog?.sets ?? [],
      ...(sessionRating === null ? {} : { sessionRating, ratedAt: now }),
      updatedAt: now
    }]);
  }

  async function addComment(comment: Omit<ProgramComment, "id" | "createdAt">) {
    await ensureWorkspaceLoaded();
    await persistComments([...comments, { ...comment, id: createId("comment"), createdAt: new Date().toISOString() }]);
  }

  return {
    programs: snapshot.programs,
    templates: snapshot.templates,
    comments: snapshot.comments,
    dayLogs: snapshot.dayLogs,
    isLoading: snapshot.isLoading,
    createProgram,
    updateProgram,
    deleteProgram,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addTemplateWeek,
    updateTemplateWeek,
    addTemplateDay,
    updateTemplateDay,
    addTemplateExercise,
    updateTemplateExercise,
    assignTemplate,
    addWeek,
    updateWeek,
    deleteWeek,
    addDay,
    updateDay,
    deleteDay,
    rescheduleDay,
    rescheduleWeek,
    addExercise,
    updateExercise,
    deleteExercise,
    logDaySet,
    updateDaySetInstagramLink,
    updateDaySetVideoAnalysis,
    updateDayRating,
    addComment
  };
}

function createTemplateWeek(weekNumber: number, name = `Week ${weekNumber}`): ProgramTemplateWeek {
  return { id: createId("template-week"), weekNumber, name, days: [] };
}

function createTemplateDay(name: string, focus: string, exercises: ProgramExercise[] = [], sequence = 0): ProgramTemplateDay {
  return { id: createId("template-day"), sequence, name, focus, exercises };
}

function normalizeTemplate(value: unknown): ProgramTemplate | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<ProgramTemplate>;
  if (typeof candidate.id !== "string" || typeof candidate.coachId !== "string" || typeof candidate.name !== "string" || !isProgramPhase(candidate.phase) || typeof candidate.goal !== "string" || typeof candidate.trainingDaysPerWeek !== "number" || !Number.isInteger(candidate.trainingDaysPerWeek) || typeof candidate.createdAt !== "string" || typeof candidate.updatedAt !== "string" || !Array.isArray(candidate.weeks)) {
    return null;
  }
  return {
    id: candidate.id,
    coachId: candidate.coachId,
    name: candidate.name,
    phase: candidate.phase,
    goal: candidate.goal,
    trainingDaysPerWeek: candidate.trainingDaysPerWeek,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
    weeks: candidate.weeks.map((rawWeek, weekIndex) => {
      const week = rawWeek as Partial<ProgramTemplateWeek>;
      return {
        id: typeof week.id === "string" ? week.id : createId("template-week"),
        weekNumber: typeof week.weekNumber === "number" && Number.isInteger(week.weekNumber) ? week.weekNumber : weekIndex + 1,
        name: typeof week.name === "string" ? week.name : `Week ${weekIndex + 1}`,
        days: Array.isArray(week.days) ? week.days.map((rawDay, dayIndex) => {
          const day = rawDay as Partial<ProgramTemplateDay>;
          return {
            id: typeof day.id === "string" ? day.id : createId("template-day"),
            sequence: typeof day.sequence === "number" && Number.isInteger(day.sequence) && day.sequence > 0 ? day.sequence : dayIndex + 1,
            name: typeof day.name === "string" ? day.name : `Day ${dayIndex + 1}`,
            focus: typeof day.focus === "string" ? day.focus : "Training day",
            exercises: Array.isArray(day.exercises) ? day.exercises as ProgramExercise[] : []
          };
        }) : []
      };
    })
  };
}

function updateTemplateStructure(template: ProgramTemplate, weekId: string, change: (week: ProgramTemplateWeek) => ProgramTemplateWeek): ProgramTemplate {
  return { ...template, updatedAt: new Date().toISOString(), weeks: template.weeks.map((week) => week.id === weekId ? change(week) : week) };
}