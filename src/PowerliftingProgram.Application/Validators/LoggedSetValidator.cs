using PowerliftingProgram.Application.Contracts;
using PowerliftingProgram.Domain.Entities;
using FluentValidation;

namespace PowerliftingProgram.Application.Validators;

public sealed class LoggedSetValidator : AbstractValidator<LoggedSetRequest>
{
    public LoggedSetValidator()
    {
        RuleFor(request => request.IdempotencyKey).NotEmpty();
        RuleFor(request => request.AthleteProfileId).NotEmpty();
        RuleFor(request => request.TrainingSetId).NotEmpty();
        RuleFor(request => request.CompletionStatus)
            .IsInEnum()
            .NotEqual(SetCompletionStatus.Pending);

        When(request => request.CompletionStatus == SetCompletionStatus.Done, () =>
        {
            RuleFor(request => request.ActualLoadKg)
                .NotNull()
                .InclusiveBetween(0m, 1_000m);
            RuleFor(request => request.ActualRepetitions)
                .NotNull()
                .InclusiveBetween(1, 100);
            RuleFor(request => request.ActualRpe)
                .NotNull()
                .InclusiveBetween(1m, 10m);
            RuleFor(request => request.ActualEstimatedOneRepMaxKg)
                .NotNull()
                .InclusiveBetween(1m, 1_200m);
            RuleFor(request => request.ActualEffortPercentage)
                .NotNull()
                .InclusiveBetween(0.50m, 1.00m);
        });

        When(request => request.InstagramVideoUrl is not null, () =>
        {
            RuleFor(request => request.InstagramVideoUrl)
                .MaximumLength(2_048)
                .Must(BeAnInstagramVideoUrl)
                .WithMessage("Instagram video URL must be a public instagram.com/p or instagram.com/reel URL.");
        });

        RuleFor(request => request.AthleteNote).MaximumLength(2_000);
    }

    private static bool BeAnInstagramVideoUrl(string? value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            return false;
        }

        var isInstagramHost = uri.Scheme == Uri.UriSchemeHttps
            && (uri.Host.Equals("instagram.com", StringComparison.OrdinalIgnoreCase)
                || uri.Host.EndsWith(".instagram.com", StringComparison.OrdinalIgnoreCase));
        return isInstagramHost && (uri.AbsolutePath.StartsWith("/p/", StringComparison.OrdinalIgnoreCase)
            || uri.AbsolutePath.StartsWith("/reel/", StringComparison.OrdinalIgnoreCase));
    }
}

public sealed class SyncCommandValidator : AbstractValidator<SyncCommandRequest>
{
    private static readonly string[] AllowedCommandTypes = ["log-set", "skip-set", "attach-instagram-video", "add-comment"];

    public SyncCommandValidator()
    {
        RuleFor(command => command.CommandId).NotEmpty();
        RuleFor(command => command.AthleteProfileId).NotEmpty();
        RuleFor(command => command.AggregateId).NotEmpty();
        RuleFor(command => command.CommandType).Must(AllowedCommandTypes.Contains)
            .WithMessage("Command type must be one of: log-set, skip-set, attach-instagram-video, add-comment.");
        RuleFor(command => command.PayloadJson).NotEmpty().MaximumLength(20_000);
        RuleFor(command => command.DeviceId).NotEmpty().MaximumLength(128);
        RuleFor(command => command.CreatedAt)
            .LessThanOrEqualTo(DateTimeOffset.UtcNow.AddMinutes(5))
            .GreaterThan(DateTimeOffset.UtcNow.AddDays(-30));
    }
}