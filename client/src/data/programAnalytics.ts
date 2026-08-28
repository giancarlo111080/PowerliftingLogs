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
  averageActualRpe: number | null;
  averageRpeError: number | null;
  meanVelocityMps: number | null;
  averageRestSeconds: number | null;
  highRpeSets: number;
  failedSets: number;
  painLimitedSets: number;
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
  averageActualRpe: number | null;
  averageRpeError: number | null;
  meanVelocityMps: number | null;
  averageRestSeconds: number | null;
  rpeOvershootCount: number;
  highRpeSets: number;
  failedSets: number;
  painLimitedSets: number;
  workload7DayEwmaKg: number;
  workload28DayEwmaKg: number;
  acuteChronicWorkloadRatio: number | null;
  workloadMonotony: number | null;
  currentFatigueScore: number;
  currentReadinessScore: number;
}

function toKilograms(weight: number, unit: "kg" | "lb") {
  return unit === "lb" ? weight * 0.45359237 : weight;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, maximum));
}

function workloadSeries(workloadByDate: Map<string, number>, days: number, endDate: Date) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(endDate);
    date.setUTCDate(date.getUTCDate() - (days - index - 1));
    return workloadByDate.get(date.toISOString().slice(0, 10)) ?? 0;
  });
}

function exponentiallyWeightedAverage(values: number[], span: number) {
  if (!values.length) return 0;
  const alpha = 2 / (span + 1);
  return values.slice(1).reduce((value, next) => alpha * next + (1 - alpha) * value, values[0]);
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
    averageActualRpe: null,
    averageRpeError: null,
    meanVelocityMps: null,
    averageRestSeconds: null,
    rpeOvershootCount: 0,
    highRpeSets: 0,
    failedSets: 0,
    painLimitedSets: 0,
    workload7DayEwmaKg: 0,
    workload28DayEwmaKg: 0,
    acuteChronicWorkloadRatio: null,
    workloadMonotony: null,
    currentFatigueScore: 0,
    currentReadinessScore: 100
  };
  if (!program) {
    return empty;
  }

  const logByDayId = new Map(dayLogs.filter((log) => log.programId === program.id).map((log) => [log.dayId, log]));
  const topSets: TopSetAnalytics = { squat: null, bench: null, deadlift: null };
  const allActualRpes: number[] = [];
  const allRpeErrors: number[] = [];
  const allVelocities: number[] = [];
  const allRestSeconds: number[] = [];
  const workloadByDate = new Map<string, number>();
  const weeks = [...program.weeks].sort((left, right) => left.weekNumber - right.weekNumber).map((week) => {
    let plannedSets = 0;
    let completedSets = 0;
    let skippedSets = 0;
    let completedTonnageKg = 0;
    let failedSets = 0;
    let painLimitedSets = 0;
    const ratings: number[] = [];
    const actualRpes: number[] = [];
    const rpeErrors: number[] = [];
    const velocities: number[] = [];
    const restSeconds: number[] = [];

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
            if (setLog.actualRpe !== undefined) {
              actualRpes.push(setLog.actualRpe);
              allActualRpes.push(setLog.actualRpe);
              if (exercise.prescriptionMode === "rpe") {
                const error = setLog.actualRpe - exercise.prescriptionValue;
                rpeErrors.push(error);
                allRpeErrors.push(error);
              }
            }
            if (setLog.meanVelocityMps !== undefined) {
              velocities.push(setLog.meanVelocityMps);
              allVelocities.push(setLog.meanVelocityMps);
            }
            if (setLog.restSeconds !== undefined) {
              restSeconds.push(setLog.restSeconds);
              allRestSeconds.push(setLog.restSeconds);
            }
            const actualWeight = setLog.actualWeight ?? (exercise.prescriptionMode === "exact" ? exercise.prescriptionValue : undefined);
            const weightUnit = setLog.weightUnit ?? exercise.weightUnit;
            if (actualWeight !== undefined) {
              const actualWeightKg = toKilograms(actualWeight, weightUnit);
              const setTonnageKg = actualWeightKg * (setLog.actualRepetitions ?? exercise.repetitions);
              completedTonnageKg += setTonnageKg;
              const workloadDate = setLog.completedAt?.slice(0, 10) ?? day.scheduledDate;
              workloadByDate.set(workloadDate, (workloadByDate.get(workloadDate) ?? 0) + setTonnageKg);
              if (exercise.category === "squat" || exercise.category === "bench" || exercise.category === "deadlift") {
                topSets[exercise.category] = Math.max(topSets[exercise.category] ?? 0, actualWeightKg);
              }
            }
          }
          if (setLog?.completionStatus === "skipped") {
            skippedSets += 1;
            if (setLog.outcomeReason === "failed") failedSets += 1;
            if (setLog.outcomeReason === "pain-limited") painLimitedSets += 1;
          }
        }
      }
    }

    const remainingSets = plannedSets - completedSets - skippedSets;
    const sessionRating = ratings.length ? Math.round((ratings.reduce((total, rating) => total + rating, 0) / ratings.length) * 10) / 10 : null;
    const completionRate = plannedSets ? completedSets / plannedSets : 0;
    const averageActualRpe = actualRpes.length ? actualRpes.reduce((total, value) => total + value, 0) / actualRpes.length : null;
    const averageRpeError = rpeErrors.length ? rpeErrors.reduce((total, value) => total + value, 0) / rpeErrors.length : null;
    const meanVelocityMps = velocities.length ? velocities.reduce((total, value) => total + value, 0) / velocities.length : null;
    const averageRestSeconds = restSeconds.length ? restSeconds.reduce((total, value) => total + value, 0) / restSeconds.length : null;
    const highRpeSets = actualRpes.filter((value) => value >= 9).length;
    const fatigueScore = clamp(Math.round((sessionRating ?? 0) * 3 + (averageActualRpe ?? 0) * 3 + completionRate * 15 + Math.min(20, completedTonnageKg / 250) + painLimitedSets * 10), 0, 100);
    return {
      weekNumber: week.weekNumber,
      weekName: week.name,
      plannedSets,
      completedSets,
      skippedSets,
      remainingSets,
      completedTonnageKg: Math.round(completedTonnageKg),
      sessionRating,
      averageActualRpe: averageActualRpe === null ? null : Math.round(averageActualRpe * 10) / 10,
      averageRpeError: averageRpeError === null ? null : Math.round(averageRpeError * 10) / 10,
      meanVelocityMps: meanVelocityMps === null ? null : Math.round(meanVelocityMps * 100) / 100,
      averageRestSeconds: averageRestSeconds === null ? null : Math.round(averageRestSeconds),
      highRpeSets,
      failedSets,
      painLimitedSets,
      fatigueScore,
      readinessScore: 100 - fatigueScore
    };
  });

  const plannedSets = weeks.reduce((total, week) => total + week.plannedSets, 0);
  const completedSets = weeks.reduce((total, week) => total + week.completedSets, 0);
  const skippedSets = weeks.reduce((total, week) => total + week.skippedSets, 0);
  const completedTonnageKg = weeks.reduce((total, week) => total + week.completedTonnageKg, 0);
  const average = (values: number[]) => values.length ? Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 100) / 100 : null;
  const latestWorkloadDate = [...workloadByDate.keys()].sort().at(-1);
  const workloadEndDate = latestWorkloadDate ? new Date(`${latestWorkloadDate}T00:00:00.000Z`) : new Date();
  const trailing28Days = workloadSeries(workloadByDate, 28, workloadEndDate);
  const trailing7Days = trailing28Days.slice(-7);
  const workload7DayEwmaKg = exponentiallyWeightedAverage(trailing7Days, 7);
  const workload28DayEwmaKg = exponentiallyWeightedAverage(trailing28Days, 28);
  const mean7DayWorkload = trailing7Days.reduce((total, value) => total + value, 0) / trailing7Days.length;
  const standardDeviation = Math.sqrt(trailing7Days.reduce((total, value) => total + (value - mean7DayWorkload) ** 2, 0) / trailing7Days.length);
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
    averageActualRpe: average(allActualRpes),
    averageRpeError: average(allRpeErrors),
    meanVelocityMps: average(allVelocities),
    averageRestSeconds: average(allRestSeconds),
    rpeOvershootCount: allRpeErrors.filter((value) => value >= 1).length,
    highRpeSets: weeks.reduce((total, week) => total + week.highRpeSets, 0),
    failedSets: weeks.reduce((total, week) => total + week.failedSets, 0),
    painLimitedSets: weeks.reduce((total, week) => total + week.painLimitedSets, 0),
    workload7DayEwmaKg: Math.round(workload7DayEwmaKg),
    workload28DayEwmaKg: Math.round(workload28DayEwmaKg),
    acuteChronicWorkloadRatio: workload28DayEwmaKg > 0 ? Math.round((workload7DayEwmaKg / workload28DayEwmaKg) * 100) / 100 : null,
    workloadMonotony: standardDeviation > 0 ? Math.round((mean7DayWorkload / standardDeviation) * 100) / 100 : null,
    currentFatigueScore: lastTrackedWeek?.fatigueScore ?? 0,
    currentReadinessScore: lastTrackedWeek?.readinessScore ?? 100
  };
}
