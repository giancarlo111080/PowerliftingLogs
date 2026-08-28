import type { StrengthProjection } from "./adaptiveEngine";

export type MeetWeightUnit = "kg" | "lb";
export type AttemptRiskBand = "low" | "moderate" | "high" | "unknown";

export interface FederationRule {
  code: string;
  name: string;
  minimumIncrementKg: number;
  weighInWindowMinutes: number;
  referenceEffectiveDate: string;
  cachedAt: string;
  attemptChangeGuidance: string;
}

const cachedAt = "2026-01-15T00:00:00.000Z";

export const federationRules: FederationRule[] = [
  { code: "IPF", name: "International Powerlifting Federation", minimumIncrementKg: 2.5, weighInWindowMinutes: 120, referenceEffectiveDate: "2026-01-01", cachedAt, attemptChangeGuidance: "Confirm attempt-change timing with the technical controller before each round." },
  { code: "USAPL", name: "USA Powerlifting", minimumIncrementKg: 2.5, weighInWindowMinutes: 120, referenceEffectiveDate: "2026-01-01", cachedAt, attemptChangeGuidance: "Confirm current attempt-card and change deadlines with meet staff." },
  { code: "USPA", name: "United States Powerlifting Association", minimumIncrementKg: 2.5, weighInWindowMinutes: 120, referenceEffectiveDate: "2026-01-01", cachedAt, attemptChangeGuidance: "Confirm weigh-in and attempt-change procedures in the event rulebook." }
];

export function federationRule(code: string) {
  return federationRules.find((rule) => rule.code.toLowerCase() === code.trim().toLowerCase()) ?? null;
}

export function toKilograms(value: number, unit: MeetWeightUnit) {
  return unit === "lb" ? value * 0.45359237 : value;
}

export function fromKilograms(value: number, unit: MeetWeightUnit) {
  return unit === "lb" ? value / 0.45359237 : value;
}

export function roundDisplayWeight(value: number, unit: MeetWeightUnit) {
  return Math.round(fromKilograms(value, unit) * (unit === "lb" ? 10 : 2)) / (unit === "lb" ? 10 : 2);
}

export function validateAttemptSeries(attemptsKg: [number, number, number], rule: FederationRule | null) {
  const errors: string[] = [];
  const increment = rule?.minimumIncrementKg ?? 2.5;
  attemptsKg.forEach((attempt, index) => {
    if (!Number.isFinite(attempt) || attempt <= 0) errors.push(`Attempt ${index + 1} must be greater than zero.`);
    const increments = attempt / increment;
    if (Number.isFinite(attempt) && Math.abs(increments - Math.round(increments)) > 0.001) errors.push(`Attempt ${index + 1} must use ${increment} kg increments.`);
    if (index > 0 && attempt < attemptsKg[index - 1]) errors.push(`Attempt ${index + 1} cannot be lighter than attempt ${index}.`);
  });
  return errors;
}

export function attemptRiskBand(weightKg: number, projection: StrengthProjection, attemptNumber: number): AttemptRiskBand {
  if (!weightKg || projection.medianKg === null || projection.sampleSize < 2) return "unknown";
  const lower90 = projection.lower90Kg ?? projection.medianKg * 0.9;
  const upper50 = projection.upper50Kg ?? projection.medianKg * 1.03;
  if (attemptNumber === 1) return weightKg <= lower90 ? "low" : weightKg <= projection.medianKg * 0.94 ? "moderate" : "high";
  if (attemptNumber === 2) return weightKg <= projection.medianKg * 0.98 ? "low" : weightKg <= upper50 ? "moderate" : "high";
  return weightKg <= projection.medianKg ? "low" : weightKg <= upper50 ? "moderate" : "high";
}

export function formatCountdown(targetIso: string | undefined, now = Date.now()) {
  if (!targetIso) return "Not scheduled";
  const difference = new Date(targetIso).getTime() - now;
  if (!Number.isFinite(difference)) return "Invalid time";
  if (difference <= 0) return "Started";
  const totalMinutes = Math.floor(difference / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return `${days ? `${days}d ` : ""}${hours}h ${minutes}m`;
}

export function isRulesCacheStale(rule: FederationRule | null, now = Date.now()) {
  if (!rule) return true;
  return now - new Date(rule.cachedAt).getTime() > 180 * 86_400_000;
}