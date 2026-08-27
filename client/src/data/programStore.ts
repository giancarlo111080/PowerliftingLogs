import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type ProgramPhase = "Hypertrophy" | "Strength" | "Peak" | "Recovery";
export type ProgramStatus = "draft" | "active" | "completed";

export interface TrainingProgram {
  id: string;
  athleteId: string;
  name: string;
  phase: ProgramPhase;
  goal: string;
  startDate: string;
  endDate: string;
  trainingDaysPerWeek: number;
  exercises: string[];
  status: ProgramStatus;
  updatedAt: string;
}

export type ProgramInput = Omit<TrainingProgram, "id" | "athleteId" | "updatedAt">;

interface ProgramStore {
  programs: TrainingProgram[];
  isLoading: boolean;
  createProgram: (athleteId: string, input: ProgramInput) => Promise<void>;
  updateProgram: (programId: string, input: ProgramInput) => Promise<void>;
  deleteProgram: (programId: string) => Promise<void>;
}

const programStorageKey = "powerlifting-program/coach-programs";

const initialPrograms: TrainingProgram[] = [
  {
    id: "program-alex-peak",
    athleteId: "a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9",
    name: "Autumn Open Peak",
    phase: "Peak",
    goal: "Convert strength into confident competition attempts for the Autumn Open.",
    startDate: "2026-08-03",
    endDate: "2026-08-30",
    trainingDaysPerWeek: 4,
    exercises: ["Competition Squat", "Paused Bench Press", "Competition Deadlift"],
    status: "active",
    updatedAt: "2026-08-27T16:25:00.000Z"
  },
  {
    id: "program-alex-strength",
    athleteId: "a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9",
    name: "Base Strength - Completed",
    phase: "Strength",
    goal: "Build repeatable volume before the meet peak.",
    startDate: "2026-07-06",
    endDate: "2026-08-02",
    trainingDaysPerWeek: 4,
    exercises: ["High-Bar Squat", "Bench Press", "Romanian Deadlift"],
    status: "completed",
    updatedAt: "2026-08-02T18:00:00.000Z"
  },
  {
    id: "program-jordan-strength",
    athleteId: "4ef9844a-37de-42f6-bd31-ad587265ee90",
    name: "Regional Qualifier Strength",
    phase: "Strength",
    goal: "Increase top-set confidence while managing recovery.",
    startDate: "2026-08-17",
    endDate: "2026-09-13",
    trainingDaysPerWeek: 3,
    exercises: ["Low-Bar Squat", "Close-Grip Bench", "Deficit Deadlift"],
    status: "active",
    updatedAt: "2026-08-26T18:42:00.000Z"
  },
  {
    id: "program-mina-hypertrophy",
    athleteId: "270e0142-a437-44bc-9dcd-dd43676fd4b0",
    name: "Hypertrophy Accumulation",
    phase: "Hypertrophy",
    goal: "Add upper-back and bench volume before the next strength block.",
    startDate: "2026-07-27",
    endDate: "2026-08-30",
    trainingDaysPerWeek: 4,
    exercises: ["Tempo Squat", "Bench Press", "Chest-Supported Row"],
    status: "active",
    updatedAt: "2026-08-25T19:15:00.000Z"
  },
  {
    id: "program-sam-peak",
    athleteId: "f0be3194-989f-4a36-9c8f-9c27eaf7e3da",
    name: "City Open Peak",
    phase: "Peak",
    goal: "Practice competition commands and reduce accessory fatigue.",
    startDate: "2026-08-10",
    endDate: "2026-09-06",
    trainingDaysPerWeek: 4,
    exercises: ["Competition Squat", "Spoto Press", "Competition Deadlift"],
    status: "active",
    updatedAt: "2026-08-27T07:31:00.000Z"
  }
];

function createProgramId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `program-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isProgram(value: unknown): value is TrainingProgram {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TrainingProgram>;
  return typeof candidate.id === "string" &&
    typeof candidate.athleteId === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.goal === "string" &&
    typeof candidate.startDate === "string" &&
    typeof candidate.endDate === "string" &&
    typeof candidate.trainingDaysPerWeek === "number" &&
    Array.isArray(candidate.exercises) &&
    (candidate.phase === "Hypertrophy" || candidate.phase === "Strength" || candidate.phase === "Peak" || candidate.phase === "Recovery") &&
    (candidate.status === "draft" || candidate.status === "active" || candidate.status === "completed") &&
    typeof candidate.updatedAt === "string";
}

export function useProgramStore(): ProgramStore {
  const [programs, setPrograms] = useState<TrainingProgram[]>(initialPrograms);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restorePrograms() {
      try {
        const storedPrograms = await AsyncStorage.getItem(programStorageKey);
        if (!storedPrograms || !isMounted) {
          return;
        }

        const parsedPrograms = JSON.parse(storedPrograms) as unknown;
        if (Array.isArray(parsedPrograms) && parsedPrograms.every(isProgram)) {
          setPrograms(parsedPrograms);
        }
      }
      catch {
      }
      finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void restorePrograms();
    return () => {
      isMounted = false;
    };
  }, []);

  async function persistPrograms(nextPrograms: TrainingProgram[]) {
    setPrograms(nextPrograms);
    try {
      await AsyncStorage.setItem(programStorageKey, JSON.stringify(nextPrograms));
    }
    catch {
    }
  }

  async function createProgram(athleteId: string, input: ProgramInput) {
    const nextProgram: TrainingProgram = {
      ...input,
      id: createProgramId(),
      athleteId,
      updatedAt: new Date().toISOString()
    };
    const nextPrograms = input.status === "active"
      ? programs.map((program) => program.athleteId === athleteId && program.status === "active" ? { ...program, status: "draft" as const } : program)
      : programs;
    await persistPrograms([...nextPrograms, nextProgram]);
  }

  async function updateProgram(programId: string, input: ProgramInput) {
    const targetProgram = programs.find((program) => program.id === programId);
    const nextPrograms = programs.map((program) => {
      if (program.id === programId) {
        return { ...program, ...input, updatedAt: new Date().toISOString() };
      }
      if (input.status === "active" && program.athleteId === targetProgram?.athleteId && program.status === "active") {
        return { ...program, status: "draft" as const };
      }
      return program;
    });
    await persistPrograms(nextPrograms);
  }

  async function deleteProgram(programId: string) {
    await persistPrograms(programs.filter((program) => program.id !== programId));
  }

  return { programs, isLoading, createProgram, updateProgram, deleteProgram };
}