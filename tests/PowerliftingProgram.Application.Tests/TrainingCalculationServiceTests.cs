using PowerliftingProgram.Application.Services;
using Xunit;

namespace PowerliftingProgram.Application.Tests;

public sealed class TrainingCalculationServiceTests
{
    private readonly TrainingCalculationService _service = new();

    [Theory]
    [InlineData(20, 20, 2.5)]
    [InlineData(21, 20, 2.5)]
    public void CalculateWarmUps_WhenNoLighterLoadCanBeBuilt_ReturnsNoWarmUps(
        decimal workingLoadKg,
        decimal barbellKg,
        decimal plateIncrementKg)
    {
        var warmUps = _service.CalculateWarmUps(workingLoadKg, barbellKg, plateIncrementKg);

        Assert.Empty(warmUps);
    }
}