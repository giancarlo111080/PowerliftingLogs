import AsyncStorage from "@react-native-async-storage/async-storage";

import { demoWorkout } from "./demoWorkout";
import { isInstagramVideoUrl } from "../lib/instagram";
import type {
  InstagramLinkInput,
  SetUpdateInput,
  SyncCommand,
  SyncCommandOutcome,
  WorkoutSnapshot
} from "../types/training";

const WORKOUT_KEY = "powerlifting-program/workout";
const COMMANDS_KEY = "powerlifting-program/sync-commands";
const DEVICE_KEY = "powerlifting-program/device-id";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
const staticDemo = process.env.EXPO_PUBLIC_STATIC_DEMO === "true" || !apiBaseUrl;

export interface LocalMutationResult {
  snapshot: WorkoutSnapshot;
  commands: SyncCommand[];
}

export interface SyncResult {
  commands: SyncCommand[];
  rejectedCount: number;
}

function cloneDemoWorkout(): WorkoutSnapshot {
  return JSON.parse(JSON.stringify(demoWorkout)) as WorkoutSnapshot;
}

function createUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

async function deviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) {
    return existing;
  }

  const identifier = createUuid();
  await AsyncStorage.setItem(DEVICE_KEY, identifier);
  return identifier;
}

export async function loadWorkout(): Promise<WorkoutSnapshot> {
  try {
    const stored = await AsyncStorage.getItem(WORKOUT_KEY);
    if (stored) {
      return JSON.parse(stored) as WorkoutSnapshot;
    }

    const snapshot = cloneDemoWorkout();
    await AsyncStorage.setItem(WORKOUT_KEY, JSON.stringify(snapshot));
    return snapshot;
  }
  catch {
    return cloneDemoWorkout();
  }
}

export async function loadCommands(): Promise<SyncCommand[]> {
  const stored = await AsyncStorage.getItem(COMMANDS_KEY);
  return stored ? (JSON.parse(stored) as SyncCommand[]) : [];
}

function updateSet(
  snapshot: WorkoutSnapshot,
  setId: string,
  update: (set: WorkoutSnapshot["day"]["exercises"][number]["sets"][number]) => void
): WorkoutSnapshot {
  const next = JSON.parse(JSON.stringify(snapshot)) as WorkoutSnapshot;
  for (const exercise of next.day.exercises) {
    const trainingSet = exercise.sets.find((set) => set.id === setId);
    if (trainingSet) {
      update(trainingSet);
      return next;
    }
  }

  throw new Error("The selected training set is no longer available locally.");
}

async function save(snapshot: WorkoutSnapshot, commands: SyncCommand[]): Promise<LocalMutationResult> {
  await AsyncStorage.multiSet([
    [WORKOUT_KEY, JSON.stringify(snapshot)],
    [COMMANDS_KEY, JSON.stringify(commands)]
  ]);
  return { snapshot, commands };
}

function effortFromRpe(rpe: number): number {
  return Math.min(1, Math.max(0.5, 0.7 + ((rpe - 1) * 0.3) / 9));
}

export async function persistSetUpdate(input: SetUpdateInput): Promise<LocalMutationResult> {
  const snapshot = await loadWorkout();
  const now = new Date().toISOString();
  const next = updateSet(snapshot, input.setId, (set) => {
    set.completionStatus = input.completionStatus;
    set.actualLoadKg = input.completionStatus === "done" ? input.actualLoadKg ?? set.targetLoadKg : undefined;
    set.actualRepetitions = input.completionStatus === "done" ? input.actualRepetitions ?? set.targetRepetitions : undefined;
    set.actualRpe = input.completionStatus === "done" ? input.actualRpe ?? set.targetRpe : undefined;
    set.actualEstimatedOneRepMaxKg = input.completionStatus === "done"
      ? Math.round((set.actualLoadKg ?? set.targetLoadKg) * (36 / (37 - (set.actualRepetitions ?? set.targetRepetitions))) * 10) / 10
      : undefined;
    set.actualEffortPercentage = input.completionStatus === "done"
      ? effortFromRpe(set.actualRpe ?? set.targetRpe)
      : undefined;
    set.completedAt = input.completionStatus === "done" ? now : undefined;
  });
  const commands = await loadCommands();
  const updatedSet = next.day.exercises.flatMap((exercise) => exercise.sets).find((set) => set.id === input.setId);
  if (!updatedSet) {
    throw new Error("The updated training set could not be found.");
  }
  const commandId = createUuid();
  const payload = {
    idempotencyKey: commandId,
    athleteProfileId: next.athlete.id,
    trainingSetId: updatedSet.id,
    completionStatus: input.completionStatus === "done" ? "Done" : "Skipped",
    actualLoadKg: updatedSet.actualLoadKg,
    actualRepetitions: updatedSet.actualRepetitions,
    actualRpe: updatedSet.actualRpe,
    actualEstimatedOneRepMaxKg: updatedSet.actualEstimatedOneRepMaxKg,
    actualEffortPercentage: updatedSet.actualEffortPercentage,
    instagramVideoUrl: updatedSet.instagramVideoUrl,
    athleteNote: updatedSet.athleteNote
  };
  commands.push({
    commandId,
    athleteProfileId: next.athlete.id,
    aggregateId: updatedSet.id,
    commandType: input.completionStatus === "done" ? "log-set" : "skip-set",
    payloadJson: JSON.stringify(payload),
    deviceId: await deviceId(),
    createdAt: now,
    retryCount: 0
  });

  return save(next, commands);
}

export async function persistInstagramLink(input: InstagramLinkInput): Promise<LocalMutationResult> {
  if (!isInstagramVideoUrl(input.instagramVideoUrl)) {
    throw new Error("Use a public Instagram post or reel link.");
  }

  const snapshot = await loadWorkout();
  const next = updateSet(snapshot, input.setId, (set) => {
    set.instagramVideoUrl = input.instagramVideoUrl.trim();
  });
  const commands = await loadCommands();
  const commandId = createUuid();
  commands.push({
    commandId,
    athleteProfileId: next.athlete.id,
    aggregateId: input.setId,
    commandType: "attach-instagram-video",
    payloadJson: JSON.stringify({
      trainingSetId: input.setId,
      instagramVideoUrl: input.instagramVideoUrl.trim(),
      athleteNote: null,
      coachFormFlags: null
    }),
    deviceId: await deviceId(),
    createdAt: new Date().toISOString(),
    retryCount: 0
  });

  return save(next, commands);
}

export async function flushSyncLedger(): Promise<SyncResult> {
  const commands = await loadCommands();
  if (!commands.length) {
    return { commands, rejectedCount: 0 };
  }

  if (staticDemo) {
    await AsyncStorage.setItem(COMMANDS_KEY, "[]");
    return { commands: [], rejectedCount: 0 };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(commands)
    });
    if (!response.ok) {
      throw new Error(`Sync failed with status ${response.status}.`);
    }

    const outcomes = (await response.json()) as SyncCommandOutcome[];
    const outcomeById = new Map(outcomes.map((outcome) => [outcome.commandId, outcome]));
    const rejected = commands.filter((command) => outcomeById.get(command.commandId)?.status === "rejected");
    const pending = commands.filter((command) => !outcomeById.has(command.commandId));
    const retryable = pending.map((command) => ({ ...command, retryCount: command.retryCount + 1 }));
    const remaining = [...rejected, ...retryable];
    await AsyncStorage.setItem(COMMANDS_KEY, JSON.stringify(remaining));
    return { commands: remaining, rejectedCount: rejected.length };
  } catch {
    const retryable = commands.map((command) => ({ ...command, retryCount: command.retryCount + 1 }));
    await AsyncStorage.setItem(COMMANDS_KEY, JSON.stringify(retryable));
    return { commands: retryable, rejectedCount: 0 };
  }
}

export function applySetUpdateOptimistically(snapshot: WorkoutSnapshot, input: SetUpdateInput): WorkoutSnapshot {
  return updateSet(snapshot, input.setId, (set) => {
    set.completionStatus = input.completionStatus;
    set.actualLoadKg = input.completionStatus === "done" ? input.actualLoadKg ?? set.targetLoadKg : undefined;
    set.actualRepetitions = input.completionStatus === "done" ? input.actualRepetitions ?? set.targetRepetitions : undefined;
    set.actualRpe = input.completionStatus === "done" ? input.actualRpe ?? set.targetRpe : undefined;
    set.completedAt = input.completionStatus === "done" ? new Date().toISOString() : undefined;
  });
}

export function applyInstagramLinkOptimistically(snapshot: WorkoutSnapshot, input: InstagramLinkInput): WorkoutSnapshot {
  return updateSet(snapshot, input.setId, (set) => {
    set.instagramVideoUrl = input.instagramVideoUrl.trim();
  });
}
