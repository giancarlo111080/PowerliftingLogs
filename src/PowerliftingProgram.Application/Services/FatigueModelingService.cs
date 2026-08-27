using PowerliftingProgram.Application.Contracts;

namespace PowerliftingProgram.Application.Services;

public interface IFatigueModelingService
{
    decimal CalculateStress(LoadObservation observation);
    LoadModelState AdvanceOneDay(LoadModelState state, decimal dailyStress);
    AthleteReadiness CalculateReadiness(
        IEnumerable<LoadObservation> observations,
        DateOnly throughDate,
        LoadModelState? initialState = null);
}

public sealed class FatigueModelingService : IFatigueModelingService
{
    public const decimal AcuteDecayDays = 7m;
    public const decimal ChronicDecayDays = 28m;
    private const decimal ReadinessTargetRatio = 0.85m;
    private const decimal RatioRangeForZeroReadiness = 0.75m;

    public decimal CalculateStress(LoadObservation observation)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(observation.Repetitions, 0);
        ArgumentOutOfRangeException.ThrowIfLessThan(observation.PercentOfOneRepMax, 0m);
        ArgumentOutOfRangeException.ThrowIfLessThan(observation.EffortPercentage, 0m);
        ArgumentOutOfRangeException.ThrowIfLessThan(observation.ExerciseTypeModifier, 0m);

        var stress = observation.Repetitions
            * Math.Pow((double)(observation.PercentOfOneRepMax / 70m), 2)
            * Math.Pow((double)observation.EffortPercentage, 5)
            * (double)observation.ExerciseTypeModifier;

        return decimal.Round((decimal)stress, 4, MidpointRounding.AwayFromZero);
    }

    public LoadModelState AdvanceOneDay(LoadModelState state, decimal dailyStress)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(dailyStress, 0m);

        return new LoadModelState(
            ApplyEwma(state.AcuteLoad, dailyStress, AcuteDecayDays),
            ApplyEwma(state.ChronicLoad, dailyStress, ChronicDecayDays));
    }

    public AthleteReadiness CalculateReadiness(
        IEnumerable<LoadObservation> observations,
        DateOnly throughDate,
        LoadModelState? initialState = null)
    {
        ArgumentNullException.ThrowIfNull(observations);

        var stressByDate = observations
            .Where(observation => observation.Date <= throughDate)
            .GroupBy(observation => observation.Date)
            .ToDictionary(group => group.Key, group => group.Sum(CalculateStress));

        var state = initialState ?? new LoadModelState(0m, 0m);
        var startDate = stressByDate.Count == 0 ? throughDate : stressByDate.Keys.Min();

        for (var date = startDate; ; date = date.AddDays(1))
        {
            state = AdvanceOneDay(state, stressByDate.GetValueOrDefault(date));
            if (date == throughDate)
            {
                break;
            }
        }

        var ratio = state.ChronicLoad <= 0m ? 0m : state.AcuteLoad / state.ChronicLoad;
        var fatiguePenalty = decimal.Clamp(
            (ratio - ReadinessTargetRatio) / RatioRangeForZeroReadiness,
            0m,
            1m);
        var readiness = (int)decimal.Round(100m * (1m - fatiguePenalty), 0, MidpointRounding.AwayFromZero);

        return new AthleteReadiness(
            throughDate,
            decimal.Round(state.AcuteLoad, 2, MidpointRounding.AwayFromZero),
            decimal.Round(state.ChronicLoad, 2, MidpointRounding.AwayFromZero),
            readiness,
            decimal.Round(ratio, 2, MidpointRounding.AwayFromZero));
    }

    private static decimal ApplyEwma(decimal previousLoad, decimal stress, decimal decayDays)
    {
        var retainedLoad = (decimal)Math.Exp(-1d / (double)decayDays);
        return (previousLoad * retainedLoad) + (stress * (1m - retainedLoad));
    }
}