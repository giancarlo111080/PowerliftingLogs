import type { LiftVideoAnalysis, PrimaryLift } from "../lib/liftAnalysis";

export interface VideoAnalysisTarget {
  exerciseId: string;
  exerciseName: string;
  liftType: PrimaryLift;
  prescribedRepetitions: number;
  setNumber: number;
  videoAnalysis?: LiftVideoAnalysis;
}

export interface VideoAnalysisModalProps {
  visible: boolean;
  targets: VideoAnalysisTarget[];
  onClose: () => void;
  onSave: (target: VideoAnalysisTarget, analysis: LiftVideoAnalysis) => Promise<void>;
}