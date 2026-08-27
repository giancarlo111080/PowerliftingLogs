export type SetCompletionStatus = "pending" | "done" | "skipped";
export type SetIntent = "warm-up" | "working" | "back-off" | "accessory";
export type SyncCommandType = "log-set" | "skip-set" | "attach-instagram-video" | "add-comment";

export interface TrainingSet {
  id: string;
  setNumber: number;
  intent: SetIntent;
  targetRepetitions: number;
  targetLoadKg: number;
  targetRpe: number;
  targetEstimatedOneRepMaxKg: number;
  completionStatus: SetCompletionStatus;
  actualLoadKg?: number;
  actualRepetitions?: number;
  actualRpe?: number;
  actualEstimatedOneRepMaxKg?: number;
  actualEffortPercentage?: number;
  completedAt?: string;
  instagramVideoUrl?: string;
  athleteNote?: string;
  coachFormFlags?: string;
}

export interface PrescribedExercise {
  id: string;
  name: string;
  exerciseType: "squat" | "bench-press" | "deadlift" | "overhead-press" | "accessory" | "conditioning";
  exerciseTypeModifier: number;
  sortOrder: number;
  targetEstimatedOneRepMaxKg: number;
  sets: TrainingSet[];
}

export interface WorkoutDay {
  id: string;
  name: string;
  focus: string;
  scheduledFor: string;
  exercises: PrescribedExercise[];
}

export interface AthleteDashboard {
  id: string;
  displayName: string;
  bodyWeightKg: number;
  competitionWeightClass: string;
  activeBlockTag: string;
  upcomingMeetIdentifier: string;
  squatOneRepMaxKg: number;
  benchOneRepMaxKg: number;
  deadliftOneRepMaxKg: number;
  readinessScore: number;
  acuteLoad: number;
  chronicLoad: number;
  workoutStreak: number;
  experiencePoints: number;
}

export interface WorkoutSnapshot {
  athlete: AthleteDashboard;
  day: WorkoutDay;
}

export interface SyncCommand {
  commandId: string;
  athleteProfileId: string;
  aggregateId: string;
  commandType: SyncCommandType;
  payloadJson: string;
  deviceId: string;
  createdAt: string;
  retryCount: number;
}

export interface SyncCommandOutcome {
  commandId: string;
  status: "pending" | "processed" | "rejected";
  rejectionReason?: string;
}

export interface SetUpdateInput {
  setId: string;
  completionStatus: Exclude<SetCompletionStatus, "pending">;
  actualLoadKg?: number;
  actualRepetitions?: number;
  actualRpe?: number;
}

export interface InstagramLinkInput {
  setId: string;
  instagramVideoUrl: string;
}
