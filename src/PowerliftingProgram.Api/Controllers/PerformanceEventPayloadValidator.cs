using System.Globalization;
using System.Text.Json;
using PowerliftingProgram.Domain.Entities;

namespace PowerliftingProgram.Api.Controllers;

internal static class PerformanceEventPayloadValidator
{
    public static IReadOnlyList<(string Field, string Message)> Validate(
        PerformanceEventKind kind,
        JsonElement payload,
        Guid athleteProfileId,
        Guid actorUserId)
    {
        var errors = new List<(string, string)>();
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return errors;
        }

        switch (kind)
        {
            case PerformanceEventKind.RecoveryCheckIn:
                RequireAthlete(payload, athleteProfileId, errors);
                RequireString(payload, "id", 160, errors);
                RequireDateTime(payload, "recordedAt", errors);
                foreach (var score in new[] { "sleep", "soreness", "stress", "pain", "motivation" })
                {
                    RequireNumber(payload, score, 0, 10, errors);
                }
                OptionalNumber(payload, "bodyWeightKg", 20, 500, errors);
                OptionalString(payload, "notes", 4_000, errors);
                OptionalString(payload, "cycleContext", 500, errors);
                break;
            case PerformanceEventKind.TechniqueObservation:
                RequireAthlete(payload, athleteProfileId, errors);
                RequireString(payload, "id", 160, errors);
                RequireEnum(payload, "liftType", ["squat", "bench", "deadlift"], errors);
                RequireEnum(payload, "confidence", ["low", "moderate", "high"], errors);
                RequireDateTime(payload, "analyzedAt", errors);
                break;
            case PerformanceEventKind.Recommendation:
                RequireAthlete(payload, athleteProfileId, errors);
                RequireString(payload, "id", 240, errors);
                RequireString(payload, "action", 80, errors);
                RequireString(payload, "ruleVersion", 80, errors);
                RequireEnum(payload, "confidence", ["low", "moderate", "high"], errors);
                RequireDateTime(payload, "generatedAt", errors);
                RequireDateTime(payload, "expiresAt", errors);
                RequireArray(payload, "evidence", 1, 30, errors);
                break;
            case PerformanceEventKind.CoachDecision:
                RequireAthlete(payload, athleteProfileId, errors);
                RequireActor(payload, "coachId", actorUserId, errors);
                RequireString(payload, "id", 160, errors);
                RequireString(payload, "action", 100, errors);
                RequireEnum(payload, "status", ["approved", "rejected", "journal"], errors);
                RequireString(payload, "reason", 4_000, errors);
                RequireDateTime(payload, "createdAt", errors);
                OptionalDate(payload, "reviewDate", errors);
                OptionalEnum(payload, "outcome", ["improved", "neutral", "worsened", "inconclusive"], errors);
                break;
            case PerformanceEventKind.ProgramVersion:
                RequireAthlete(payload, athleteProfileId, errors);
                RequireActor(payload, "coachId", actorUserId, errors);
                RequireString(payload, "id", 160, errors);
                RequireString(payload, "programId", 160, errors);
                RequireInteger(payload, "version", 1, int.MaxValue, errors);
                RequireDateTime(payload, "createdAt", errors);
                RequireObject(payload, "snapshot", errors);
                break;
            case PerformanceEventKind.CompetitionPlan:
                RequireAthlete(payload, athleteProfileId, errors);
                RequireDate(payload, "meetDate", errors);
                RequireEnum(payload, "targetLift", ["squat", "bench", "deadlift"], errors);
                RequireNumber(payload, "targetKg", 0, 1_000, errors);
                RequireNumber(payload, "barWeightKg", 1, 100, errors);
                RequireObject(payload, "attempts", errors);
                RequireObject(payload, "checklist", errors);
                RequireDateTime(payload, "updatedAt", errors);
                OptionalInteger(payload, "revision", 1, int.MaxValue, errors);
                break;
            case PerformanceEventKind.CompetitionAttempt:
                RequireAthlete(payload, athleteProfileId, errors);
                RequireString(payload, "id", 160, errors);
                RequireDate(payload, "meetDate", errors);
                RequireEnum(payload, "lift", ["squat", "bench", "deadlift"], errors);
                RequireInteger(payload, "attemptNumber", 1, 3, errors);
                RequireNumber(payload, "weightKg", 1, 1_000, errors);
                RequireEnum(payload, "status", ["submitted", "changed"], errors);
                RequireInteger(payload, "sequence", 1, int.MaxValue, errors);
                RequireDateTime(payload, "recordedAt", errors);
                break;
            case PerformanceEventKind.CompetitionResult:
                RequireAthlete(payload, athleteProfileId, errors);
                RequireString(payload, "id", 160, errors);
                RequireString(payload, "attemptId", 160, errors);
                RequireDate(payload, "meetDate", errors);
                RequireEnum(payload, "lift", ["squat", "bench", "deadlift"], errors);
                RequireInteger(payload, "attemptNumber", 1, 3, errors);
                RequireNumber(payload, "weightKg", 1, 1_000, errors);
                RequireEnum(payload, "outcome", ["good", "missed"], errors);
                RequireInteger(payload, "sequence", 1, int.MaxValue, errors);
                RequireDateTime(payload, "recordedAt", errors);
                break;
            case PerformanceEventKind.ConsentGrant:
                RequireAthlete(payload, athleteProfileId, errors);
                RequireBoolean(payload, "operationalData", errors);
                RequireBoolean(payload, "modelTraining", errors);
                RequireBoolean(payload, "videoModelTraining", errors);
                RequireDateTime(payload, "updatedAt", errors);
                break;
            case PerformanceEventKind.ModelPrediction:
                RequireAthlete(payload, athleteProfileId, errors);
                RequireString(payload, "id", 160, errors);
                RequireString(payload, "modelVersion", 100, errors);
                RequireDateTime(payload, "generatedAt", errors);
                RequireObject(payload, "prediction", errors);
                break;
            case PerformanceEventKind.VideoAnnotation:
                RequireAthlete(payload, athleteProfileId, errors);
                RequireString(payload, "id", 160, errors);
                RequireString(payload, "analysisKey", 500, errors);
                RequireNumber(payload, "timestampSeconds", 0, 86_400, errors);
                RequireString(payload, "body", 4_000, errors);
                RequireDateTime(payload, "createdAt", errors);
                break;
            case PerformanceEventKind.AthleteGroup:
                RequireActor(payload, "coachId", actorUserId, errors);
                RequireString(payload, "id", 160, errors);
                RequireString(payload, "name", 160, errors);
                RequireGuidArrayContaining(payload, "athleteIds", athleteProfileId, errors);
                RequireDateTime(payload, "createdAt", errors);
                break;
            case PerformanceEventKind.ExerciseLibraryItem:
                RequireActor(payload, "coachId", actorUserId, errors);
                RequireString(payload, "id", 160, errors);
                RequireString(payload, "name", 200, errors);
                RequireEnum(payload, "category", ["squat", "bench", "deadlift", "accessory"], errors);
                RequireInteger(payload, "sets", 1, 100, errors);
                RequireInteger(payload, "repetitions", 1, 100, errors);
                RequireEnum(payload, "prescriptionMode", ["rpe", "rir", "percent", "exact"], errors);
                RequireNumber(payload, "prescriptionValue", 0, 1_000, errors);
                RequireEnum(payload, "weightUnit", ["kg", "lb"], errors);
                RequireArray(payload, "tags", 0, 50, errors);
                RequireDateTime(payload, "updatedAt", errors);
                break;
            case PerformanceEventKind.ExceptionDisposition:
                RequireAthlete(payload, athleteProfileId, errors);
                RequireActor(payload, "coachId", actorUserId, errors);
                RequireString(payload, "id", 160, errors);
                RequireString(payload, "exceptionKey", 300, errors);
                RequireEnum(payload, "status", ["snoozed", "resolved"], errors);
                RequireDateTime(payload, "createdAt", errors);
                OptionalDateTime(payload, "snoozedUntil", errors);
                break;
        }

        return errors;
    }

    private static void RequireAthlete(JsonElement payload, Guid expected, List<(string, string)> errors) => RequireGuidMatch(payload, "athleteId", expected, errors);

    private static void RequireActor(JsonElement payload, string property, Guid expected, List<(string, string)> errors) => RequireGuidMatch(payload, property, expected, errors);

    private static void RequireGuidMatch(JsonElement payload, string property, Guid expected, List<(string, string)> errors)
    {
        if (!payload.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.String || !Guid.TryParse(value.GetString(), out var parsed) || parsed != expected)
        {
            errors.Add(($"Payload.{property}", $"{property} must match the authenticated route context."));
        }
    }

    private static void RequireString(JsonElement payload, string property, int maximumLength, List<(string, string)> errors)
    {
        if (!payload.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(value.GetString()) || value.GetString()!.Length > maximumLength)
        {
            errors.Add(($"Payload.{property}", $"{property} is required and must be {maximumLength} characters or fewer."));
        }
    }

    private static void OptionalString(JsonElement payload, string property, int maximumLength, List<(string, string)> errors)
    {
        if (payload.TryGetProperty(property, out var value) && (value.ValueKind != JsonValueKind.String || value.GetString()!.Length > maximumLength))
        {
            errors.Add(($"Payload.{property}", $"{property} must be a string no longer than {maximumLength} characters."));
        }
    }

    private static void RequireNumber(JsonElement payload, string property, double minimum, double maximum, List<(string, string)> errors)
    {
        if (!payload.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.Number || !value.TryGetDouble(out var parsed) || !double.IsFinite(parsed) || parsed < minimum || parsed > maximum)
        {
            errors.Add(($"Payload.{property}", $"{property} must be between {minimum} and {maximum}."));
        }
    }

    private static void OptionalNumber(JsonElement payload, string property, double minimum, double maximum, List<(string, string)> errors)
    {
        if (payload.TryGetProperty(property, out var value) && (value.ValueKind != JsonValueKind.Number || !value.TryGetDouble(out var parsed) || !double.IsFinite(parsed) || parsed < minimum || parsed > maximum))
        {
            errors.Add(($"Payload.{property}", $"{property} must be between {minimum} and {maximum}."));
        }
    }

    private static void RequireInteger(JsonElement payload, string property, int minimum, int maximum, List<(string, string)> errors)
    {
        if (!payload.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.Number || !value.TryGetInt32(out var parsed) || parsed < minimum || parsed > maximum)
        {
            errors.Add(($"Payload.{property}", $"{property} must be a whole number between {minimum} and {maximum}."));
        }
    }

    private static void OptionalInteger(JsonElement payload, string property, int minimum, int maximum, List<(string, string)> errors)
    {
        if (payload.TryGetProperty(property, out var value) && (value.ValueKind != JsonValueKind.Number || !value.TryGetInt32(out var parsed) || parsed < minimum || parsed > maximum))
        {
            errors.Add(($"Payload.{property}", $"{property} must be a whole number between {minimum} and {maximum}."));
        }
    }

    private static void RequireBoolean(JsonElement payload, string property, List<(string, string)> errors)
    {
        if (!payload.TryGetProperty(property, out var value) || value.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
        {
            errors.Add(($"Payload.{property}", $"{property} must be a Boolean."));
        }
    }

    private static void RequireEnum(JsonElement payload, string property, string[] allowed, List<(string, string)> errors)
    {
        if (!payload.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.String || !allowed.Contains(value.GetString(), StringComparer.OrdinalIgnoreCase))
        {
            errors.Add(($"Payload.{property}", $"{property} must be one of: {string.Join(", ", allowed)}."));
        }
    }

    private static void OptionalEnum(JsonElement payload, string property, string[] allowed, List<(string, string)> errors)
    {
        if (payload.TryGetProperty(property, out var value) && (value.ValueKind != JsonValueKind.String || !allowed.Contains(value.GetString(), StringComparer.OrdinalIgnoreCase)))
        {
            errors.Add(($"Payload.{property}", $"{property} must be one of: {string.Join(", ", allowed)}."));
        }
    }

    private static void RequireObject(JsonElement payload, string property, List<(string, string)> errors)
    {
        if (!payload.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.Object)
        {
            errors.Add(($"Payload.{property}", $"{property} must be a JSON object."));
        }
    }

    private static void RequireArray(JsonElement payload, string property, int minimumLength, int maximumLength, List<(string, string)> errors)
    {
        if (!payload.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.Array || value.GetArrayLength() < minimumLength || value.GetArrayLength() > maximumLength)
        {
            errors.Add(($"Payload.{property}", $"{property} must contain between {minimumLength} and {maximumLength} items."));
        }
    }

    private static void RequireGuidArrayContaining(JsonElement payload, string property, Guid expected, List<(string, string)> errors)
    {
        if (!payload.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.Array || value.GetArrayLength() is < 1 or > 500 || !value.EnumerateArray().Any(item => item.ValueKind == JsonValueKind.String && Guid.TryParse(item.GetString(), out var parsed) && parsed == expected))
        {
            errors.Add(($"Payload.{property}", $"{property} must contain the route athlete and no more than 500 athlete IDs."));
        }
    }

    private static void RequireDateTime(JsonElement payload, string property, List<(string, string)> errors)
    {
        if (!payload.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.String || !DateTimeOffset.TryParse(value.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out _))
        {
            errors.Add(($"Payload.{property}", $"{property} must be an ISO-8601 timestamp."));
        }
    }

    private static void OptionalDateTime(JsonElement payload, string property, List<(string, string)> errors)
    {
        if (payload.TryGetProperty(property, out var value) && (value.ValueKind != JsonValueKind.String || !DateTimeOffset.TryParse(value.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out _)))
        {
            errors.Add(($"Payload.{property}", $"{property} must be an ISO-8601 timestamp."));
        }
    }

    private static void RequireDate(JsonElement payload, string property, List<(string, string)> errors)
    {
        if (!payload.TryGetProperty(property, out var value) || value.ValueKind != JsonValueKind.String || !DateOnly.TryParseExact(value.GetString(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
        {
            errors.Add(($"Payload.{property}", $"{property} must use YYYY-MM-DD."));
        }
    }

    private static void OptionalDate(JsonElement payload, string property, List<(string, string)> errors)
    {
        if (payload.TryGetProperty(property, out var value) && (value.ValueKind != JsonValueKind.String || !DateOnly.TryParseExact(value.GetString(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)))
        {
            errors.Add(($"Payload.{property}", $"{property} must use YYYY-MM-DD."));
        }
    }
}