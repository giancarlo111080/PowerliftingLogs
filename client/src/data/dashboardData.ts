import type { PlatformProfile } from "../auth/AuthSessionContext";
import { getProgramAnalytics } from "./programAnalytics";
import type { ProgramComment, ProgramDayLog, TrainingProgram } from "./programWorkspaceStore";
export interface CoachAthleteInsight {
  athleteId: string;
  readiness: number | null;
  lastSession: string;
  lastSessionAt: string | null;
  adherencePercent: number | null;
  syncStatus: "No program" | "Not started" | "In progress" | "Complete";
  completedTonnageKg: number;
  plannedSets: number;
  completedSets: number;
  skippedSets: number;
  activeProgramName: string | null;
  attention: "No active program" | "Low readiness" | "New video" | "Pending work" | "On track";
}
export interface CoachReviewItem {
  id: string;
  athleteId: string;
  athleteName: string;
  lift: string;
  note: string;
  instagramUrl?: string;
  status: "New video" | "Day comment";
}

function activeProgramFor(athleteId: string, programs: TrainingProgram[]) {
  const athletePrograms = programs
    .filter((program) => program.athleteId === athleteId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return athletePrograms.find((program) => program.status === "active") ?? athletePrograms[0] ?? null;
}
function formatLastSession(value: string | null) {
  if (!value) {
    return "Not started";
  }
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? "Logged" : timestamp.toLocaleDateString();
}

export function getCoachInsights(profiles: PlatformProfile[], programs: TrainingProgram[], dayLogs: ProgramDayLog[]): CoachAthleteInsight[] {
  return profiles.filter((profile) => profile.role === "ATHLETE").map((profile) => {
    const program = activeProgramFor(profile.id, programs);
    const programLogs = program ? dayLogs.filter((dayLog) => dayLog.programId === program.id) : [];
    const analytics = getProgramAnalytics(program, programLogs);
    const lastSessionAt = programLogs.map((dayLog) => dayLog.updatedAt).sort((left, right) => right.localeCompare(left))[0] ?? null;
    const hasVideo = programLogs.some((dayLog) => dayLog.sets.some((set) => set.instagramVideoUrl || set.videoAnalysis));
    const handledSets = analytics.completedSets + analytics.skippedSets;
    const syncStatus = !program ? "No program" : analytics.plannedSets > 0 && analytics.remainingSets === 0 ? "Complete" : handledSets > 0 ? "In progress" : "Not started";
    const attention = !program ? "No active program" : analytics.currentReadinessScore < 65 ? "Low readiness" : hasVideo ? "New video" : analytics.remainingSets > 0 && handledSets > 0 ? "Pending work" : "On track";
    return {
      athleteId: profile.id,
      readiness: program ? analytics.currentReadinessScore : null,
      lastSession: formatLastSession(lastSessionAt),
      lastSessionAt,
      adherencePercent: program ? analytics.adherencePercent : null,
      syncStatus,
      completedTonnageKg: analytics.completedTonnageKg,
      plannedSets: analytics.plannedSets,
      completedSets: analytics.completedSets,
      skippedSets: analytics.skippedSets,
      activeProgramName: program?.name ?? null,
      attention
    };
  });
}

export function getCoachReviewItems(profiles: PlatformProfile[], programs: TrainingProgram[], dayLogs: ProgramDayLog[], comments: ProgramComment[]): CoachReviewItem[] {
  const profileById = new Map(profiles.filter((profile) => profile.role === "ATHLETE").map((profile) => [profile.id, profile]));
  const programById = new Map(programs.filter((program) => profileById.has(program.athleteId)).map((program) => [program.id, program]));
  const items: CoachReviewItem[] = [];

  for (const dayLog of dayLogs) {
    const program = programById.get(dayLog.programId);
    const athlete = program ? profileById.get(program.athleteId) : null;
    const day = program?.weeks.flatMap((week) => week.days).find((candidate) => candidate.id === dayLog.dayId);
    if (!program || !athlete || !day) {
      continue;
    }
    for (const set of dayLog.sets) {
      if (!set.instagramVideoUrl && !set.videoAnalysis) {
        continue;
      }
      const exercise = day.exercises.find((candidate) => candidate.id === set.exerciseId);
      items.push({
        id: `${program.id}:${day.id}:${set.exerciseId}:${set.setNumber}:video`,
        athleteId: athlete.id,
        athleteName: athlete.displayName,
        lift: `${exercise?.name ?? "Training set"} - set ${set.setNumber}`,
        note: set.videoAnalysis ? `${set.videoAnalysis.estimatedRepetitions} repetitions detected with ${set.videoAnalysis.confidence} confidence.` : "Linked footage is ready for coach review.",
        instagramUrl: set.instagramVideoUrl,
        status: "New video"
      });
    }
  }

  for (const comment of comments.filter((candidate) => candidate.authorRole === "lifter")) {
    const program = programById.get(comment.programId);
    const athlete = program ? profileById.get(program.athleteId) : null;
    if (!program || !athlete) {
      continue;
    }
    const day = program.weeks.flatMap((week) => week.days).find((candidate) => candidate.id === comment.dayId);
    items.push({
      id: comment.id,
      athleteId: athlete.id,
      athleteName: athlete.displayName,
      lift: day?.name ?? "Training day",
      note: comment.body,
      status: "Day comment"
    });
  }

  return items;
}

export function formatTonnage(value: number): string {
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} t`;
}
