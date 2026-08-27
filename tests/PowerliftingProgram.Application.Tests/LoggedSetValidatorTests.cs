using Xunit;
using PowerliftingProgram.Application.Contracts;
using PowerliftingProgram.Application.Validators;
using PowerliftingProgram.Domain.Entities;

namespace PowerliftingProgram.Application.Tests;

public sealed class LoggedSetValidatorTests
{
    private readonly LoggedSetValidator _validator = new();

    [Theory]
    [InlineData("https://www.instagram.com/reel/C9Example1/")]
    [InlineData("https://instagram.com/p/C9Example2/?igsh=abc")]
    public void Validate_AllowsPublicInstagramPostAndReelUrls(string instagramVideoUrl)
    {
        var result = _validator.Validate(CreateRequest(instagramVideoUrl));

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("https://example.com/reel/C9Example1/")]
    [InlineData("http://instagram.com/reel/C9Example1/")]
    [InlineData("https://www.instagram.com/stories/example/123")]
    public void Validate_RejectsNonPublicInstagramVideoUrls(string instagramVideoUrl)
    {
        var result = _validator.Validate(CreateRequest(instagramVideoUrl));

        Assert.False(result.IsValid);
    }

    private static LoggedSetRequest CreateRequest(string instagramVideoUrl) => new(
        Guid.NewGuid(),
        Guid.NewGuid(),
        Guid.NewGuid(),
        SetCompletionStatus.Done,
        100m,
        5,
        8m,
        116.7m,
        0.93m,
        instagramVideoUrl,
        null);
}
