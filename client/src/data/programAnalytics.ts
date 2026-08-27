import type { ProgramDayLog, TrainingProgram } from "./programWorkspaceStore";

export interface WeeklyProgramAnalytics {
  weekNumber: number;
  weekName: string;
  plannedSets: number;
  completedSets: number;
  skippedSets: number;
  remainingSets: number;
  completedTonnageKg: number;
  sessionRating: number | null;
  fatigueScore: number;
  readinessScore: number;
}

export interface TopSetAnalytics {
  squat: number | null;
  bench: number | null;
  deadlift: number | null;
}

export interface ProgramAnalytics {
  weeks: WeeklyProgramAnalytics[];
  topSets: TopSetAnalytics;
  plannedSets: number;
  completedSets: number;
  skippedSets: number;
  remainingSets: number;
  completedTonnageKg: number;
  adherencePercent: number;
  currentFatigueScore: number;
  currentReadinessScore: number;
}

function toKilograms(weight: number, unit: "kg" | "lb") {
  return unit === "lb" ? weight * 0.45359237 : weight;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, maximum));
}

export function getProgramAnalytics(program: TrainingProgram | null, dayLogs: ProgramDayLog[]): ProgramAnalytics {
  const empty: ProgramAnalytics = {
    weeks: [],
    topSets: { squat: null, bench: null, deadlift: null },
    plannedSets: 0,
    completedSets: 0,
    skippedSets: 0,
    remainingSets: 0,
    completedTonnageKg: 0,
    adherencePercent: 0,
    currentFatigueScore: 0,
    currentReadinessScore: 100
  };
  if (!program) {
    return empty;
  }

  const logByDayId = new Map(dayLogs.filter((log) => log.programId === program.id).map((log) => [log.dayId, log]));
  const topSets: TopSetAnalytics = { squat: null, bench: null, deadlift: null };
  const weeks = [...program.weeks].sort((left, right) => left.weekNumber - right.weekNumber).map((week) => {
    let plannedSets = 0;
    let completedSets = 0;
    let skippedSets = 0;
    let completedTonnageKg = 0;
    const ratings: number[] = [];

    for (const day of week.days) {
      const dayLog = logByDayId.get(day.id);
      if (dayLog?.sessionRating) {
        ratings.push(dayLog.sessionRating);
      }
      for (const exercise of day.exercises) {
        plannedSets += exercise.sets;
        for (let setNumber = 1; setNumber <= exercise.sets; setNumber += 1) {
          const setLog = dayLog?.sets.find((set) => set.exerciseId === exercise.id && set.setNumber === setNumber);
          if (setLog?.completionStatus === "done") {
            completedSets += 1;
            const actualWeight = setLog.actualWeight ?? (exercise.prescriptionMode === "exact" ? exercise.prescriptionValue : undefined);
            const weightUnit = setLog.weightUnit ?? exercise.weightUnit;
            if (actualWeight !== undefined) {
              const actualWeightKg = toKilograms(actualWeight, weightUnit);
              completedTonnageKg += actualWeightKg * exercise.repetitions;
              if (exercise.category === "squat" || exercise.category === "bench" || exercise.category === "deadlift") {
                topSets[exercise.category] = Math.max(topSets[exercise.category] ?? 0, actualWeightKg);
              }
            }
          }
          if (setLog?.completionStatus === "skipped") {
            skippedSets += 1;
          }
        }
      }
    }

    const remainingSets = plannedSets - completedSets - skippedSets;
    const sessionRating = ratings.length ? Math.round((ratings.reduce((total, rating) => total + rating, 0) / ratings.length) * 10) / 10 : null;
    const completionRate = plannedSets ? completedSets / plannedSets : 0;
    const fatigueScore = clamp(Math.round((sessionRating ?? 0) * 5 + completionRate * 25 + Math.min(25, completedTonnageKg / 200)), 0, 100);
    return {
      weekNumber: week.weekNumber,
      weekName: week.name,
      plannedSets,
      completedSets,
      skippedSets,
      remainingSets,
      completedTonnageKg: Math.round(completedTonnageKg),
      sessionRating,
      fatigueScore,
      readinessScore: 100 - fatigueScore
    };
  });

  const plannedSets = weeks.reduce((total, week) => total + week.plannedSets, 0);
  const completedSets = weeks.reduce((total, week) => total + week.completedSets, 0);
  const skippedSets = weeks.reduce((total, week) => total + week.skippedSets, 0);
  const completedTonnageKg = weeks.reduce((total, week) => total + week.completedTonnageKg, 0);
  const lastTrackedWeek = [...weeks].reverse().find((week) => week.completedSets || week.skippedSets || week.sessionRating !== null) ?? weeks.at(-1);

  return {
    weeks,
    topSets,
    plannedSets,
    completedSets,
    skippedSets,
    remainingSets: plannedSets - completedSets - skippedSets,
    completedTonnageKg,
    adherencePercent: plannedSets ? Math.round((completedSets / plannedSets) * 100) : 0,
    currentFatigueScore: lastTrackedWeek?.fatigueScore ?? 0,
    currentReadinessScore: lastTrackedWeek?.readinessScore ?? 100
  };
}
