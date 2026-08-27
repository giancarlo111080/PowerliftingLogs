BEGIN;

INSERT INTO "AthleteProfiles" (
    "Id", "ExternalUserId", "DisplayName", "Sex", "BodyWeightKg", "CompetitionWeightClass",
    "SquatOneRepMaxKg", "BenchOneRepMaxKg", "DeadliftOneRepMaxKg", "ActiveBlockTag",
    "UpcomingMeetIdentifier", "CumulativeWorkingSetTonnageKg", "ExperiencePoints", "CurrentWorkoutStreak",
    "LastCompletedTrainingDate", "CreatedAt", "UpdatedAt"
) VALUES (
    'a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9', 'demo-athlete', 'Alex Morgan', 1, 82.50, '83 kg',
    215.00, 147.50, 250.00, 'Peak / Week 4', 'Autumn Open', 1982.50, 2840, 6,
    '2026-08-27', '2026-08-27 16:00:00+00', '2026-08-27 16:25:00+00'
) ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "TrainingBlocks" (
    "Id", "AthleteProfileId", "Tag", "Name", "StartsOn", "EndsOn", "IsActive", "CreatedAt", "UpdatedAt"
) VALUES (
    'b3a197ec-73bf-4c1e-b2de-3b9305a2f9f9', 'a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9',
    'Peak / Week 4', 'Autumn Open Peak', '2026-08-03', '2026-08-30', TRUE,
    '2026-08-27 16:00:00+00', '2026-08-27 16:00:00+00'
) ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "TrainingWeeks" (
    "Id", "TrainingBlockId", "WeekNumber", "StartsOn", "CreatedAt", "UpdatedAt"
) VALUES (
    '30d2d5c4-3378-4df3-a7bb-051ec1d0b85a', 'b3a197ec-73bf-4c1e-b2de-3b9305a2f9f9', 4,
    '2026-08-24', '2026-08-27 16:00:00+00', '2026-08-27 16:00:00+00'
) ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "TrainingDays" (
    "Id", "TrainingWeekId", "Name", "Focus", "ScheduledFor", "StartedAt", "CompletedAt", "CreatedAt", "UpdatedAt"
) VALUES (
    '4267d598-e6cf-40b2-80cb-b5ffccf2cbf4', '30d2d5c4-3378-4df3-a7bb-051ec1d0b85a',
    'Day 1', 'Competition squat / bench volume', '2026-08-27', '2026-08-27 16:00:00+00', NULL,
    '2026-08-27 16:00:00+00', '2026-08-27 16:00:00+00'
) ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "PrescribedExercises" (
    "Id", "TrainingDayId", "Name", "ExerciseType", "ExerciseTypeModifier", "SortOrder",
    "TargetEstimatedOneRepMaxKg", "CreatedAt", "UpdatedAt"
) VALUES
    ('e98f497f-b2c1-462b-8dca-e79dace4b1e4', '4267d598-e6cf-40b2-80cb-b5ffccf2cbf4',
        'Competition Squat', 0, 1.150, 1, 215.00, '2026-08-27 16:00:00+00', '2026-08-27 16:00:00+00'),
    ('ee1dc2c3-9c8f-43b6-86b8-00c17004c135', '4267d598-e6cf-40b2-80cb-b5ffccf2cbf4',
        'Paused Bench Press', 1, 1.000, 2, 147.50, '2026-08-27 16:00:00+00', '2026-08-27 16:00:00+00'),
    ('43161199-09d1-4afe-a40f-72fd61e1d564', '4267d598-e6cf-40b2-80cb-b5ffccf2cbf4',
        'Chest-Supported Row', 4, 0.700, 3, 100.00, '2026-08-27 16:00:00+00', '2026-08-27 16:00:00+00')
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "TrainingSets" (
    "Id", "PrescribedExerciseId", "SetNumber", "Intent", "TargetRepetitions", "TargetLoadKg", "TargetRpe",
    "TargetEstimatedOneRepMaxKg", "CompletionStatus", "ActualLoadKg", "ActualRepetitions", "ActualRpe",
    "ActualEstimatedOneRepMaxKg", "ActualEffortPercentage", "CompletedAt", "InstagramVideoUrl", "AthleteNote",
    "CoachFormFlags", "CreatedAt", "UpdatedAt"
) VALUES
    ('1f9764ca-6a0e-4c9b-a0ba-f8c55c9dd001', 'e98f497f-b2c1-462b-8dca-e79dace4b1e4', 1, 1, 4, 177.50, 7.5,
        215.00, 1, 177.50, 4, 7.5, 193.64, 0.917, '2026-08-27 16:15:00+00',
        'https://www.instagram.com/reel/C9DemoSquat1/', NULL, 'Depth was consistent. Hold your brace through the walkout.',
        '2026-08-27 16:00:00+00', '2026-08-27 16:20:00+00'),
    ('1f9764ca-6a0e-4c9b-a0ba-f8c55c9dd002', 'e98f497f-b2c1-462b-8dca-e79dace4b1e4', 2, 1, 4, 177.50, 7.5,
        215.00, 1, 177.50, 4, 8.0, 193.64, 0.933, '2026-08-27 16:18:00+00',
        NULL, NULL, NULL, '2026-08-27 16:00:00+00', '2026-08-27 16:18:00+00'),
    ('1f9764ca-6a0e-4c9b-a0ba-f8c55c9dd003', 'e98f497f-b2c1-462b-8dca-e79dace4b1e4', 3, 1, 4, 177.50, 7.5,
        215.00, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
        NULL,
        '2026-08-27 16:00:00+00', '2026-08-27 16:00:00+00'),
    ('8f0e7a59-a084-4d9d-8d8e-4133eb3c7001', 'ee1dc2c3-9c8f-43b6-86b8-00c17004c135', 1, 1, 5, 112.50, 7.0,
        147.50, 1, 112.50, 5, 7.0, 126.56, 0.900, '2026-08-27 16:23:00+00',
        NULL, NULL, NULL, '2026-08-27 16:00:00+00', '2026-08-27 16:23:00+00'),
    ('8f0e7a59-a084-4d9d-8d8e-4133eb3c7002', 'ee1dc2c3-9c8f-43b6-86b8-00c17004c135', 2, 1, 5, 112.50, 7.0,
        147.50, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
        NULL,
        '2026-08-27 16:00:00+00', '2026-08-27 16:00:00+00'),
    ('8f0e7a59-a084-4d9d-8d8e-4133eb3c7003', 'ee1dc2c3-9c8f-43b6-86b8-00c17004c135', 3, 1, 5, 112.50, 7.0,
        147.50, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
        NULL,
        '2026-08-27 16:00:00+00', '2026-08-27 16:00:00+00'),
    ('7f3fdca8-6b78-4013-8e87-4b5d8f31c001', '43161199-09d1-4afe-a40f-72fd61e1d564', 1, 3, 10, 70.00, 8.0,
        100.00, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
        NULL,
        '2026-08-27 16:00:00+00', '2026-08-27 16:00:00+00'),
    ('7f3fdca8-6b78-4013-8e87-4b5d8f31c002', '43161199-09d1-4afe-a40f-72fd61e1d564', 2, 3, 10, 70.00, 8.0,
        100.00, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
        NULL,
        '2026-08-27 16:00:00+00', '2026-08-27 16:00:00+00')
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "CommentThreads" (
    "Id", "AthleteProfileId", "TrainingDayId", "PrescribedExerciseId", "TrainingSetId", "ContextType", "Subject",
    "IsResolved", "CreatedAt", "UpdatedAt"
) VALUES (
    '3d9389ec-d31b-48fc-bfeb-586859a45317', 'a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9', NULL, NULL,
    '1f9764ca-6a0e-4c9b-a0ba-f8c55c9dd001', 2, 'Competition squat set 1', FALSE,
    '2026-08-27 16:20:00+00', '2026-08-27 16:20:00+00'
) ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "ThreadComments" (
    "Id", "CommentThreadId", "AuthorUserId", "AuthorDisplayName", "Message", "IsCoachComment", "CreatedAt", "UpdatedAt"
) VALUES (
    '3756df81-bc5c-4c14-bb39-e0f68968000d', '3d9389ec-d31b-48fc-bfeb-586859a45317', 'coach-demo', 'Coach Taylor',
    'Strong first rep. Keep the knees tracking over the mid-foot on your final rep.', TRUE,
    '2026-08-27 16:20:00+00', '2026-08-27 16:20:00+00'
) ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "AthleteAchievements" (
    "Id", "AthleteProfileId", "Type", "BadgeCode", "Title", "EarnedAt", "Value", "CreatedAt", "UpdatedAt"
) VALUES (
    'be3c4316-7494-48c4-8ec3-c65f0faaf7d8', 'a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9', 1, 'streak-6',
    'Six day consistency streak', '2026-08-27 16:25:00+00', 6.00, '2026-08-27 16:25:00+00', '2026-08-27 16:25:00+00'
) ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "SyncCommands" (
    "Id", "CommandId", "AthleteProfileId", "AggregateId", "CommandType", "PayloadJson", "DeviceId", "Status",
    "ProcessedAt", "RejectionReason", "CreatedAt", "UpdatedAt"
) VALUES (
    '10f5d8a4-a0da-4677-9c4f-8a1df50555e2', '70b495b3-cb5b-4dfc-bac0-1cad6b61162f',
    'a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9', '1f9764ca-6a0e-4c9b-a0ba-f8c55c9dd001', 'attach-instagram-video',
    '{"trainingSetId":"1f9764ca-6a0e-4c9b-a0ba-f8c55c9dd001","instagramVideoUrl":"https://www.instagram.com/reel/C9DemoSquat1/","athleteNote":null,"coachFormFlags":null}'::jsonb,
    'development-seed', 1, '2026-08-27 16:20:00+00', NULL, '2026-08-27 16:20:00+00', '2026-08-27 16:20:00+00'
) ON CONFLICT ("Id") DO NOTHING;

COMMIT;
