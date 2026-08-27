import { getProgramAnalytics } from "./programAnalytics";
import type { ProgramDayLog, ProgramExercise, TrainingProgram } from "./programWorkspaceStore";

export interface RecoverySignal {
  sleep: number;
  soreness: number;
  stress: number;
  pain: number;
  motivation: number;
  recordedAt: string;
}

export type AdaptiveAction = "reduce-top-set" | "add-backoff-set" | "hold-load" | "move-deadlifts" | "begin-deload" | "update-e1rm";

export interface AdaptiveRecommendation {
  id: string;
  tenantId: string;
  athleteId: string;
  action: AdaptiveAction;
  scope: "exercise" | "day" | "program";
  title: string;
  rationale: string;
  evidence: string[];
  confidence: "low" | "moderate" | "high";
  uncertainty: string;
  contraindications: string[];
  expectedOutcome: string;
  generatedAt: string;
  expiresAt: string;
  ruleVersion: string;
  modelVersion: string | null;
  source: "adaptive-rules";
  schemaVersion: 1;
  programId: string;
  weekId?: string;
  dayId?: string;
  exerciseId?: string;
  before: string;
  after: string;
  patch?: { sets?: number; prescriptionValue?: number; scheduledDate?: string };
}

export interface StrengthProjection {
  medianKg: number | null;
  lower50Kg: number | null;
  upper50Kg: number | null;
  lower90Kg: number | null;
  upper90Kg: number | null;
  confidence: "insufficient" | "low" | "moderate" | "high";
  sampleSize: number;
}

export interface WarmUpSet {
  loadKg: number;
  platesPerSide: number[];
  repetitions: number;
}

type RecommendationDraft = Omit<AdaptiveRecommendation, "tenantId" | "athleteId" | "scope" | "uncertainty" | "contraindications" | "expectedOutcome" | "generatedAt" | "expiresAt" | "ruleVersion" | "modelVersion" | "source" | "schemaVersion">;

const dayMs = 86_400_000;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundToIncrement(value: number, increment = 2.5) {
  return Math.round(value / increment) * increment;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calculateRecoveryReadiness(signal?: RecoverySignal) {
  if (!signal) return 100;
  return clamp(Math.round(signal.sleep * 2.5 + signal.motivation * 2.5 + (10 - signal.soreness) * 2 + (10 - signal.stress) * 1.5 + (10 - signal.pain) * 1.5), 0, 100);
}

export function projectStrength(program: TrainingProgram | null, dayLogs: ProgramDayLog[], category: "squat" | "bench" | "deadlift", baseline?: number): StrengthProjection {
  if (!program) return { medianKg: baseline ?? null, lower50Kg: null, upper50Kg: null, lower90Kg: null, upper90Kg: null, confidence: "insufficient", sampleSize: 0 };
  const exercises = new Map(program.weeks.flatMap((week) => week.days).flatMap((day) => day.exercises).filter((exercise) => exercise.category === category).map((exercise) => [exercise.id, exercise]));
  const estimates = dayLogs.filter((log) => log.programId === program.id).sort((left, right) => left.updatedAt.localeCompare(right.updatedAt)).flatMap((log) => {
    const sessionEstimates = log.sets.flatMap((set) => {
      const exercise = exercises.get(set.exerciseId);
      if (!exercise || set.completionStatus !== "done" || !set.actualWeight) return [];
      const kg = (set.weightUnit ?? exercise.weightUnit) === "lb" ? set.actualWeight * 0.45359237 : set.actualWeight;
      return [kg * (1 + exercise.repetitions / 30)];
    });
    return sessionEstimates.length ? [Math.max(...sessionEstimates)] : [];
  });
  if (!estimates.length) return { medianKg: baseline ?? null, lower50Kg: null, upper50Kg: null, lower90Kg: null, upper90Kg: null, confidence: "insufficient", sampleSize: 0 };
  const weighted = estimates.slice(-5);
  const median = roundToIncrement(weighted.reduce((total, estimate) => total + estimate, 0) / weighted.length, 0.5);
  const uncertainty = weighted.length >= 4 ? 0.035 : weighted.length >= 2 ? 0.06 : 0.1;
  return {
    medianKg: median,
    lower50Kg: roundToIncrement(median * (1 - uncertainty / 2), 0.5),
    upper50Kg: roundToIncrement(median * (1 + uncertainty / 2), 0.5),
    lower90Kg: roundToIncrement(median * (1 - uncertainty), 0.5),
    upper90Kg: roundToIncrement(median * (1 + uncertainty), 0.5),
    confidence: weighted.length >= 4 ? "high" : weighted.length >= 2 ? "moderate" : "low",
    sampleSize: weighted.length
  };
}

function achievableLoad(target: number, barWeight: number, plates: number[]) {
  const sorted = [...plates].sort((left, right) => right - left);
  const perSideTarget = Math.max(0, (target - barWeight) / 2);
  const selected: number[] = [];
  let remaining = perSideTarget;
  for (const plate of sorted) {
    if (plate <= remaining + 0.001) {
      selected.push(plate);
      remaining -= plate;
    }
  }
  return { loadKg: barWeight + selected.reduce((total, plate) => total + plate * 2, 0), platesPerSide: selected };
}

export function generateWarmUps(targetKg: number, barWeightKg = 20, plates = [25, 20, 15, 10, 5, 2.5, 1.25], jumps = 5, readiness = 100): WarmUpSet[] {
  if (targetKg <= barWeightKg) return [{ loadKg: barWeightKg, platesPerSide: [], repetitions: 5 }];
  const count = clamp(Math.round(jumps), 3, 8);
  const start = readiness < 65 ? 0.35 : 0.4;
  const percentages = Array.from({ length: count }, (_, index) => start + ((0.9 - start) * index) / Math.max(1, count - 1));
  const sets = [{ loadKg: barWeightKg, platesPerSide: [] as number[], repetitions: 8 }, ...percentages.map((percentage, index) => ({ ...achievableLoad(targetKg * percentage, barWeightKg, plates), repetitions: index < 2 ? 5 - index * 2 : index === count - 1 ? 1 : 2 }))];
  return sets.filter((set, index) => set.loadKg < targetKg && (index === 0 || set.loadKg > sets[index - 1].loadKg));
}

function targetExercise(program: TrainingProgram) {
  for (const week of [...program.weeks].sort((left, right) => left.weekNumber - right.weekNumber)) {
    for (const day of [...week.days].sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate))) {
      const exercise = day.exercises.find((candidate) => candidate.category !== "accessory");
      if (exercise) return { week, day, exercise };
    }
  }
  return null;
}

function recommendationId(programId: string, action: AdaptiveAction, exercise?: ProgramExercise) {
  return `${programId}:${action}:${exercise?.id ?? "program"}`;
}

export function generateAdaptiveRecommendations(program: TrainingProgram | null, dayLogs: ProgramDayLog[], recoveryHistory: RecoverySignal[], meetDate?: string): AdaptiveRecommendation[] {
  if (!program) return [];
  const analytics = getProgramAnalytics(program, dayLogs);
  const latestRecovery = [...recoveryHistory].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0];
  const readiness = Math.min(analytics.currentReadinessScore, calculateRecoveryReadiness(latestRecovery));
  const target = targetExercise(program);
  if (!target) return [];
  if ((latestRecovery?.pain ?? 0) >= 4) return [];
  const { week, day, exercise } = target;
  const recommendations: RecommendationDraft[] = [];
  const base = { programId: program.id, weekId: week.id, dayId: day.id, exerciseId: exercise.id };
  const lowReadinessEvidence = [`Readiness ${readiness}/100`, `Program fatigue ${analytics.currentFatigueScore}/100`];

  if (readiness <= 60) {
    const nextValue = exercise.prescriptionMode === "exact" ? roundToIncrement(exercise.prescriptionValue * 0.95) : Math.max(1, exercise.prescriptionValue - 1);
    recommendations.push({ ...base, id: recommendationId(program.id, "reduce-top-set", exercise), action: "reduce-top-set", title: `Reduce ${exercise.name}`, rationale: "Readiness is below the safe exposure threshold.", evidence: lowReadinessEvidence, confidence: latestRecovery ? "high" : "moderate", before: `${exercise.prescriptionValue} ${exercise.prescriptionMode}`, after: `${nextValue} ${exercise.prescriptionMode}`, patch: { prescriptionValue: nextValue } });
  }
  if (readiness >= 75 && (latestRecovery?.pain ?? 0) < 4 && analytics.completedSets > 0) {
    recommendations.push({ ...base, id: recommendationId(program.id, "add-backoff-set", exercise), action: "add-backoff-set", title: `Add one ${exercise.name} back-off set`, rationale: "Readiness is stable and completed work remains within the volume cap.", evidence: [`Readiness ${readiness}/100`, `${analytics.completedSets} completed sets`], confidence: "moderate", before: `${exercise.sets} sets`, after: `${exercise.sets + 1} sets`, patch: { sets: exercise.sets + 1 } });
  }
  const analyses = dayLogs.filter((log) => log.programId === program.id).flatMap((log) => log.sets).map((set) => set.videoAnalysis).filter((analysis) => analysis && analysis.liftType === exercise.category && analysis.confidence === "high");
  const latestAnalysis = analyses.sort((left, right) => right!.analyzedAt.localeCompare(left!.analyzedAt))[0];
  if (latestAnalysis && ((latestAnalysis.velocityLossPercent ?? 0) >= 20 || (latestAnalysis.barPathHorizontalDriftCm ?? 0) >= 10)) {
    recommendations.push({ ...base, id: recommendationId(program.id, "hold-load", exercise), action: "hold-load", title: `Hold ${exercise.name} load`, rationale: "Recent high-confidence technique measurements declined under fatigue.", evidence: [`Velocity loss ${latestAnalysis.velocityLossPercent ?? "unavailable"}%`, `Bar drift ${latestAnalysis.barPathHorizontalDriftCm ?? "unavailable"} cm`], confidence: latestAnalysis.confidence, before: "Planned progression", after: "Hold current exposure" });
  }
  const deadliftTarget = program.weeks.flatMap((item) => item.days.map((candidate) => ({ week: item, day: candidate }))).find(({ day: candidate }) => candidate.exercises.some((item) => item.category === "deadlift"));
  const daysToMeet = meetDate ? Math.ceil((new Date(`${meetDate}T00:00:00Z`).getTime() - Date.now()) / dayMs) : 999;
  if (deadliftTarget && (latestRecovery?.soreness ?? 0) >= 6 && daysToMeet > 14) {
    recommendations.push({ programId: program.id, weekId: deadliftTarget.week.id, dayId: deadliftTarget.day.id, id: recommendationId(program.id, "move-deadlifts"), action: "move-deadlifts", title: "Move deadlifts by one day", rationale: "Accumulated soreness is high and the meet timeline allows recovery.", evidence: [`Soreness ${latestRecovery?.soreness}/10`, `${daysToMeet} days to meet`], confidence: "moderate", before: deadliftTarget.day.scheduledDate, after: addDays(deadliftTarget.day.scheduledDate, 1), patch: { scheduledDate: addDays(deadliftTarget.day.scheduledDate, 1) } });
  }
  const recentLowReadiness = recoveryHistory.filter((signal) => Date.now() - new Date(signal.recordedAt).getTime() <= 7 * dayMs && calculateRecoveryReadiness(signal) <= 60).length;
  if (recentLowReadiness >= 3 || (analytics.currentFatigueScore >= 75 && analytics.adherencePercent < 70)) {
    recommendations.push({ programId: program.id, id: recommendationId(program.id, "begin-deload"), action: "begin-deload", title: "Begin a 5-7 day deload", rationale: "Repeated low readiness indicates accumulated fatigue.", evidence: [`${recentLowReadiness} low-readiness check-ins`, `Adherence ${analytics.adherencePercent}%`], confidence: recentLowReadiness >= 3 ? "high" : "moderate", before: "Current weekly workload", after: "30-50% less volume; 5-10% less intensity" });
  }
  const generatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + dayMs).toISOString();
  return recommendations.map((recommendation) => ({
    ...recommendation,
    tenantId: program.coachId ?? program.athleteId,
    athleteId: program.athleteId,
    scope: recommendation.exerciseId ? "exercise" : recommendation.dayId ? "day" : "program",
    uncertainty: recommendation.confidence === "high" ? "Low rule uncertainty" : recommendation.confidence === "moderate" ? "Moderate rule uncertainty" : "High rule uncertainty",
    contraindications: ["Pain at or above 4/10", "New or worsening symptoms", "Incomplete or stale input data"],
    expectedOutcome: recommendation.rationale,
    generatedAt,
    expiresAt,
    ruleVersion: "adaptive-rules-1.0.0",
    modelVersion: null,
    source: "adaptive-rules",
    schemaVersion: 1
  }));
}