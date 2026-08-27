import type { WorkoutSnapshot } from "../types/training";

export const demoWorkout: WorkoutSnapshot = {
  athlete: {
    id: "a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9",
    displayName: "Alex Morgan",
    bodyWeightKg: 82.5,
    competitionWeightClass: "83 kg",
    activeBlockTag: "Peak / Week 4",
    upcomingMeetIdentifier: "Autumn Open - 18 days",
    squatOneRepMaxKg: 215,
    benchOneRepMaxKg: 147.5,
    deadliftOneRepMaxKg: 250,
    readinessScore: 84,
    acuteLoad: 465,
    chronicLoad: 524,
    workoutStreak: 6,
    experiencePoints: 2840
  },
  day: {
    id: "4267d598-e6cf-40b2-80cb-b5ffccf2cbf4",
    name: "Day 1",
    focus: "Competition squat / bench volume",
    scheduledFor: "2026-08-27",
    exercises: [
      {
        id: "e98f497f-b2c1-462b-8dca-e79dace4b1e4",
        name: "Competition Squat",
        exerciseType: "squat",
        exerciseTypeModifier: 1.15,
        sortOrder: 1,
        targetEstimatedOneRepMaxKg: 215,
        sets: [
          { id: "1f9764ca-6a0e-4c9b-a0ba-f8c55c9dd001", setNumber: 1, intent: "working", targetRepetitions: 4, targetLoadKg: 177.5, targetRpe: 7.5, targetEstimatedOneRepMaxKg: 215, completionStatus: "pending" },
          { id: "1f9764ca-6a0e-4c9b-a0ba-f8c55c9dd002", setNumber: 2, intent: "working", targetRepetitions: 4, targetLoadKg: 177.5, targetRpe: 7.5, targetEstimatedOneRepMaxKg: 215, completionStatus: "pending" },
          { id: "1f9764ca-6a0e-4c9b-a0ba-f8c55c9dd003", setNumber: 3, intent: "working", targetRepetitions: 4, targetLoadKg: 177.5, targetRpe: 7.5, targetEstimatedOneRepMaxKg: 215, completionStatus: "pending" }
        ]
      },
      {
        id: "ee1dc2c3-9c8f-43b6-86b8-00c17004c135",
        name: "Paused Bench Press",
        exerciseType: "bench-press",
        exerciseTypeModifier: 1,
        sortOrder: 2,
        targetEstimatedOneRepMaxKg: 147.5,
        sets: [
          { id: "8f0e7a59-a084-4d9d-8d8e-4133eb3c7001", setNumber: 1, intent: "working", targetRepetitions: 5, targetLoadKg: 112.5, targetRpe: 7, targetEstimatedOneRepMaxKg: 147.5, completionStatus: "pending" },
          { id: "8f0e7a59-a084-4d9d-8d8e-4133eb3c7002", setNumber: 2, intent: "working", targetRepetitions: 5, targetLoadKg: 112.5, targetRpe: 7, targetEstimatedOneRepMaxKg: 147.5, completionStatus: "pending" },
          { id: "8f0e7a59-a084-4d9d-8d8e-4133eb3c7003", setNumber: 3, intent: "working", targetRepetitions: 5, targetLoadKg: 112.5, targetRpe: 7, targetEstimatedOneRepMaxKg: 147.5, completionStatus: "pending" }
        ]
      },
      {
        id: "43161199-09d1-4afe-a40f-72fd61e1d564",
        name: "Chest-Supported Row",
        exerciseType: "accessory",
        exerciseTypeModifier: 0.7,
        sortOrder: 3,
        targetEstimatedOneRepMaxKg: 100,
        sets: [
          { id: "7f3fdca8-6b78-4013-8e87-4b5d8f31c001", setNumber: 1, intent: "accessory", targetRepetitions: 10, targetLoadKg: 70, targetRpe: 8, targetEstimatedOneRepMaxKg: 100, completionStatus: "pending" },
          { id: "7f3fdca8-6b78-4013-8e87-4b5d8f31c002", setNumber: 2, intent: "accessory", targetRepetitions: 10, targetLoadKg: 70, targetRpe: 8, targetEstimatedOneRepMaxKg: 100, completionStatus: "pending" }
        ]
      }
    ]
  }
};
