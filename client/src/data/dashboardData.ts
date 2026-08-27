import type { PlatformProfile } from "../auth/AuthSessionContext";
import type { WorkoutSnapshot } from "../types/training";

export interface WorkoutProgress {
  completedSets: number;
  totalSets: number;
  plannedTonnageKg: number;
  completedTonnageKg: number;
}

export interface CoachAthleteInsight {
  athleteId: string;
  readiness: number;
  lastSession: string;
  adherencePercent: number;
  syncStatus: "Synced" | "Queued" | "Needs review";
  plannedTonnageKg: number;
  completedTonnageKg: number;
  attention: "Low readiness" | "New video" | "Pending work" | "On track";
}

export interface CoachReviewItem {
  id: string;
  athleteId: string;
  athleteName: string;
  lift: string;
  note: string;
  instagramUrl?: string;
  status: "New video" | "Coach flag" | "Day comment";
}

export interface Achievement {
  code: string;
  title: string;
  detail: string;
}

const insightByAthleteId: Record<string, Omit<CoachAthleteInsight, "athleteId">> = {
  "a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9": {
    readiness: 84,
    lastSession: "Today, 16:18",
    adherencePercent: 88,
    syncStatus: "Needs review",
    plannedTonnageKg: 5255,
    completedTonnageKg: 2130,
    attention: "New video"
  },
  "4ef9844a-37de-42f6-bd31-ad587265ee90": {
    readiness: 58,
    lastSession: "Yesterday, 18:42",
    adherencePercent: 92,
    syncStatus: "Synced",
    plannedTonnageKg: 4120,
    completedTonnageKg: 3790,
    attention: "Low readiness"
  },
  "270e0142-a437-44bc-9dcd-dd43676fd4b0": {
    readiness: 76,
    lastSession: "2 days ago",
    adherencePercent: 76,
    syncStatus: "Queued",
    plannedTonnageKg: 3680,
    completedTonnageKg: 2800,
    attention: "Pending work"
  },
  "f0be3194-989f-4a36-9c8f-9c27eaf7e3da": {
    readiness: 89,
    lastSession: "Today, 07:31",
    adherencePercent: 96,
    syncStatus: "Synced",
    plannedTonnageKg: 5960,
    completedTonnageKg: 5960,
    attention: "On track"
  }
};

export const achievements: Achievement[] = [
  { code: "streak-6", title: "Six-day streak", detail: "Logged training across six consecutive days" },
  { code: "squat-pr", title: "Squat PR", detail: "215 kg competition squat baseline" },
  { code: "peak-ready", title: "Peak ready", detail: "Completed the prior block on schedule" }
];

export const coachReviewItems: CoachReviewItem[] = [
  {
    id: "review-alex-squat",
    athleteId: "a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9",
    athleteName: "Alex Morgan",
    lift: "Competition squat - set 1",
    note: "Depth was consistent. Hold the brace through the walkout.",
    instagramUrl: "https://www.instagram.com/reel/C9DemoSquat1/",
    status: "New video"
  },
  {
    id: "review-jordan-deadlift",
    athleteId: "4ef9844a-37de-42f6-bd31-ad587265ee90",
    athleteName: "Jordan Lee",
    lift: "Deadlift top set",
    note: "Readiness is below the block target. Confirm sleep and lower back status.",
    status: "Coach flag"
  },
  {
    id: "review-mina-message",
    athleteId: "270e0142-a437-44bc-9dcd-dd43676fd4b0",
    athleteName: "Mina Patel",
    lift: "Bench volume",
    note: "Asked whether the final two sets should move to tomorrow.",
    status: "Day comment"
  }
];

export function getWorkoutProgress(workout: WorkoutSnapshot): WorkoutProgress {
  const sets = workout.day.exercises.flatMap((exercise) => exercise.sets);
  const completed = sets.filter((set) => set.completionStatus === "done");
  return {
    completedSets: completed.length,
    totalSets: sets.length,
    plannedTonnageKg: sets.reduce((total, set) => total + set.targetLoadKg * set.targetRepetitions, 0),
    completedTonnageKg: completed.reduce((total, set) => total + (set.actualLoadKg ?? set.targetLoadKg) * (set.actualRepetitions ?? set.targetRepetitions), 0)
  };
}

export function getCoachInsights(profiles: PlatformProfile[]): CoachAthleteInsight[] {
  return profiles
    .filter((profile) => profile.role === "ATHLETE")
    .map((profile) => ({
      athleteId: profile.id,
      ...insightByAthleteId[profile.id]
    }))
    .filter((insight): insight is CoachAthleteInsight => Boolean(insight.readiness));
}

export function formatTonnage(value: number): string {
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} t`;
}