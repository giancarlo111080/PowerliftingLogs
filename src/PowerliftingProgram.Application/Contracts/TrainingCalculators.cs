using PowerliftingProgram.Domain.Entities;

namespace PowerliftingProgram.Application.Contracts;

public sealed record WorkingSetTarget(
    int SetNumber,
    int Repetitions,
    decimal TargetRpe,
    decimal LoadKg,
    decimal PercentageOfEstimatedOneRepMax);

public sealed record WarmUpSet(int Repetitions, decimal LoadKg, string PlateLoading);

public sealed record PerformanceRank(decimal Wilks, decimal Dots, string Tier);

public interface ITrainingCalculationService
{
    IReadOnlyList<WorkingSetTarget> CalculateWorkingSets(
        decimal estimatedOneRepMaxKg,
        int sets,
        int repetitions,
        decimal targetRpe);

    IReadOnlyList<WarmUpSet> CalculateWarmUps(
        decimal workingLoadKg,
        decimal barbellKg = 20m,
        decimal plateIncrementKg = 2.5m);

    SessionStressAnalytics CalculateSessionAnalytics(
        TrainingDay trainingDay,
        decimal athleteOneRepMaxKg);

    PerformanceRank CalculatePerformanceRank(
        AthleteSex sex,
        decimal bodyWeightKg,
        decimal totalKg);
}
