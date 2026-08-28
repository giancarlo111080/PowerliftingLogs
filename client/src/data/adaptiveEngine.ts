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
  baseProgramUpdatedAt: string;
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

type RecommendationDraft = Omit<AdaptiveRecommendation, "tenantId" | "athleteId" | "scope" | "uncertainty" | "contraindications" | "expectedOutcome" | "generatedAt" | "expiresAt" | "ruleVersion" | "modelVersion" | "source" | "schemaVersion" | "baseProgramUpdatedAt">;

const dayMs = 86_400_000;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundToIncrement(value: number, increment = 2.5) {
  return Math.round(value / increment) * increment;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function toKilograms(weight: number, unit: "kg" | "lb") {
  return unit === "lb" ? weight * 0.45359237 : weight;
}

function strengthEstimates(program: TrainingProgram, dayLogs: ProgramDayLog[], category: "squat" | "bench" | "deadlift") {
  const exercises = new Map(program.weeks.flatMap((week) => week.days).flatMap((day) => day.exercises).filter((exercise) => exercise.category === category).map((exercise) => [exercise.id, exercise]));
  return dayLogs.filter((log) => log.programId === program.id).flatMap((log) => {
    const estimates = log.sets.flatMap((set) => {
      const exercise = exercises.get(set.exerciseId);
      const repetitions = set.actualRepetitions ?? exercise?.repetitions;
      if (!exercise || set.completionStatus !== "done" || !set.actualWeight || !repetitions || repetitions > 8 || (set.actualRpe !== undefined && set.actualRpe < 6)) return [];
      const loadKg = toKilograms(set.actualWeight, set.weightUnit ?? exercise.weightUnit);
      const estimatedRepetitionsToFailure = repetitions + (set.actualRpe === undefined ? 0 : clamp(10 - set.actualRpe, 0, 4));
      return [loadKg * (1 + estimatedRepetitionsToFailure / 30)];
    });
    return estimates.length ? [{ value: Math.max(...estimates), recordedAt: log.updatedAt }] : [];
  }).sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
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
  const estimates = strengthEstimates(program, dayLogs, category).map((estimate) => estimate.value);
  if (!estimates.length) return { medianKg: baseline ?? null, lower50Kg: null, upper50Kg: null, lower90Kg: null, upper90Kg: null, confidence: "insufficient", sampleSize: 0 };
  const recent = estimates.slice(-5);
  const center = median(recent)!;
  const medianAbsoluteDeviation = median(recent.map((estimate) => Math.abs(estimate - center))) ?? 0;
  const minimumRelativeUncertainty = recent.length >= 4 ? 0.035 : recent.length >= 2 ? 0.06 : 0.1;
  const relativeUncertainty = Math.max(minimumRelativeUncertainty, center > 0 ? (medianAbsoluteDeviation * 1.4826) / center : minimumRelativeUncertainty);
  const projectedMedian = roundToIncrement(center, 0.5);
  return {
    medianKg: projectedMedian,
    lower50Kg: roundToIncrement(projectedMedian * (1 - relativeUncertainty * 0.41), 0.5),
    upper50Kg: roundToIncrement(projectedMedian * (1 + relativeUncertainty * 0.41), 0.5),
    lower90Kg: roundToIncrement(projectedMedian * (1 - relativeUncertainty), 0.5),
    upper90Kg: roundToIncrement(projectedMedian * (1 + relativeUncertainty), 0.5),
    confidence: recent.length >= 4 ? "high" : recent.length >= 2 ? "moderate" : "low",
    sampleSize: recent.length
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

interface LoggedSetObservation {
  exercise: ProgramExercise;
  weekId: string;
  dayId: string;
  scheduledDate: string;
  set: ProgramDayLog["sets"][number];
  recordedAt: string;
}

function normalizedExerciseName(exercise: ProgramExercise) {
  return exercise.name.trim().toLowerCase();
}

function observationsFor(program: TrainingProgram, dayLogs: ProgramDayLog[], target?: ProgramExercise) {
  const logByDay = new Map(dayLogs.filter((log) => log.programId === program.id).map((log) => [log.dayId, log]));
  const exactName = target ? normalizedExerciseName(target) : null;
  const all = program.weeks.flatMap((week) => week.days.flatMap((day) => {
    const log = logByDay.get(day.id);
    if (!log) return [];
    return log.sets.flatMap((set) => {
      const exercise = day.exercises.find((candidate) => candidate.id === set.exerciseId);
      if (!exercise || exercise.category === "accessory" || set.completionStatus !== "done") return [];
      return [{ exercise, weekId: week.id, dayId: day.id, scheduledDate: day.scheduledDate, set, recordedAt: set.completedAt ?? log.updatedAt } satisfies LoggedSetObservation];
    });
  })).sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
  if (!target) return all;
  const exact = all.filter((item) => item.exercise.category === target.category && normalizedExerciseName(item.exercise) === exactName);
  return exact.length >= 3 ? exact : all.filter((item) => item.exercise.category === target.category);
}

function targetExercise(program: TrainingProgram, dayLogs: ProgramDayLog[]) {
  const logByDay = new Map(dayLogs.filter((log) => log.programId === program.id).map((log) => [log.dayId, log]));
  const today = new Date().toISOString().slice(0, 10);
  const candidates = program.weeks.flatMap((week) => week.days.flatMap((day) => day.exercises.filter((exercise) => exercise.category !== "accessory").map((exercise) => {
    const log = logByDay.get(day.id);
    const incomplete = Array.from({ length: exercise.sets }, (_, index) => log?.sets.find((set) => set.exerciseId === exercise.id && set.setNumber === index + 1)?.completionStatus ?? "pending").some((status) => status === "pending");
    return { week, day, exercise, incomplete };
  }))).sort((left, right) => left.day.scheduledDate.localeCompare(right.day.scheduledDate));
  return candidates.find((item) => item.incomplete && item.day.scheduledDate >= today)
    ?? [...candidates].reverse().find((item) => item.incomplete)
    ?? candidates.at(-1)
    ?? null;
}

function observedVelocity(observation: LoggedSetObservation) {
  if (observation.set.meanVelocityMps !== undefined) return observation.set.meanVelocityMps;
  const analysis = observation.set.videoAnalysis;
  return analysis && analysis.confidence !== "low" ? analysis.meanConcentricVelocityMps : null;
}

function reducedPrescription(exercise: ProgramExercise) {
  if (exercise.prescriptionMode === "exact") return roundToIncrement(exercise.prescriptionValue * 0.95);
  if (exercise.prescriptionMode === "percent") return Math.max(40, exercise.prescriptionValue - 5);
  if (exercise.prescriptionMode === "rir") return Math.min(10, exercise.prescriptionValue + 1);
  return Math.max(1, exercise.prescriptionValue - 1);
}

function recommendationId(programId: string, action: AdaptiveAction, signalKey: string, exercise?: ProgramExercise) {
  const normalizedSignal = signalKey.replace(/[^0-9A-Za-z]/g, "").slice(0, 24) || "baseline";
  return `${programId}:${action}:${exercise?.id ?? "program"}:${normalizedSignal}`;
}

function daysBetween(left: string, right: string) {
  return Math.round(Math.abs(new Date(`${left}T00:00:00.000Z`).getTime() - new Date(`${right}T00:00:00.000Z`).getTime()) / dayMs);
}

export function generateAdaptiveRecommendations(program: TrainingProgram | null, dayLogs: ProgramDayLog[], recoveryHistory: RecoverySignal[], meetDate?: string): AdaptiveRecommendation[] {
  if (!program) return [];
  const now = Date.now();
  const analytics = getProgramAnalytics(program, dayLogs);
  const sortedRecovery = [...recoveryHistory].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  const latestRecovery = sortedRecovery[0];
  const readiness = latestRecovery ? calculateRecoveryReadiness(latestRecovery) : analytics.currentReadinessScore;
  const priorReadiness = median(sortedRecovery.slice(1, 4).map(calculateRecoveryReadiness));
  const readinessDrop = priorReadiness === null ? null : priorReadiness - readiness;
  const target = targetExercise(program, dayLogs);
  if (!target || (latestRecovery?.pain ?? 0) >= 4) return [];
  const { week, day, exercise } = target;
  const recommendations: RecommendationDraft[] = [];
  const observations = observationsFor(program, dayLogs, exercise);
  const latestObservation = observations.at(-1);
  const signalKey = latestRecovery?.recordedAt ?? latestObservation?.recordedAt ?? program.updatedAt;
  const base = { programId: program.id, weekId: week.id, dayId: day.id, exerciseId: exercise.id };

  const latestRpeObservation = [...observations].reverse().find((item) => item.exercise.prescriptionMode === "rpe" && item.set.actualRpe !== undefined);
  const latestRpeError = latestRpeObservation ? latestRpeObservation.set.actualRpe! - latestRpeObservation.exercise.prescriptionValue : null;
  const velocityObservations = observations.filter((item) => observedVelocity(item) !== null && item.set.actualWeight !== undefined);
  const latestVelocityObservation = velocityObservations.at(-1);
  const latestVelocity = latestVelocityObservation ? observedVelocity(latestVelocityObservation) : null;
  const latestLoad = latestVelocityObservation?.set.actualWeight;
  const latestRepetitions = latestVelocityObservation ? latestVelocityObservation.set.actualRepetitions ?? latestVelocityObservation.exercise.repetitions : null;
  const comparableVelocities = latestVelocityObservation && latestLoad
    ? velocityObservations.slice(0, -1).filter((item) => {
      const load = item.set.actualWeight;
      const repetitions = item.set.actualRepetitions ?? item.exercise.repetitions;
      return load !== undefined && Math.abs(load - latestLoad) / latestLoad <= 0.1 && repetitions === latestRepetitions;
    }).slice(-5).map((item) => observedVelocity(item)!).filter((value): value is number => value !== null)
    : [];
  const baselineVelocity = median(comparableVelocities);
  const velocityDropPercent = baselineVelocity && latestVelocity !== null ? ((baselineVelocity - latestVelocity) / baselineVelocity) * 100 : null;

  const techniqueAnalyses = observations.flatMap((item) => {
    const analysis = item.set.videoAnalysis;
    return analysis?.confidence === "high" ? [analysis] : [];
  });
  const latestCameraView = techniqueAnalyses.at(-1)?.cameraView;
  const comparableTechnique = techniqueAnalyses.filter((analysis) => analysis.cameraView === latestCameraView).slice(-3);
  const drifts = comparableTechnique.map((analysis) => analysis.barPathHorizontalDriftCm);
  const velocityLosses = comparableTechnique.map((analysis) => analysis.velocityLossPercent);
  const decliningDrift = drifts.length === 3 && drifts.every((value): value is number => value !== null) && drifts[2] >= 10 && drifts[1] >= drifts[0] + 1 && drifts[2] >= drifts[1] + 1;
  const decliningVelocity = velocityLosses.length === 3 && velocityLosses.every((value): value is number => value !== null) && velocityLosses[2] >= 20 && velocityLosses[1] >= velocityLosses[0] + 3 && velocityLosses[2] >= velocityLosses[1] + 3;
  const techniqueDeclining = decliningDrift || decliningVelocity;
  const techniqueStable = comparableTechnique.length === 3 && !techniqueDeclining && (drifts.at(-1) ?? 0) < 10 && (velocityLosses.at(-1) ?? 0) < 20;

  const reductionEvidence: string[] = [];
  if (readiness <= 60) reductionEvidence.push(`Readiness ${readiness}/100 (threshold 60)`);
  if (readinessDrop !== null && readinessDrop >= 15) reductionEvidence.push(`Readiness fell ${Math.round(readinessDrop)} points from recent baseline`);
  if (velocityDropPercent !== null && velocityDropPercent >= 10) reductionEvidence.push(`Comparable-set velocity fell ${Math.round(velocityDropPercent)}%`);
  if (latestRpeError !== null && latestRpeError >= 1) reductionEvidence.push(`Actual RPE exceeded target by ${latestRpeError.toFixed(1)}`);
  if (reductionEvidence.length) {
    const nextValue = reducedPrescription(exercise);
    recommendations.push({ ...base, id: recommendationId(program.id, "reduce-top-set", signalKey, exercise), action: "reduce-top-set", title: `Reduce ${exercise.name}`, rationale: "One or more bounded fatigue signals crossed the top-set reduction threshold.", evidence: reductionEvidence, confidence: reductionEvidence.length >= 2 ? "high" : "moderate", before: `${exercise.prescriptionValue} ${exercise.prescriptionMode}`, after: `${nextValue} ${exercise.prescriptionMode}`, patch: { prescriptionValue: nextValue } });
  }

  const previousWeekVolumes = program.weeks.filter((item) => item.weekNumber < week.weekNumber).map((item) => item.days.flatMap((candidate) => candidate.exercises).filter((candidate) => candidate.category !== "accessory").reduce((total, candidate) => total + candidate.sets, 0));
  const currentWeekVolume = week.days.flatMap((candidate) => candidate.exercises).filter((candidate) => candidate.category !== "accessory").reduce((total, candidate) => total + candidate.sets, 0);
  const baselineWeekVolume = median(previousWeekVolumes.slice(-4));
  const withinVolumeCap = baselineWeekVolume !== null && currentWeekVolume + 1 <= Math.ceil(baselineWeekVolume * 1.1);
  const stableReadiness = latestRecovery !== undefined && priorReadiness !== null && readiness >= 75 && Math.abs(readiness - priorReadiness) <= 10;
  const velocityAtBaseline = baselineVelocity !== null && latestVelocity !== null && latestVelocity >= baselineVelocity * 0.9;
  const rpeUndershot = latestRpeError !== null && latestRpeError <= -0.5;
  const workloadAllowsAddition = (analytics.acuteChronicWorkloadRatio ?? 0) <= 1.3 && (analytics.workloadMonotony ?? 0) <= 2;
  if (!reductionEvidence.length && stableReadiness && rpeUndershot && velocityAtBaseline && techniqueStable && withinVolumeCap && workloadAllowsAddition) {
    recommendations.push({ ...base, id: recommendationId(program.id, "add-backoff-set", signalKey, exercise), action: "add-backoff-set", title: `Add one ${exercise.name} back-off set`, rationale: "Recovery, effort, velocity, technique, and weekly workload all remain inside the bounded addition policy.", evidence: [`Readiness ${readiness}/100 and stable`, `RPE undershot by ${Math.abs(latestRpeError!).toFixed(1)}`, `Velocity at ${Math.round((latestVelocity! / baselineVelocity!) * 100)}% of baseline`, `Weekly primary volume ${currentWeekVolume + 1}/${Math.ceil(baselineWeekVolume! * 1.1)} set cap`], confidence: "high", before: `${exercise.sets} sets`, after: `${exercise.sets + 1} sets`, patch: { sets: exercise.sets + 1 } });
  }

  if (techniqueDeclining) {
    recommendations.push({ ...base, id: recommendationId(program.id, "hold-load", comparableTechnique.at(-1)!.analyzedAt, exercise), action: "hold-load", title: `Hold ${exercise.name} load`, rationale: "Three comparable high-confidence videos show a worsening technique trend.", evidence: [`Camera view ${latestCameraView}`, decliningVelocity ? `Velocity loss trend ${velocityLosses.map((value) => `${value}%`).join(" → ")}` : `Bar-drift trend ${drifts.map((value) => `${value} cm`).join(" → ")}`], confidence: "high", before: "Planned progression", after: "Hold current exposure" });
  }

  const allDays = program.weeks.flatMap((item) => item.days.map((candidate) => ({ week: item, day: candidate }))).sort((left, right) => left.day.scheduledDate.localeCompare(right.day.scheduledDate));
  const today = new Date(now).toISOString().slice(0, 10);
  const deadliftTarget = allDays.find(({ day: candidate }) => candidate.scheduledDate >= today && candidate.exercises.some((item) => item.category === "deadlift"));
  const daysToMeet = meetDate ? Math.ceil((new Date(`${meetDate}T00:00:00Z`).getTime() - now) / dayMs) : 999;
  if (deadliftTarget && (latestRecovery?.soreness ?? 0) >= 6 && daysToMeet > 14) {
    const proposedDate = addDays(deadliftTarget.day.scheduledDate, 1);
    const collidesWithWorkout = allDays.some(({ day: candidate }) => candidate.id !== deadliftTarget.day.id && candidate.scheduledDate === proposedDate);
    const otherDeadliftDates = allDays.filter(({ day: candidate }) => candidate.id !== deadliftTarget.day.id && candidate.exercises.some((item) => item.category === "deadlift")).map(({ day: candidate }) => candidate.scheduledDate);
    const preservesDeadliftSpacing = otherDeadliftDates.every((date) => daysBetween(date, proposedDate) >= 2);
    if (!collidesWithWorkout && preservesDeadliftSpacing && proposedDate <= program.endDate) {
      recommendations.push({ programId: program.id, weekId: deadliftTarget.week.id, dayId: deadliftTarget.day.id, id: recommendationId(program.id, "move-deadlifts", signalKey), action: "move-deadlifts", title: "Move deadlifts by one day", rationale: "Soreness is elevated and the proposed date preserves session and deadlift spacing.", evidence: [`Soreness ${latestRecovery?.soreness}/10`, `${daysToMeet} days to meet`, "No workout collision; at least 48 hours from other deadlift sessions"], confidence: "moderate", before: deadliftTarget.day.scheduledDate, after: proposedDate, patch: { scheduledDate: proposedDate } });
    }
  }

  const recentLowReadiness = recoveryHistory.filter((signal) => now - new Date(signal.recordedAt).getTime() <= 7 * dayMs && calculateRecoveryReadiness(signal) <= 60).length;
  const recentRpeOvershoots = observationsFor(program, dayLogs).filter((item) => now - new Date(item.recordedAt).getTime() <= 14 * dayMs && item.exercise.prescriptionMode === "rpe" && item.set.actualRpe !== undefined && item.set.actualRpe - item.exercise.prescriptionValue >= 1).length;
  const completedPastSessions = allDays.filter(({ day: candidate }) => candidate.scheduledDate <= today).slice(-3).map(({ day: candidate }) => {
    const log = dayLogs.find((item) => item.programId === program.id && item.dayId === candidate.id);
    const planned = candidate.exercises.reduce((total, item) => total + item.sets, 0);
    const completed = log?.sets.filter((set) => set.completionStatus === "done").length ?? 0;
    return planned ? completed / planned : 1;
  });
  const persistentIncompleteWork = completedPastSessions.length === 3 && completedPastSessions.every((rate) => rate < 0.7);
  const decliningStrength = (["squat", "bench", "deadlift"] as const).flatMap((category) => {
    const estimates = strengthEstimates(program, dayLogs, category).map((item) => item.value);
    if (estimates.length < 6) return [];
    const previous = median(estimates.slice(-6, -3))!;
    const recent = median(estimates.slice(-3))!;
    return recent <= previous * 0.97 ? [`${category} e1RM fell ${Math.round((1 - recent / previous) * 100)}%`] : [];
  });
  const deloadEvidence = [
    ...(recentLowReadiness >= 3 ? [`${recentLowReadiness} low-readiness check-ins in 7 days`] : []),
    ...(recentRpeOvershoots >= 3 ? [`${recentRpeOvershoots} RPE overshoots in 14 days`] : []),
    ...decliningStrength,
    ...(persistentIncompleteWork ? ["Less than 70% completion in each of the last 3 scheduled sessions"] : [])
  ];
  if (deloadEvidence.length) {
    recommendations.push({ programId: program.id, id: recommendationId(program.id, "begin-deload", signalKey), action: "begin-deload", title: "Begin a 5-7 day deload", rationale: "Repeated recent fatigue evidence crossed a deload threshold.", evidence: deloadEvidence, confidence: deloadEvidence.length >= 2 || recentLowReadiness >= 3 ? "high" : "moderate", before: "Current weekly workload", after: "30-50% less volume; 5-10% less intensity" });
  }

  if (exercise.category !== "accessory") {
    const strengthHistory = strengthEstimates(program, dayLogs, exercise.category);
    if (strengthHistory.length >= 6) {
      const previousValues = strengthHistory.slice(-6, -3).map((item) => item.value);
      const recentValues = strengthHistory.slice(-3).map((item) => item.value);
      const previous = median(previousValues)!;
      const recent = median(recentValues)!;
      const pooledDeviation = median([...previousValues.map((value) => Math.abs(value - previous)), ...recentValues.map((value) => Math.abs(value - recent))]) ?? 0;
      const materiallyShifted = Math.abs(recent - previous) / previous >= 0.025 && Math.abs(recent - previous) >= Math.max(2.5, pooledDeviation * 1.5);
      if (materiallyShifted) {
        const direction = recent > previous ? "increased" : "decreased";
        recommendations.push({ ...base, id: recommendationId(program.id, "update-e1rm", strengthHistory.at(-1)!.recordedAt, exercise), action: "update-e1rm", title: `Review ${exercise.category} projected 1RM`, rationale: `The robust recent estimate ${direction} beyond the recent observation spread.`, evidence: [`Previous 3-session median ${roundToIncrement(previous, 0.5)} kg`, `Recent 3-session median ${roundToIncrement(recent, 0.5)} kg`, `Observed shift ${Math.abs(((recent - previous) / previous) * 100).toFixed(1)}%`], confidence: pooledDeviation <= Math.abs(recent - previous) / 2 ? "high" : "moderate", before: `${roundToIncrement(previous, 0.5)} kg e1RM`, after: `${roundToIncrement(recent, 0.5)} kg e1RM` });
      }
    }
  }

  const generatedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + dayMs).toISOString();
  return recommendations.map((recommendation) => ({
    ...recommendation,
    tenantId: program.coachId ?? program.athleteId,
    athleteId: program.athleteId,
    baseProgramUpdatedAt: program.updatedAt,
    scope: recommendation.exerciseId ? "exercise" : recommendation.dayId ? "day" : "program",
    uncertainty: recommendation.confidence === "high" ? "Low rule uncertainty" : recommendation.confidence === "moderate" ? "Moderate rule uncertainty" : "High rule uncertainty",
    contraindications: ["Pain at or above 4/10", "New or worsening symptoms", "Incomplete or stale input data"],
    expectedOutcome: recommendation.rationale,
    generatedAt,
    expiresAt,
    ruleVersion: "adaptive-rules-2.0.0",
    modelVersion: null,
    source: "adaptive-rules",
    schemaVersion: 1
  }));
}