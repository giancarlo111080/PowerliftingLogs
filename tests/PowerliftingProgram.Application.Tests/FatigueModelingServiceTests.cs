using Xunit;
using PowerliftingProgram.Application.Contracts;
using PowerliftingProgram.Application.Services;

namespace PowerliftingProgram.Application.Tests;

public sealed class FatigueModelingServiceTests
{
    private readonly FatigueModelingService _service = new();

    [Fact]
    public void CalculateStress_UsesSpecifiedFormula()
    {
        var observation = new LoadObservation(
            new DateOnly(2026, 8, 1),
            Repetitions: 5,
            PercentOfOneRepMax: 70m,
            EffortPercentage: 1m,
            ExerciseTypeModifier: 1.1m);

        Assert.Equal(5.5m, _service.CalculateStress(observation));
    }

    [Fact]
    public void CalculateReadiness_DecaysBothLoadsAcrossRestDays()
    {
        var date = new DateOnly(2026, 8, 1);
        var observation = new LoadObservation(date, 5, 80m, 0.9m, 1m);

        var onTrainingDay = _service.CalculateReadiness([observation], date);
        var afterRest = _service.CalculateReadiness([observation], date.AddDays(7));

        Assert.True(afterRest.AcuteLoad < onTrainingDay.AcuteLoad);
        Assert.True(afterRest.ChronicLoad < onTrainingDay.ChronicLoad);
    }

    [Fact]
    public void CalculateReadiness_WithNoTraining_ReturnsOneHundred()
    {
        var readiness = _service.CalculateReadiness([], new DateOnly(2026, 8, 1));

        Assert.Equal(100, readiness.ReadinessScore);
    }
}
