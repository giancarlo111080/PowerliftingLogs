import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const powerliftingSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: "athlete_profiles",
      columns: [
        { name: "external_user_id", type: "string", isIndexed: true },
        { name: "display_name", type: "string" },
        { name: "body_weight_kg", type: "number" },
        { name: "competition_weight_class", type: "string" },
        { name: "squat_one_rep_max_kg", type: "number" },
        { name: "bench_one_rep_max_kg", type: "number" },
        { name: "deadlift_one_rep_max_kg", type: "number" },
        { name: "active_block_tag", type: "string", isOptional: true },
        { name: "upcoming_meet_identifier", type: "string", isOptional: true },
        { name: "cumulative_working_set_tonnage_kg", type: "number" },
        { name: "experience_points", type: "number" },
        { name: "current_workout_streak", type: "number" },
        { name: "last_completed_training_date", type: "string", isOptional: true }
      ]
    }),
    tableSchema({
      name: "training_blocks",
      columns: [
        { name: "athlete_profile_id", type: "string", isIndexed: true },
        { name: "tag", type: "string" },
        { name: "name", type: "string" },
        { name: "starts_on", type: "string" },
        { name: "ends_on", type: "string" },
        { name: "is_active", type: "boolean" }
      ]
    }),
    tableSchema({
      name: "training_weeks",
      columns: [
        { name: "training_block_id", type: "string", isIndexed: true },
        { name: "week_number", type: "number" },
        { name: "starts_on", type: "string" }
      ]
    }),
    tableSchema({
      name: "training_days",
      columns: [
        { name: "training_week_id", type: "string", isIndexed: true },
        { name: "name", type: "string" },
        { name: "focus", type: "string" },
        { name: "scheduled_for", type: "string" },
        { name: "started_at", type: "number", isOptional: true },
        { name: "completed_at", type: "number", isOptional: true }
      ]
    }),
    tableSchema({
      name: "prescribed_exercises",
      columns: [
        { name: "training_day_id", type: "string", isIndexed: true },
        { name: "name", type: "string" },
        { name: "exercise_type", type: "string" },
        { name: "exercise_type_modifier", type: "number" },
        { name: "sort_order", type: "number" },
        { name: "target_estimated_one_rep_max_kg", type: "number" }
      ]
    }),
    tableSchema({
      name: "training_sets",
      columns: [
        { name: "prescribed_exercise_id", type: "string", isIndexed: true },
        { name: "set_number", type: "number" },
        { name: "intent", type: "string" },
        { name: "target_repetitions", type: "number" },
        { name: "target_load_kg", type: "number" },
        { name: "target_rpe", type: "number" },
        { name: "target_estimated_one_rep_max_kg", type: "number" },
        { name: "completion_status", type: "string", isIndexed: true },
        { name: "actual_load_kg", type: "number", isOptional: true },
        { name: "actual_repetitions", type: "number", isOptional: true },
        { name: "actual_rpe", type: "number", isOptional: true },
        { name: "actual_estimated_one_rep_max_kg", type: "number", isOptional: true },
        { name: "actual_effort_percentage", type: "number", isOptional: true },
        { name: "completed_at", type: "number", isOptional: true },
        { name: "instagram_video_url", type: "string", isOptional: true },
        { name: "athlete_note", type: "string", isOptional: true },
        { name: "coach_form_flags", type: "string", isOptional: true }
      ]
    }),
    tableSchema({
      name: "comment_threads",
      columns: [
        { name: "athlete_profile_id", type: "string", isIndexed: true },
        { name: "training_day_id", type: "string", isOptional: true },
        { name: "prescribed_exercise_id", type: "string", isOptional: true },
        { name: "training_set_id", type: "string", isOptional: true },
        { name: "context_type", type: "string" },
        { name: "subject", type: "string" },
        { name: "is_resolved", type: "boolean" }
      ]
    }),
    tableSchema({
      name: "thread_comments",
      columns: [
        { name: "comment_thread_id", type: "string", isIndexed: true },
        { name: "author_user_id", type: "string" },
        { name: "author_display_name", type: "string" },
        { name: "message", type: "string" },
        { name: "is_coach_comment", type: "boolean" }
      ]
    }),
    tableSchema({
      name: "sync_commands",
      columns: [
        { name: "command_id", type: "string", isIndexed: true },
        { name: "athlete_profile_id", type: "string", isIndexed: true },
        { name: "aggregate_id", type: "string", isIndexed: true },
        { name: "command_type", type: "string" },
        { name: "payload_json", type: "string" },
        { name: "device_id", type: "string" },
        { name: "status", type: "string", isIndexed: true },
        { name: "retry_count", type: "number" },
        { name: "rejection_reason", type: "string", isOptional: true }
      ]
    }),
    tableSchema({
      name: "athlete_achievements",
      columns: [
        { name: "athlete_profile_id", type: "string", isIndexed: true },
        { name: "achievement_type", type: "string" },
        { name: "badge_code", type: "string" },
        { name: "title", type: "string" },
        { name: "earned_at", type: "number" },
        { name: "value", type: "number", isOptional: true }
      ]
    })
  ]
});
