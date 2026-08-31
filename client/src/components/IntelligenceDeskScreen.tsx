import { useEffect, useState, type ComponentProps } from "react";
import { Pressable, ScrollView, Text, TextInput as NativeTextInput, View } from "react-native";
import { AlertTriangle, BookOpen, Check, Clock3, GitCompare, MessageSquare, ShieldAlert, Users, Video, X } from "lucide-react-native";
import { Redirect } from "expo-router";

import { useSession } from "../auth/AuthSessionContext";
import { calculateRecoveryReadiness, generateAdaptiveRecommendations, type AdaptiveRecommendation } from "../data/adaptiveEngine";
import { getProgramAnalytics } from "../data/programAnalytics";
import { usePerformanceStore } from "../data/performanceStore";
import { useProgramWorkspaceStore, type ExerciseCategory, type TrainingProgram } from "../data/programWorkspaceStore";
import { AppShell } from "./AppShell";
import { DatePickerField } from "./DatePickerField";

interface CoachException {
  key: string;
  severity: 1 | 2 | 3;
  title: string;
  detail: string;
  occurredAt: string;
}

function deduplicateExceptions(items: CoachException[]) {
  const byKey = new Map<string, CoachException>();
  for (const item of items) {
    const existing = byKey.get(item.key);
    if (!existing || existing.occurredAt < item.occurredAt) byKey.set(item.key, item);
  }
  return [...byKey.values()];
}

function SectionTitle({ icon: Icon, eyebrow, title, count }: { icon: typeof AlertTriangle; eyebrow: string; title: string; count?: number }) {
  return <View className="mb-4 flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center bg-ink"><Icon size={19} color="#FF565E" /></View><View className="flex-1"><Text className="font-mono text-[10px] uppercase text-muted">{eyebrow}</Text><Text className="font-heading text-xl uppercase text-ink">{title}</Text></View>{count !== undefined ? <View className="min-w-8 items-center bg-signal px-2 py-1"><Text className="font-mono text-xs text-white">{count}</Text></View> : null}</View>;
}

function TextInput(props: ComponentProps<typeof NativeTextInput>) {
  const { placeholder, value, onChangeText } = props;
  if (placeholder === "Review date" && typeof value === "string" && onChangeText) {
    return <DatePickerField label="Review date" value={value} onChangeText={onChangeText} placeholder="YYYY-MM-DD" containerClassName="w-40" inputClassName="font-sans text-base" labelClassName="font-mono text-muted" />;
  }
  if (placeholder === "Start YYYY-MM-DD" && typeof value === "string" && onChangeText) {
    return <DatePickerField label="Start date" value={value} onChangeText={onChangeText} containerClassName="mt-2" inputClassName="font-sans text-base" labelClassName="font-mono text-muted" />;
  }
  return <NativeTextInput {...props} />;
}

function changedProgram(program: TrainingProgram, recommendation: AdaptiveRecommendation) {
  const next = JSON.parse(JSON.stringify(program)) as TrainingProgram;
  next.updatedAt = new Date().toISOString();
  if (recommendation.action === "begin-deload") {
    next.weeks.forEach((week) => week.days.forEach((day) => day.exercises.forEach((exercise) => {
      exercise.sets = Math.max(1, Math.ceil(exercise.sets * 0.6));
      exercise.prescriptionValue = exercise.prescriptionMode === "exact" || exercise.prescriptionMode === "percent" ? Math.round(exercise.prescriptionValue * 0.925 * 2) / 2 : Math.max(1, exercise.prescriptionValue - 0.5);
    })));
    return next;
  }
  const week = next.weeks.find((item) => item.id === recommendation.weekId);
  const day = week?.days.find((item) => item.id === recommendation.dayId);
  if (day && recommendation.patch?.scheduledDate) day.scheduledDate = recommendation.patch.scheduledDate;
  const exercise = day?.exercises.find((item) => item.id === recommendation.exerciseId);
  if (exercise && recommendation.patch?.sets !== undefined) exercise.sets = recommendation.patch.sets;
  if (exercise && recommendation.patch?.prescriptionValue !== undefined) exercise.prescriptionValue = recommendation.patch.prescriptionValue;
  return next;
}

function semanticProgramDiff(current: TrainingProgram, snapshot: TrainingProgram) {
  const changes: string[] = [];
  if (current.name !== snapshot.name) changes.push(`Name: ${snapshot.name} → ${current.name}`);
  if (current.phase !== snapshot.phase) changes.push(`Phase: ${snapshot.phase} → ${current.phase}`);
  if (current.startDate !== snapshot.startDate || current.endDate !== snapshot.endDate) changes.push(`Dates: ${snapshot.startDate}–${snapshot.endDate} → ${current.startDate}–${current.endDate}`);
  const currentDays = new Map(current.weeks.flatMap((week) => week.days).map((day) => [day.id, day]));
  const snapshotDays = new Map(snapshot.weeks.flatMap((week) => week.days).map((day) => [day.id, day]));
  for (const [dayId, day] of currentDays) {
    const beforeDay = snapshotDays.get(dayId);
    if (!beforeDay) {
      changes.push(`Added workout: ${day.name}`);
      continue;
    }
    if (day.scheduledDate !== beforeDay.scheduledDate) changes.push(`${day.name}: ${beforeDay.scheduledDate} → ${day.scheduledDate}`);
    const currentExercises = new Map(day.exercises.map((exercise) => [exercise.id, exercise]));
    const beforeExercises = new Map(beforeDay.exercises.map((exercise) => [exercise.id, exercise]));
    for (const [exerciseId, exercise] of currentExercises) {
      const before = beforeExercises.get(exerciseId);
      if (!before) changes.push(`${day.name}: added ${exercise.name}`);
      else if (exercise.sets !== before.sets || exercise.repetitions !== before.repetitions || exercise.prescriptionMode !== before.prescriptionMode || exercise.prescriptionValue !== before.prescriptionValue) changes.push(`${exercise.name}: ${before.sets}×${before.repetitions} @ ${before.prescriptionValue} ${before.prescriptionMode} → ${exercise.sets}×${exercise.repetitions} @ ${exercise.prescriptionValue} ${exercise.prescriptionMode}`);
    }
    for (const [exerciseId, exercise] of beforeExercises) if (!currentExercises.has(exerciseId)) changes.push(`${day.name}: removed ${exercise.name}`);
  }
  for (const [dayId, day] of snapshotDays) if (!currentDays.has(dayId)) changes.push(`Removed workout: ${day.name}`);
  return changes.length ? changes : ["No semantic changes from the current program."];
}

export function IntelligenceDeskScreen() {
  const { currentProfile, activeAthlete, profiles, session } = useSession();
  const workspace = useProgramWorkspaceStore();
  const performance = usePerformanceStore();
  const athleteId = activeAthlete?.id ?? "";
  const program = workspace.programs.find((item) => item.athleteId === athleteId && item.status === "active") ?? null;
  const recovery = performance.recovery.filter((item) => item.athleteId === athleteId);
  const latestRecovery = [...recovery].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
  const analytics = getProgramAnalytics(program, workspace.dayLogs);
  const allRecommendations = generateAdaptiveRecommendations(program, workspace.dayLogs, recovery, performance.meetPlans.find((item) => item.athleteId === athleteId)?.meetDate);
  const decidedIds = new Set(performance.decisions.filter((item) => item.athleteId === athleteId && item.recommendationId).map((item) => item.recommendationId));
  const recommendations = allRecommendations.filter((item) => !decidedIds.has(item.id));
  const versions = performance.versions.filter((item) => item.programId === program?.id).sort((a, b) => b.version - a.version);
  const decisions = performance.decisions.filter((item) => item.athleteId === athleteId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const analyses = workspace.dayLogs.filter((log) => log.programId === program?.id).flatMap((log) => log.sets.map((set) => set.videoAnalysis)).filter((analysis) => analysis);
  const [reason, setReason] = useState("");
  const [journalReason, setJournalReason] = useState("fatigue-management");
  const [journalNotes, setJournalNotes] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [annotation, setAnnotation] = useState("");
  const [timestamp, setTimestamp] = useState("0");
  const [groupName, setGroupName] = useState("");
  const [groupAthleteIds, setGroupAthleteIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [bulkTemplateId, setBulkTemplateId] = useState<string | null>(null);
  const [bulkStartDate, setBulkStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [exerciseDraft, setExerciseDraft] = useState({ name: "", category: "accessory" as ExerciseCategory, sets: "3", repetitions: "10", prescriptionMode: "rir" as "rpe" | "rir" | "percent" | "exact", prescriptionValue: "2", weightUnit: "kg" as "kg" | "lb", tags: "", notes: "" });
  const [exceptionNote, setExceptionNote] = useState("");
  const [reviewingDecisionId, setReviewingDecisionId] = useState<string | null>(null);
  const [reviewOutcome, setReviewOutcome] = useState<"improved" | "neutral" | "worsened" | "inconclusive">("improved");
  const [reviewNotes, setReviewNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const roster = profiles.filter((profile) => profile.role === "ATHLETE" && profile.coachId === currentProfile?.userId);
  const coachGroups = performance.groups.filter((group) => group.coachId === currentProfile?.id);
  const coachTemplates = workspace.templates.filter((template) => template.coachId === currentProfile?.userId);
  const selectedGroup = coachGroups.find((group) => group.id === selectedGroupId) ?? coachGroups[0] ?? null;
  const selectedBulkTemplate = coachTemplates.find((template) => template.id === bulkTemplateId) ?? coachTemplates[0] ?? null;

  useEffect(() => {
    if (!athleteId) return;
    setGroupAthleteIds((current) => current.length ? current : [athleteId]);
  }, [athleteId]);

  if (session && session.role !== "COACH") return <Redirect href="/dashboard" />;
  const readiness = calculateRecoveryReadiness(latestRecovery);
  const latestLogUpdate = workspace.dayLogs.filter((item) => item.programId === program?.id).map((item) => item.updatedAt).sort().at(-1) ?? program?.updatedAt ?? new Date(0).toISOString();
  const daysToMeet = performance.meetPlans.find((item) => item.athleteId === athleteId)?.meetDate
    ? Math.ceil((new Date(`${performance.meetPlans.find((item) => item.athleteId === athleteId)!.meetDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000)
    : null;
  const rawExceptions: CoachException[] = [
    ...(latestRecovery?.pain && latestRecovery.pain >= 4 ? [{ key: `pain:${latestRecovery.id}`, severity: 3 as const, title: `Pain ${latestRecovery.pain}/10`, detail: "Human review required; no automatic loading advice.", occurredAt: latestRecovery.recordedAt }] : []),
    ...(readiness <= 60 && latestRecovery ? [{ key: `readiness:${latestRecovery.id}`, severity: 2 as const, title: `Readiness ${readiness}/100`, detail: "Below the deterministic review threshold.", occurredAt: latestRecovery.recordedAt }] : []),
    ...(analytics.painLimitedSets ? [{ key: `pain-work:${latestLogUpdate}`, severity: 3 as const, title: `${analytics.painLimitedSets} pain-limited set${analytics.painLimitedSets === 1 ? "" : "s"}`, detail: "Review the athlete report before changing load or exercise selection.", occurredAt: latestLogUpdate }] : []),
    ...(analytics.skippedSets ? [{ key: `missed-work:${latestLogUpdate}`, severity: 2 as const, title: `${analytics.skippedSets} skipped sets`, detail: `${analytics.failedSets} failed; ${analytics.painLimitedSets} pain limited. Review classified outcomes.`, occurredAt: latestLogUpdate }] : []),
    ...(analytics.rpeOvershootCount >= 2 ? [{ key: `rpe-overshoot:${latestLogUpdate}`, severity: 2 as const, title: `${analytics.rpeOvershootCount} RPE overshoots`, detail: `Average target error ${analytics.averageRpeError ?? 0}.`, occurredAt: latestLogUpdate }] : []),
    ...((analytics.acuteChronicWorkloadRatio ?? 0) > 1.5 ? [{ key: `workload-spike:${latestLogUpdate}`, severity: 2 as const, title: `Workload ratio ${analytics.acuteChronicWorkloadRatio}`, detail: "7-day EWMA exceeds 150% of the 28-day EWMA.", occurredAt: latestLogUpdate }] : []),
    ...((analytics.workloadMonotony ?? 0) > 2 ? [{ key: `monotony:${latestLogUpdate}`, severity: 1 as const, title: `Workload monotony ${analytics.workloadMonotony}`, detail: "Recent daily loading has low variation.", occurredAt: latestLogUpdate }] : []),
    ...workspace.comments.filter((item) => item.programId === program?.id).slice(-3).map((item) => ({ key: `comment:${item.id}`, severity: 1 as const, title: "New training comment", detail: item.body, occurredAt: item.createdAt })),
    ...analyses.slice(-3).map((item) => ({ key: `analysis:${item!.analyzedAt}`, severity: (item!.confidence === "high" ? 2 : 1) as 1 | 2, title: `New ${item!.liftType ?? "lift"} video`, detail: `${item!.confidence} confidence · ${item!.cameraView} view`, occurredAt: item!.analyzedAt }))
  ];
  const latestDispositionByKey = new Map(performance.exceptionDispositions.filter((item) => item.athleteId === athleteId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((item) => [item.exceptionKey, item]));
  const exceptions = deduplicateExceptions(rawExceptions).filter((item) => {
    const disposition = latestDispositionByKey.get(item.key);
    return !disposition || (disposition.status === "snoozed" && Boolean(disposition.snoozedUntil) && disposition.snoozedUntil! <= new Date().toISOString());
  }).sort((a, b) => (b.severity * 100 + (daysToMeet !== null && daysToMeet <= 14 ? 20 : 0)) - (a.severity * 100 + (daysToMeet !== null && daysToMeet <= 14 ? 20 : 0)) || b.occurredAt.localeCompare(a.occurredAt));
  const today = new Date().toISOString().slice(0, 10);
  const dueReviews = decisions.filter((item) => item.reviewDate && item.reviewDate <= today && !item.reviewedAt && item.status !== "rejected");
  const reviewedDecisions = decisions.filter((item) => item.baselineMetrics && item.reviewMetrics && item.outcome);
  const readinessDelta = reviewedDecisions.length ? reviewedDecisions.reduce((total, item) => total + item.reviewMetrics!.readiness - item.baselineMetrics!.readiness, 0) / reviewedDecisions.length : 0;
  const adherenceDelta = reviewedDecisions.length ? reviewedDecisions.reduce((total, item) => total + item.reviewMetrics!.adherencePercent - item.baselineMetrics!.adherencePercent, 0) / reviewedDecisions.length : 0;

  function currentDecisionMetrics() {
    return { readiness, fatigue: analytics.currentFatigueScore, adherencePercent: analytics.adherencePercent, averageRpeError: analytics.averageRpeError, recordedAt: new Date().toISOString() };
  }

  function defaultReviewDate() {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 7);
    return date.toISOString().slice(0, 10);
  }

  async function disposeException(item: CoachException, status: "snoozed" | "resolved") {
    if (!currentProfile || !athleteId) return;
    await performance.saveExceptionDisposition({ coachId: currentProfile.id, athleteId, exceptionKey: item.key, status, ...(exceptionNote.trim() ? { note: exceptionNote.trim() } : {}), ...(status === "snoozed" ? { snoozedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() } : {}) });
    setExceptionNote("");
    setMessage(status === "snoozed" ? "Exception snoozed for 24 hours." : "Exception resolved with an attributable disposition.");
  }

  async function applyRecommendation(item: AdaptiveRecommendation) {
    if (!program || !currentProfile) return;
    const currentProgram = workspace.programs.find((candidate) => candidate.id === item.programId);
    if (!currentProgram || currentProgram.updatedAt !== item.baseProgramUpdatedAt) {
      setMessage("This recommendation is stale because the program changed. Review the newly generated evidence before approving it.");
      return;
    }
    await performance.recordRecommendation(item);
    const existing = performance.versions.filter((version) => version.programId === program.id);
    if (!existing.length) await performance.recordVersion({ programId: program.id, athleteId, coachId: currentProfile.id, reason: "Baseline before adaptive decision", snapshot: program });
    const next = changedProgram(currentProgram, item);
    if (item.action === "begin-deload") {
      for (const week of next.weeks) for (const day of week.days) for (const exercise of day.exercises) await workspace.updateExercise(next.id, week.id, day.id, exercise);
    }
    else if (item.patch?.scheduledDate && item.weekId && item.dayId) await workspace.rescheduleDay(program.id, item.weekId, item.dayId, item.patch.scheduledDate, "coach");
    else if (item.exerciseId && item.weekId && item.dayId) {
      const exercise = next.weeks.find((week) => week.id === item.weekId)?.days.find((day) => day.id === item.dayId)?.exercises.find((candidate) => candidate.id === item.exerciseId);
      if (exercise) await workspace.updateExercise(program.id, item.weekId, item.dayId, exercise);
    }
    if (item.patch || item.action === "begin-deload") await performance.recordVersion({ programId: program.id, athleteId, coachId: currentProfile.id, reason: `Approved: ${item.title}`, snapshot: next });
    await performance.recordDecision({ coachId: currentProfile.id, athleteId, programId: program.id, recommendationId: item.id, action: item.action, status: "approved", reason: reason.trim() || "Accepted engine evidence", before: item.before, after: item.after, expectedOutcome: item.rationale, reviewDate: defaultReviewDate(), baselineMetrics: currentDecisionMetrics() });
    setReason("");
    setMessage(`${item.title} approved and recorded${item.patch || item.action === "begin-deload" ? " as a new program version" : ""}.`);
  }

  async function rejectRecommendation(item: AdaptiveRecommendation) {
    if (!currentProfile || !reason.trim()) {
      setMessage("Enter a reason before rejecting a recommendation.");
      return;
    }
    await performance.recordRecommendation(item);
    await performance.recordDecision({ coachId: currentProfile.id, athleteId, programId: program?.id, recommendationId: item.id, action: item.action, status: "rejected", reason: reason.trim(), before: item.before, after: item.after, expectedOutcome: item.rationale });
    setReason("");
    setMessage(`${item.title} rejected with rationale retained.`);
  }

  async function addJournalEntry() {
    if (!currentProfile || !journalNotes.trim()) return setMessage("Add decision notes before saving the journal entry.");
    if (reviewDate && !/^\d{4}-\d{2}-\d{2}$/.test(reviewDate)) return setMessage("Enter the review date as YYYY-MM-DD.");
    await performance.recordDecision({ coachId: currentProfile.id, athleteId, programId: program?.id, action: journalReason, status: "journal", reason: journalNotes.trim(), expectedOutcome: expectedOutcome.trim() || "Not specified", reviewDate: reviewDate || defaultReviewDate(), baselineMetrics: currentDecisionMetrics() });
    setJournalNotes(""); setExpectedOutcome(""); setReviewDate(""); setMessage("Decision journal entry saved.");
  }

  async function completeDecisionReview() {
    if (!reviewingDecisionId || !reviewNotes.trim()) return setMessage("Describe the observed outcome before completing the review.");
    await performance.reviewDecision(reviewingDecisionId, reviewOutcome, reviewNotes, currentDecisionMetrics());
    setReviewingDecisionId(null); setReviewNotes(""); setMessage("Intervention outcome recorded.");
  }

  async function rollbackVersion(version: (typeof versions)[number]) {
    if (!program || !currentProfile) return;
    try {
      const restored = await workspace.restoreProgramSnapshot(program.id, version.snapshot, program.updatedAt);
      await performance.recordVersion({ programId: restored.id, athleteId, coachId: currentProfile.id, reason: `Restored from version ${version.version}`, snapshot: restored });
      await performance.recordDecision({ coachId: currentProfile.id, athleteId, programId: restored.id, action: "program-rollback", status: "approved", reason: `Restored version ${version.version}: ${version.reason}`, before: program.updatedAt, after: restored.updatedAt, expectedOutcome: "Return the plan to the selected known state without erasing intervening history.", reviewDate: defaultReviewDate(), baselineMetrics: currentDecisionMetrics() });
      setMessage(`Version ${version.version} restored as a new immutable version.`);
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : "The version could not be restored.");
    }
  }

  async function addVideoNote() {
    if (!currentProfile || !analyses.length || !annotation.trim()) return setMessage("Select analyzed footage and enter a review note.");
    const analysis = analyses.at(-1)!;
    await performance.addAnnotation({ athleteId, coachId: currentProfile.id, analysisKey: `${analysis.sourceFileName}:${analysis.analyzedAt}`, timestampSeconds: Math.max(0, Number(timestamp) || 0), body: annotation.trim() });
    setAnnotation(""); setMessage("Timestamped video note saved.");
  }

  async function saveGroup() {
    if (!currentProfile || !groupName.trim() || !groupAthleteIds.length) return setMessage("Name the group and select at least one athlete.");
    await performance.saveGroup({ coachId: currentProfile.id, name: groupName.trim(), athleteIds: groupAthleteIds });
    setGroupName(""); setMessage(`Athlete group saved with ${groupAthleteIds.length} member${groupAthleteIds.length === 1 ? "" : "s"}.`);
  }

  async function assignGroupTemplate() {
    if (!currentProfile || !selectedGroup || !selectedBulkTemplate || !/^\d{4}-\d{2}-\d{2}$/.test(bulkStartDate)) return setMessage("Select a group and template, then enter the start date as YYYY-MM-DD.");
    const results: Array<{ athleteId: string; status: "assigned" | "unchanged" | "failed"; error?: string }> = [];
    for (const targetAthleteId of selectedGroup.athleteIds) {
      try {
        const existing = workspace.programs.find((item) => item.athleteId === targetAthleteId && item.status === "active" && item.templateId === selectedBulkTemplate.id);
        const assigned = await workspace.assignTemplate(selectedBulkTemplate.id, targetAthleteId, bulkStartDate);
        const status = existing ? "unchanged" as const : "assigned" as const;
        results.push({ athleteId: targetAthleteId, status });
        await performance.recordDecision({ coachId: currentProfile.id, athleteId: targetAthleteId, programId: assigned.id, action: "bulk-template-assignment", status: "journal", reason: `${selectedBulkTemplate.name} ${status} via ${selectedGroup.name}`, expectedOutcome: "Deliver the reviewed group template while retaining an independent athlete program.", reviewDate: defaultReviewDate(), baselineMetrics: currentDecisionMetrics() });
      }
      catch (error) {
        results.push({ athleteId: targetAthleteId, status: "failed", error: error instanceof Error ? error.message : "Unknown assignment error" });
      }
    }
    const assignedCount = results.filter((result) => result.status === "assigned").length;
    const unchangedCount = results.filter((result) => result.status === "unchanged").length;
    const failures = results.filter((result) => result.status === "failed");
    setMessage(`${assignedCount} assigned, ${unchangedCount} already current, ${failures.length} failed${failures.length ? `: ${failures.map((result) => roster.find((profile) => profile.id === result.athleteId)?.displayName ?? result.athleteId).join(", ")}` : "."}`);
  }

  async function saveLibraryExercise() {
    if (!currentProfile || !athleteId) return setMessage("Select an athlete before saving a tenant-scoped exercise.");
    const sets = Number(exerciseDraft.sets);
    const repetitions = Number(exerciseDraft.repetitions);
    const prescriptionValue = Number(exerciseDraft.prescriptionValue);
    if (!exerciseDraft.name.trim() || !Number.isInteger(sets) || sets < 1 || !Number.isInteger(repetitions) || repetitions < 1 || !Number.isFinite(prescriptionValue) || prescriptionValue < 0) return setMessage("Enter an exercise name, positive whole-number sets/reps, and a valid target.");
    await performance.saveExerciseLibraryItem(athleteId, { coachId: currentProfile.id, name: exerciseDraft.name, category: exerciseDraft.category, sets, repetitions, prescriptionMode: exerciseDraft.prescriptionMode, prescriptionValue, weightUnit: exerciseDraft.weightUnit, tags: exerciseDraft.tags.split(","), ...(exerciseDraft.notes.trim() ? { notes: exerciseDraft.notes.trim() } : {}) });
    setExerciseDraft({ name: "", category: "accessory", sets: "3", repetitions: "10", prescriptionMode: "rir", prescriptionValue: "2", weightUnit: "kg", tags: "", notes: "" });
    setMessage("Exercise saved to the coach library.");
  }

  async function addLibraryExercise(item: (typeof performance.exerciseLibrary)[number]) {
    if (!program) return setMessage("Select an athlete with an active program first.");
    const targetDay = program.weeks.flatMap((week) => week.days.map((day) => ({ week, day }))).sort((a, b) => a.day.scheduledDate.localeCompare(b.day.scheduledDate)).find(({ day }) => day.scheduledDate >= today) ?? program.weeks.flatMap((week) => week.days.map((day) => ({ week, day })))[0];
    if (!targetDay) return setMessage("The active program has no workout day to receive this exercise.");
    await workspace.addExercise(program.id, targetDay.week.id, targetDay.day.id, item.category, { name: item.name, sets: item.sets, repetitions: item.repetitions, prescriptionMode: item.prescriptionMode, prescriptionValue: item.prescriptionValue, weightUnit: item.weightUnit });
    setMessage(`${item.name} added to ${targetDay.day.name}.`);
  }

  return <AppShell title="Intelligence Desk"><ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-8 px-4 py-6 pb-16">
    <View className="border-l-4 border-signal pl-4"><Text className="font-mono text-xs uppercase text-moss">Coach control plane</Text><Text className="mt-1 font-heading text-3xl uppercase text-ink">{activeAthlete?.displayName ?? "Select an athlete"}</Text><Text className="mt-2 font-sans text-sm text-muted">Exceptions first. Recommendations explain their evidence. Only your approval changes training.</Text></View>
    {message ? <View className="border border-moss bg-paper p-3"><Text className="font-sans text-sm text-ink">{message}</Text></View> : null}

    <View className="gap-5 lg:flex-row"><View className="flex-1 bg-paper p-5"><SectionTitle icon={ShieldAlert} eyebrow="Ranked and deduplicated" title="Exception desk" count={exceptions.length} /><TextInput className="mb-2 min-h-10 border border-fog bg-canvas px-3 font-sans text-sm text-ink" value={exceptionNote} onChangeText={setExceptionNote} placeholder="Disposition note (optional)" placeholderTextColor="#8996AC" />{exceptions.length ? exceptions.map((item) => <View key={item.key} className="flex-row gap-3 border-t border-fog py-3"><AlertTriangle size={17} color={item.severity >= 3 ? "#FF3B45" : "#FF565E"} /><View className="flex-1"><Text className="font-sans text-sm font-bold text-ink">{item.title}</Text><Text className="mt-1 font-sans text-xs leading-5 text-muted">{item.detail}</Text><View className="mt-2 flex-row gap-2"><Pressable className="border border-fog px-2 py-1" onPress={() => void disposeException(item, "snoozed")}><Text className="font-mono text-[10px] uppercase text-muted">Snooze 24h</Text></Pressable><Pressable className="border border-moss px-2 py-1" onPress={() => void disposeException(item, "resolved")}><Text className="font-mono text-[10px] uppercase text-moss">Resolve</Text></Pressable></View></View></View>) : <Text className="font-sans text-sm text-muted">No readiness, adherence, pain, video, or comment exceptions require review.</Text>}</View>
      <View className="flex-1 bg-ink p-5"><Text className="font-mono text-xs uppercase text-[#ABB5C8]">Current response snapshot</Text><Text className="mt-4 font-heading text-5xl text-white">{readiness}<Text className="text-lg"> readiness</Text></Text><View className="mt-5 border-t border-[#52607A] pt-4"><Text className="font-sans text-sm text-white">Adherence {analytics.adherencePercent}% · fatigue {analytics.currentFatigueScore}/100</Text><Text className="mt-2 font-sans text-xs leading-5 text-[#ABB5C8]">{recovery.length < 8 ? `Insufficient history for personalized response estimates (${recovery.length}/8 check-ins). Deterministic rules remain authoritative.` : "Recovery sample threshold met. Patterns are correlations and require coach confirmation."}</Text></View></View></View>

    <View className="bg-paper p-5"><SectionTitle icon={GitCompare} eyebrow="Rules v1 · coach approval required" title="Adaptive recommendations" count={recommendations.length} /><TextInput className="mb-4 min-h-11 border border-fog bg-canvas px-3 font-sans text-ink" value={reason} onChangeText={setReason} placeholder="Decision reason (required for rejection)" placeholderTextColor="#8996AC" />{recommendations.length ? recommendations.map((item) => <View key={item.id} className="border-t border-fog py-4"><View className="flex-row flex-wrap items-start justify-between gap-2"><View className="flex-1"><Text className="font-heading text-lg uppercase text-ink">{item.title}</Text><Text className="mt-1 font-sans text-sm leading-5 text-muted">{item.rationale}</Text></View><Text className="font-mono text-xs uppercase text-moss">{item.confidence}</Text></View><View className="mt-3 bg-canvas p-3"><Text className="font-mono text-xs text-muted">{item.before} → {item.after}</Text>{item.evidence.map((evidence) => <Text key={evidence} className="mt-1 font-sans text-xs text-ink">• {evidence}</Text>)}</View><View className="mt-3 flex-row gap-2"><Pressable className="min-h-10 flex-1 flex-row items-center justify-center gap-2 bg-moss" onPress={() => void applyRecommendation(item)}><Check size={15} color="#FFFFFF" /><Text className="font-heading uppercase text-white">Approve</Text></Pressable><Pressable className="min-h-10 flex-1 flex-row items-center justify-center gap-2 border border-signal" onPress={() => void rejectRecommendation(item)}><X size={15} color="#FF3B45" /><Text className="font-heading uppercase text-signal">Reject</Text></Pressable></View></View>) : <Text className="font-sans text-sm text-muted">No pending recommendation meets the bounded rule thresholds.</Text>}</View>

    <View className="gap-5 lg:flex-row"><View className="flex-1 bg-paper p-5"><SectionTitle icon={Clock3} eyebrow="Immutable snapshots" title="Program versions" count={versions.length} />{versions.slice(0, 6).map((version) => { const changes = program ? semanticProgramDiff(program, version.snapshot).slice(0, 4) : []; return <View key={version.id} className="border-t border-fog py-3"><View className="flex-row flex-wrap items-center justify-between gap-2"><View><Text className="font-heading uppercase text-ink">Version {version.version}</Text><Text className="mt-1 font-sans text-xs text-muted">{version.reason}</Text></View><Pressable className="border border-ink px-3 py-2 disabled:opacity-40" disabled={!program} onPress={() => void rollbackVersion(version)}><Text className="font-heading uppercase text-ink">Restore</Text></Pressable></View><Text className="mt-2 font-mono text-[10px] text-muted">{new Date(version.createdAt).toLocaleString()}</Text>{changes.map((change) => <Text key={change} className="mt-1 font-sans text-xs leading-5 text-ink">{change}</Text>)}</View>; })}{!versions.length ? <Text className="font-sans text-sm text-muted">The first approved mutation captures a baseline and an attributable next version.</Text> : null}</View>
      <View className="flex-1 bg-paper p-5"><SectionTitle icon={BookOpen} eyebrow="Intervention memory" title="Decision journal" count={decisions.length} /><View className="flex-row flex-wrap gap-2">{["fatigue-management", "technique", "schedule", "pain-review", "meet-strategy"].map((code) => <Pressable key={code} className={`border px-2 py-1 ${journalReason === code ? "border-ink bg-ink" : "border-fog"}`} onPress={() => setJournalReason(code)}><Text className={`font-mono text-[10px] ${journalReason === code ? "text-white" : "text-muted"}`}>{code}</Text></Pressable>)}</View><TextInput className="mt-3 min-h-20 border border-fog bg-canvas p-3 font-sans text-ink" multiline value={journalNotes} onChangeText={setJournalNotes} placeholder="Decision, evidence, and alternatives considered" placeholderTextColor="#8996AC" /><View className="mt-2 flex-row gap-2"><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={expectedOutcome} onChangeText={setExpectedOutcome} placeholder="Expected outcome" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 w-32 border border-fog bg-canvas px-3 font-sans text-ink" value={reviewDate} onChangeText={setReviewDate} placeholder="Review date" placeholderTextColor="#8996AC" /></View><Pressable className="mt-3 min-h-10 items-center justify-center bg-ink" onPress={() => void addJournalEntry()}><Text className="font-heading uppercase text-white">Record decision</Text></Pressable></View></View>

    <View className="gap-5 lg:flex-row"><View className="flex-1 bg-paper p-5"><SectionTitle icon={Clock3} eyebrow="Due and attributable" title="Outcome reviews" count={dueReviews.length} />{dueReviews.length ? dueReviews.map((decision) => <View key={decision.id} className="border-t border-fog py-3"><Text className="font-sans text-sm font-bold text-ink">{decision.action}</Text><Text className="mt-1 font-sans text-xs text-muted">Expected: {decision.expectedOutcome ?? "Not specified"}</Text>{reviewingDecisionId === decision.id ? <View className="mt-3"><View className="flex-row flex-wrap gap-2">{(["improved", "neutral", "worsened", "inconclusive"] as const).map((outcome) => <Pressable key={outcome} className={`border px-2 py-1 ${reviewOutcome === outcome ? "border-ink bg-ink" : "border-fog"}`} onPress={() => setReviewOutcome(outcome)}><Text className={`font-mono text-[10px] uppercase ${reviewOutcome === outcome ? "text-white" : "text-muted"}`}>{outcome}</Text></Pressable>)}</View><TextInput className="mt-2 min-h-16 border border-fog bg-canvas p-2 font-sans text-sm text-ink" multiline value={reviewNotes} onChangeText={setReviewNotes} placeholder="Observed outcome and confounders" placeholderTextColor="#8996AC" /><Pressable className="mt-2 min-h-9 items-center justify-center bg-moss" onPress={() => void completeDecisionReview()}><Text className="font-heading uppercase text-white">Complete review</Text></Pressable></View> : <Pressable className="mt-2 self-start border border-ink px-3 py-2" onPress={() => { setReviewingDecisionId(decision.id); setReviewNotes(""); }}><Text className="font-heading uppercase text-ink">Review outcome</Text></Pressable>}</View>) : <Text className="font-sans text-sm text-muted">No intervention review is due today.</Text>}</View><View className="flex-1 bg-ink p-5"><Text className="font-mono text-xs uppercase text-[#ABB5C8]">Response profile</Text>{reviewedDecisions.length >= 8 ? <><Text className="mt-4 font-heading text-3xl text-white">{readinessDelta >= 0 ? "+" : ""}{readinessDelta.toFixed(1)} readiness</Text><Text className="mt-2 font-sans text-sm text-[#D7DCE7]">Mean adherence change {adherenceDelta >= 0 ? "+" : ""}{adherenceDelta.toFixed(1)} points across {reviewedDecisions.length} reviewed interventions.</Text><Text className="mt-3 font-sans text-xs leading-5 text-[#ABB5C8]">Association only. Training phase, meet proximity, reporting, and outside stress may confound the result.</Text></> : <Text className="mt-4 font-sans text-sm leading-6 text-[#D7DCE7]">{reviewedDecisions.length}/8 reviewed interventions. Response estimates remain hidden until the minimum sample threshold is met.</Text>}</View></View>

    <View className="gap-5 lg:flex-row"><View className="flex-1 bg-paper p-5"><SectionTitle icon={Video} eyebrow="Latest analyzed clip" title="Time-coded review" /><Text className="font-sans text-xs text-muted">Private local analysis metadata only. Signed uploads, transcoding, malware scanning, and voice tracks require the production media service.</Text><View className="mt-3 flex-row gap-2"><TextInput className="min-h-11 w-20 border border-fog bg-canvas px-3 font-sans text-ink" value={timestamp} onChangeText={setTimestamp} keyboardType="decimal-pad" placeholder="Sec" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={annotation} onChangeText={setAnnotation} placeholder="Timestamped coaching note" placeholderTextColor="#8996AC" /></View><Pressable className="mt-3 min-h-10 flex-row items-center justify-center gap-2 border border-ink" onPress={() => void addVideoNote()}><MessageSquare size={15} color="#17212B" /><Text className="font-heading uppercase text-ink">Pin note</Text></Pressable></View>
      <View className="flex-1 bg-paper p-5"><SectionTitle icon={Users} eyebrow="Previewed group jobs" title="Team programming" /><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-sans text-ink" value={groupName} onChangeText={setGroupName} placeholder="Group name" placeholderTextColor="#8996AC" /><View className="mt-3 flex-row flex-wrap gap-2">{roster.map((profile) => { const selected = groupAthleteIds.includes(profile.id); return <Pressable key={profile.id} className={`border px-3 py-2 ${selected ? "border-moss bg-moss" : "border-fog"}`} onPress={() => setGroupAthleteIds((current) => selected ? current.filter((id) => id !== profile.id) : [...current, profile.id])}><Text className={`font-sans text-xs font-bold ${selected ? "text-white" : "text-ink"}`}>{profile.displayName}</Text></Pressable>; })}</View><Pressable className="mt-3 min-h-10 items-center justify-center border border-ink" onPress={() => void saveGroup()}><Text className="font-heading uppercase text-ink">Save group</Text></Pressable><View className="mt-4 flex-row flex-wrap gap-2">{coachGroups.map((group) => <Pressable key={group.id} className={`border px-3 py-2 ${selectedGroup?.id === group.id ? "border-ink bg-ink" : "border-fog"}`} onPress={() => setSelectedGroupId(group.id)}><Text className={`font-sans text-xs font-bold ${selectedGroup?.id === group.id ? "text-white" : "text-ink"}`}>{group.name} · {group.athleteIds.length}</Text></Pressable>)}</View>{selectedGroup ? <View className="mt-4 border-t border-fog pt-4"><Text className="font-mono text-[10px] uppercase text-muted">Bulk assignment preview</Text><View className="mt-2 flex-row flex-wrap gap-2">{coachTemplates.map((template) => <Pressable key={template.id} className={`border px-2 py-1 ${selectedBulkTemplate?.id === template.id ? "border-signal bg-signal" : "border-fog"}`} onPress={() => setBulkTemplateId(template.id)}><Text className={`font-mono text-[10px] uppercase ${selectedBulkTemplate?.id === template.id ? "text-white" : "text-muted"}`}>{template.name}</Text></Pressable>)}</View><TextInput className="mt-2 min-h-10 border border-fog bg-canvas px-3 font-sans text-ink" value={bulkStartDate} onChangeText={setBulkStartDate} placeholder="Start YYYY-MM-DD" placeholderTextColor="#8996AC" /><Text className="mt-2 font-sans text-xs text-muted">{selectedBulkTemplate?.name ?? "Select a template"} → {selectedGroup.athleteIds.length} athlete{selectedGroup.athleteIds.length === 1 ? "" : "s"}. Each receives an independent live program.</Text><Pressable className="mt-3 min-h-10 items-center justify-center bg-ink disabled:opacity-40" disabled={!selectedBulkTemplate} onPress={() => void assignGroupTemplate()}><Text className="font-heading uppercase text-white">Run assignment</Text></Pressable></View> : null}</View></View>

    <View className="bg-paper p-5"><SectionTitle icon={BookOpen} eyebrow="Reusable coach catalog" title="Exercise library" /><View className="flex-row flex-wrap gap-2">{(["squat", "bench", "deadlift", "accessory"] as const).map((category) => <Pressable key={category} className={`border px-3 py-2 ${exerciseDraft.category === category ? "border-signal bg-signal" : "border-fog"}`} onPress={() => setExerciseDraft((draft) => ({ ...draft, category }))}><Text className={`font-heading uppercase ${exerciseDraft.category === category ? "text-white" : "text-ink"}`}>{category}</Text></Pressable>)}</View><View className="mt-3 flex-row flex-wrap gap-2"><TextInput className="min-h-11 min-w-48 flex-[2] border border-fog bg-canvas px-3 font-sans text-ink" value={exerciseDraft.name} onChangeText={(name) => setExerciseDraft((draft) => ({ ...draft, name }))} placeholder="Exercise name" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 min-w-20 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={exerciseDraft.sets} onChangeText={(sets) => setExerciseDraft((draft) => ({ ...draft, sets }))} keyboardType="number-pad" placeholder="Sets" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 min-w-20 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={exerciseDraft.repetitions} onChangeText={(repetitions) => setExerciseDraft((draft) => ({ ...draft, repetitions }))} keyboardType="number-pad" placeholder="Reps" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 min-w-20 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={exerciseDraft.prescriptionValue} onChangeText={(prescriptionValue) => setExerciseDraft((draft) => ({ ...draft, prescriptionValue }))} keyboardType="decimal-pad" placeholder="Target" placeholderTextColor="#8996AC" /></View><View className="mt-3 flex-row flex-wrap gap-2">{(["rpe", "rir", "percent", "exact"] as const).map((mode) => <Pressable key={mode} className={`border px-3 py-2 ${exerciseDraft.prescriptionMode === mode ? "border-ink bg-ink" : "border-fog"}`} onPress={() => setExerciseDraft((draft) => ({ ...draft, prescriptionMode: mode }))}><Text className={`font-mono text-[10px] uppercase ${exerciseDraft.prescriptionMode === mode ? "text-white" : "text-muted"}`}>{mode}</Text></Pressable>)}{(["kg", "lb"] as const).map((unit) => <Pressable key={unit} className={`border px-3 py-2 ${exerciseDraft.weightUnit === unit ? "border-moss bg-moss" : "border-fog"}`} onPress={() => setExerciseDraft((draft) => ({ ...draft, weightUnit: unit }))}><Text className={`font-mono text-[10px] uppercase ${exerciseDraft.weightUnit === unit ? "text-white" : "text-muted"}`}>{unit}</Text></Pressable>)}</View><View className="mt-3 flex-row flex-wrap gap-2"><TextInput className="min-h-11 min-w-48 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={exerciseDraft.tags} onChangeText={(tags) => setExerciseDraft((draft) => ({ ...draft, tags }))} placeholder="Tags, comma separated" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 min-w-48 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={exerciseDraft.notes} onChangeText={(notes) => setExerciseDraft((draft) => ({ ...draft, notes }))} placeholder="Coaching notes" placeholderTextColor="#8996AC" /><Pressable className="min-h-11 items-center justify-center bg-ink px-5" onPress={() => void saveLibraryExercise()}><Text className="font-heading uppercase text-white">Save exercise</Text></Pressable></View><View className="mt-5 gap-2">{performance.exerciseLibrary.filter((item) => item.coachId === currentProfile?.id).map((item) => <View key={item.id} className="flex-row flex-wrap items-center justify-between gap-3 border-t border-fog py-3"><View className="flex-1"><Text className="font-sans text-sm font-bold text-ink">{item.name}</Text><Text className="mt-1 font-mono text-[10px] text-muted">{item.category} · {item.sets}×{item.repetitions} @ {item.prescriptionValue} {item.prescriptionMode} · {item.tags.join(", ") || "no tags"}</Text></View><Pressable className="border border-moss px-3 py-2" onPress={() => void addLibraryExercise(item)}><Text className="font-heading uppercase text-moss">Add next</Text></Pressable></View>)}{!performance.exerciseLibrary.some((item) => item.coachId === currentProfile?.id) ? <Text className="font-sans text-sm text-muted">Save an exercise to reuse its prescription and coaching context.</Text> : null}</View></View>
  </ScrollView></AppShell>;
}