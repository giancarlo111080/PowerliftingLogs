using PowerliftingProgram.Domain.Entities;

namespace PowerliftingProgram.Application.Services;

public sealed record WorkoutReward(int ExperiencePoints, int WorkoutStreak, string? EarnedBadgeCode);

public interface IGamificationService
{
    WorkoutReward AwardLoggedSet(AthleteProfile athlete, TrainingSet trainingSet, bool isPersonalRecord);
}

public sealed class GamificationService : IGamificationService
{
    public WorkoutReward AwardLoggedSet(AthleteProfile athlete, TrainingSet trainingSet, bool isPersonalRecord)
    {
        ArgumentNullException.ThrowIfNull(athlete);
        ArgumentNullException.ThrowIfNull(trainingSet);

        var completedDate = DateOnly.FromDateTime((trainingSet.CompletedAt ?? DateTimeOffset.UtcNow).UtcDateTime);
        var completedPreviouslyToday = athlete.LastCompletedTrainingDate == completedDate;
        var isConsecutiveDay = athlete.LastCompletedTrainingDate == completedDate.AddDays(-1);
        var setXp = trainingSet.Intent == SetIntent.Working ? 20 : 8;
        var prXp = isPersonalRecord ? 100 : 0;

        athlete.ExperiencePoints += setXp + prXp;
        if (!completedPreviouslyToday)
        {
            athlete.CurrentWorkoutStreak = isConsecutiveDay ? athlete.CurrentWorkoutStreak + 1 : 1;
            athlete.LastCompletedTrainingDate = completedDate;
        }

        var streak = athlete.CurrentWorkoutStreak;
        var badge = isPersonalRecord
            ? "personal-record"
            : streak > 0 && streak % 7 == 0
                ? $"streak-{streak}"
                : null;

        return new WorkoutReward(setXp + prXp, athlete.CurrentWorkoutStreak, badge);
    }
}
