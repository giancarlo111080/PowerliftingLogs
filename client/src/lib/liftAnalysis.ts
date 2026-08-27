export type LiftCameraView = "side" | "front";
export type LiftAnalysisConfidence = "low" | "moderate" | "high";
export type PrimaryLift = "squat" | "bench" | "deadlift";

export interface LiftVideoAnalysis {
  version: 1;
  liftType?: PrimaryLift;
  analyzedAt: string;
  sourceFileName: string;
  cameraView: LiftCameraView;
  sampleRateFps: number;
  visibleDurationSeconds: number;
  estimatedRepetitions: number;
  meanConcentricVelocityMps: number | null;
  peakConcentricVelocityMps: number | null;
  concentricRangeCm: number | null;
  velocityLossPercent: number | null;
  barPathHorizontalDriftCm: number | null;
  stanceWidthCm: number | null;
  stanceWidthPercentOfHipWidth: number | null;
  maxKneeTravelPercentOfFemur: number | null;
  estimatedRpe: number | null;
  confidence: LiftAnalysisConfidence;
  notes: string[];
}

function isFiniteNullableNumber(value: unknown) {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function isLiftVideoAnalysis(value: unknown): value is LiftVideoAnalysis {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<LiftVideoAnalysis>;
  return candidate.version === 1 &&
    (candidate.liftType === undefined || candidate.liftType === "squat" || candidate.liftType === "bench" || candidate.liftType === "deadlift") &&
    typeof candidate.analyzedAt === "string" &&
    typeof candidate.sourceFileName === "string" &&
    (candidate.cameraView === "side" || candidate.cameraView === "front") &&
    typeof candidate.sampleRateFps === "number" && Number.isFinite(candidate.sampleRateFps) && candidate.sampleRateFps > 0 &&
    typeof candidate.visibleDurationSeconds === "number" && Number.isFinite(candidate.visibleDurationSeconds) && candidate.visibleDurationSeconds > 0 &&
    typeof candidate.estimatedRepetitions === "number" && Number.isInteger(candidate.estimatedRepetitions) && candidate.estimatedRepetitions >= 0 &&
    isFiniteNullableNumber(candidate.meanConcentricVelocityMps) &&
    isFiniteNullableNumber(candidate.peakConcentricVelocityMps) &&
    isFiniteNullableNumber(candidate.concentricRangeCm) &&
    isFiniteNullableNumber(candidate.velocityLossPercent) &&
    isFiniteNullableNumber(candidate.barPathHorizontalDriftCm) &&
    isFiniteNullableNumber(candidate.stanceWidthCm) &&
    isFiniteNullableNumber(candidate.stanceWidthPercentOfHipWidth) &&
    isFiniteNullableNumber(candidate.maxKneeTravelPercentOfFemur) &&
    isFiniteNullableNumber(candidate.estimatedRpe) &&
    (candidate.confidence === "low" || candidate.confidence === "moderate" || candidate.confidence === "high") &&
    Array.isArray(candidate.notes) && candidate.notes.every((note) => typeof note === "string");
}