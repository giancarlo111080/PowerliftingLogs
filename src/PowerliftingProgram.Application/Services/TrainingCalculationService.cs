using PowerliftingProgram.Domain.Entities;
using PowerliftingProgram.Application.Contracts;

namespace PowerliftingProgram.Application.Services;

public sealed class TrainingCalculationService : ITrainingCalculationService
{
    private static readonly decimal[] RpeAdjustmentByRpe =
    [
        0.86m, 0.89m, 0.92m, 0.94m, 0.96m, 0.98m, 1.00m, 1.02m, 1.04m, 1.06m
    ];

    public IReadOnlyList<WorkingSetTarget> CalculateWorkingSets(
        decimal estimatedOneRepMaxKg,
        int sets,
        int repetitions,
        decimal targetRpe)
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(estimatedOneRepMaxKg, 0m);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(estimatedOneRepMaxKg, 1_200m);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(sets);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(sets, 20);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(repetitions);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(repetitions, 100);
        ArgumentOutOfRangeException.ThrowIfLessThan(targetRpe, 1m);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(targetRpe, 10m);

        var basePercentage = BrzyckiPercentage(repetitions);
        var rpeIndex = (int)decimal.Round(targetRpe, 0, MidpointRounding.AwayFromZero) - 1;
        var percentage = decimal.Clamp(basePercentage * RpeAdjustmentByRpe[rpeIndex], 0.4m, 1.0m);
        var targetLoad = RoundToNearestPlate(estimatedOneRepMaxKg * percentage, 2.5m);

        return Enumerable.Range(1, sets)
            .Select(setNumber => new WorkingSetTarget(
                setNumber,
                repetitions,
                targetRpe,
                targetLoad,
                decimal.Round(percentage * 100m, 1)))
            .ToArray();
    }

    public IReadOnlyList<WarmUpSet> CalculateWarmUps(
        decimal workingLoadKg,
        decimal barbellKg = 20m,
        decimal plateIncrementKg = 2.5m)
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(workingLoadKg, 0m);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(workingLoadKg, 1_200m);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(barbellKg, 0m);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(barbellKg, 100m);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(plateIncrementKg, 0m);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(plateIncrementKg, 25m);
        if (workingLoadKg - plateIncrementKg < barbellKg)
        {
            return [];
        }

        var rawLoads = new[] { barbellKg, workingLoadKg * 0.45m, workingLoadKg * 0.62m, workingLoadKg * 0.78m, workingLoadKg * 0.9m };
        var repetitions = new[] { 10, 5, 3, 2, 1 };
        var warmUps = new List<WarmUpSet>();
        decimal? lastLoad = null;

        for (var index = 0; index < rawLoads.Length; index++)
        {
            var load = decimal.Clamp(RoundToNearestPlate(rawLoads[index], plateIncrementKg), barbellKg, workingLoadKg - plateIncrementKg);
            if (lastLoad == load || load >= workingLoadKg)
            {
                continue;
            }

            warmUps.Add(new WarmUpSet(repetitions[index], load, DescribePlateLoading(load, barbellKg)));
            lastLoad = load;
        }

        return warmUps;
    }

    public SessionStressAnalytics CalculateSessionAnalytics(TrainingDay trainingDay, decimal athleteOneRepMaxKg)
    {
        ArgumentNullException.ThrowIfNull(trainingDay);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(athleteOneRepMaxKg, 0m);

        var plannedSets = trainingDay.Exercises.SelectMany(exercise => exercise.Sets).ToArray();
        var completedSets = plannedSets.Where(set => set.CompletionStatus == SetCompletionStatus.Done).ToArray();
        var plannedTonnage = plannedSets.Sum(set => set.TargetLoadKg * set.TargetRepetitions);
        var completedTonnage = completedSets.Sum(set => (set.ActualLoadKg ?? 0m) * (set.ActualRepetitions ?? 0));
        var fatigueService = new FatigueModelingService();
        var plannedStress = plannedSets.Sum(set => fatigueService.CalculateStress(new LoadObservation(
            trainingDay.ScheduledFor,
            set.TargetRepetitions,
            (set.TargetLoadKg / athleteOneRepMaxKg) * 100m,
            RpeToEffort(set.TargetRpe),
            1m)));
        var completedStress = completedSets.Sum(set => fatigueService.CalculateStress(new LoadObservation(
            trainingDay.ScheduledFor,
            set.ActualRepetitions ?? 0,
            ((set.ActualLoadKg ?? 0m) / athleteOneRepMaxKg) * 100m,
            set.ActualEffortPercentage ?? RpeToEffort(set.ActualRpe ?? 1m),
            1m)));
        var completionRate = plannedTonnage == 0m ? 0m : completedTonnage / plannedTonnage;

        return new SessionStressAnalytics(
            trainingDay.Id,
            decimal.Round(plannedTonnage, 2),
            decimal.Round(completedTonnage, 2),
            decimal.Round(plannedStress, 2),
            decimal.Round(completedStress, 2),
            decimal.Round(completionRate, 3));
    }

    public PerformanceRank CalculatePerformanceRank(AthleteSex sex, decimal bodyWeightKg, decimal totalKg)
    {
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(bodyWeightKg, 0m);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(totalKg, 0m);

        var bodyWeight = (double)bodyWeightKg;
        var total = (double)totalKg;
        var wilksCoefficient = sex == AthleteSex.Female
            ? 594.31747775582d / (Math.Exp(-0.0000010706d * Math.Pow(bodyWeight, 4)) - Math.Exp(0.000255d * Math.Pow(bodyWeight, 3)) + Math.Exp(-0.01682d * Math.Pow(bodyWeight, 2)) + Math.Exp(0.760d * bodyWeight) - 57.96288d)
            : 500d / (-216.0475144d + (16.2606339d * bodyWeight) - (0.002388645d * Math.Pow(bodyWeight, 2)) - (0.00113732d * Math.Pow(bodyWeight, 3)) + (0.00000701863d * Math.Pow(bodyWeight, 4)) - (0.00000001291d * Math.Pow(bodyWeight, 5)));
        var dotsDenominator = sex == AthleteSex.Female
            ? -0.0000010706d * Math.Pow(bodyWeight, 4) + 0.000255d * Math.Pow(bodyWeight, 3) - 0.01682d * Math.Pow(bodyWeight, 2) + 0.760d * bodyWeight - 57.96288d
            : -0.000001093d * Math.Pow(bodyWeight, 4) + 0.0007391293d * Math.Pow(bodyWeight, 3) - 0.1918759221d * Math.Pow(bodyWeight, 2) + 24.0900756d * bodyWeight - 307.75076d;
        var wilks = decimal.Round((decimal)(total * wilksCoefficient), 2);
        var dots = decimal.Round((decimal)(500d / dotsDenominator * total), 2);
        var tier = dots switch
        {
            >= 500m => "Elite",
            >= 400m => "Advanced",
            >= 300m => "Intermediate",
            _ => "Novice"
        };

        return new PerformanceRank(wilks, dots, tier);
    }

    private static decimal BrzyckiPercentage(int repetitions) => decimal.Clamp(1m - ((repetitions - 1) * 0.0275m), 0.4m, 1m);

    private static decimal RpeToEffort(decimal rpe) => decimal.Clamp(0.7m + ((rpe - 1m) * (0.3m / 9m)), 0.5m, 1m);

    private static decimal RoundToNearestPlate(decimal load, decimal plateIncrementKg) =>
        decimal.Round(load / plateIncrementKg, 0, MidpointRounding.AwayFromZero) * plateIncrementKg;

    private static string DescribePlateLoading(decimal totalLoadKg, decimal barbellKg)
    {
        var perSide = Math.Max(0m, (totalLoadKg - barbellKg) / 2m);
        var denominations = new[] { 25m, 20m, 15m, 10m, 5m, 2.5m, 1.25m };
        var plates = new List<string>();

        foreach (var denomination in denominations)
        {
            var count = (int)(perSide / denomination);
            if (count > 0)
            {
                plates.Add($"{count} x {denomination:0.##} kg");
                perSide -= count * denomination;
            }
        }

        return plates.Count == 0 ? "Empty bar" : $"Per side: {string.Join(", ", plates)}";
    }
}
