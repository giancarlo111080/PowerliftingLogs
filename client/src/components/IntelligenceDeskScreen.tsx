import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AlertTriangle, BookOpen, Check, Clock3, GitCompare, MessageSquare, ShieldAlert, Users, Video, X } from "lucide-react-native";
import { Redirect } from "expo-router";

import { useSession } from "../auth/AuthSessionContext";
import { calculateRecoveryReadiness, generateAdaptiveRecommendations, type AdaptiveRecommendation } from "../data/adaptiveEngine";
import { getProgramAnalytics } from "../data/programAnalytics";
import { usePerformanceStore } from "../data/performanceStore";
import { useProgramWorkspaceStore, type TrainingProgram } from "../data/programWorkspaceStore";
import { AppShell } from "./AppShell";

function SectionTitle({ icon: Icon, eyebrow, title, count }: { icon: typeof AlertTriangle; eyebrow: string; title: string; count?: number }) {
  return <View className="mb-4 flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center bg-ink"><Icon size={19} color="#FF565E" /></View><View className="flex-1"><Text className="font-mono text-[10px] uppercase text-muted">{eyebrow}</Text><Text className="font-heading text-xl uppercase text-ink">{title}</Text></View>{count !== undefined ? <View className="min-w-8 items-center bg-signal px-2 py-1"><Text className="font-mono text-xs text-white">{count}</Text></View> : null}</View>;
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
  const [message, setMessage] = useState<string | null>(null);

  if (session && session.role !== "COACH") return <Redirect href="/dashboard" />;
  const readiness = calculateRecoveryReadiness(latestRecovery);
  const exceptions = [
    ...(latestRecovery?.pain && latestRecovery.pain >= 4 ? [{ severity: 3, title: `Pain ${latestRecovery.pain}/10`, detail: "Human review required; no automatic loading advice." }] : []),
    ...(readiness <= 60 ? [{ severity: 2, title: `Readiness ${readiness}/100`, detail: "Below the deterministic review threshold." }] : []),
    ...(analytics.skippedSets ? [{ severity: 2, title: `${analytics.skippedSets} skipped sets`, detail: "Review adherence and outcome reason." }] : []),
    ...workspace.comments.filter((item) => item.programId === program?.id).slice(-3).map((item) => ({ severity: 1, title: "New training comment", detail: item.body })),
    ...analyses.slice(-3).map((item) => ({ severity: item!.confidence === "high" ? 2 : 1, title: `New ${item!.liftType ?? "lift"} video`, detail: `${item!.confidence} confidence · ${item!.cameraView} view` }))
  ].sort((a, b) => b.severity - a.severity);

  async function applyRecommendation(item: AdaptiveRecommendation) {
    if (!program || !currentProfile) return;
    const existing = performance.versions.filter((version) => version.programId === program.id);
    if (!existing.length) await performance.recordVersion({ programId: program.id, athleteId, coachId: currentProfile.id, reason: "Baseline before adaptive decision", snapshot: program });
    const next = changedProgram(program, item);
    if (item.action === "begin-deload") {
      for (const week of next.weeks) for (const day of week.days) for (const exercise of day.exercises) await workspace.updateExercise(next.id, week.id, day.id, exercise);
    }
    else if (item.patch?.scheduledDate && item.weekId && item.dayId) await workspace.rescheduleDay(program.id, item.weekId, item.dayId, item.patch.scheduledDate, "coach");
    else if (item.exerciseId && item.weekId && item.dayId) {
      const exercise = next.weeks.find((week) => week.id === item.weekId)?.days.find((day) => day.id === item.dayId)?.exercises.find((candidate) => candidate.id === item.exerciseId);
      if (exercise) await workspace.updateExercise(program.id, item.weekId, item.dayId, exercise);
    }
    if (item.patch || item.action === "begin-deload") await performance.recordVersion({ programId: program.id, athleteId, coachId: currentProfile.id, reason: `Approved: ${item.title}`, snapshot: next });
    await performance.recordDecision({ coachId: currentProfile.id, athleteId, programId: program.id, recommendationId: item.id, action: item.action, status: "approved", reason: reason.trim() || "Accepted engine evidence", before: item.before, after: item.after, expectedOutcome: item.rationale });
    setReason("");
    setMessage(`${item.title} approved and recorded${item.patch || item.action === "begin-deload" ? " as a new program version" : ""}.`);
  }

  async function rejectRecommendation(item: AdaptiveRecommendation) {
    if (!currentProfile || !reason.trim()) {
      setMessage("Enter a reason before rejecting a recommendation.");
      return;
    }
    await performance.recordDecision({ coachId: currentProfile.id, athleteId, programId: program?.id, recommendationId: item.id, action: item.action, status: "rejected", reason: reason.trim(), before: item.before, after: item.after, expectedOutcome: item.rationale });
    setReason("");
    setMessage(`${item.title} rejected with rationale retained.`);
  }

  async function addJournalEntry() {
    if (!currentProfile || !journalNotes.trim()) return setMessage("Add decision notes before saving the journal entry.");
    await performance.recordDecision({ coachId: currentProfile.id, athleteId, programId: program?.id, action: journalReason, status: "journal", reason: journalNotes.trim(), expectedOutcome: `${expectedOutcome.trim() || "Not specified"}${reviewDate ? ` · review ${reviewDate}` : ""}` });
    setJournalNotes(""); setExpectedOutcome(""); setMessage("Decision journal entry saved.");
  }

  async function addVideoNote() {
    if (!currentProfile || !analyses.length || !annotation.trim()) return setMessage("Select analyzed footage and enter a review note.");
    const analysis = analyses.at(-1)!;
    await performance.addAnnotation({ athleteId, coachId: currentProfile.id, analysisKey: `${analysis.sourceFileName}:${analysis.analyzedAt}`, timestampSeconds: Math.max(0, Number(timestamp) || 0), body: annotation.trim() });
    setAnnotation(""); setMessage("Timestamped video note saved.");
  }

  async function saveGroup() {
    if (!currentProfile || !groupName.trim() || !athleteId) return setMessage("Name the group and select an athlete first.");
    await performance.saveGroup({ coachId: currentProfile.id, name: groupName.trim(), athleteIds: [athleteId] });
    setGroupName(""); setMessage("Athlete group saved.");
  }

  return <AppShell title="Intelligence Desk"><ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-8 px-4 py-6 pb-16">
    <View className="border-l-4 border-signal pl-4"><Text className="font-mono text-xs uppercase text-moss">Coach control plane</Text><Text className="mt-1 font-heading text-3xl uppercase text-ink">{activeAthlete?.displayName ?? "Select an athlete"}</Text><Text className="mt-2 font-sans text-sm text-muted">Exceptions first. Recommendations explain their evidence. Only your approval changes training.</Text></View>
    {message ? <View className="border border-moss bg-paper p-3"><Text className="font-sans text-sm text-ink">{message}</Text></View> : null}

    <View className="gap-5 lg:flex-row"><View className="flex-1 bg-paper p-5"><SectionTitle icon={ShieldAlert} eyebrow="Ranked and deduplicated" title="Exception desk" count={exceptions.length} />{exceptions.length ? exceptions.map((item, index) => <View key={`${item.title}-${index}`} className="flex-row gap-3 border-t border-fog py-3"><AlertTriangle size={17} color={item.severity >= 3 ? "#FF3B45" : "#FF565E"} /><View className="flex-1"><Text className="font-sans text-sm font-bold text-ink">{item.title}</Text><Text className="mt-1 font-sans text-xs leading-5 text-muted">{item.detail}</Text></View></View>) : <Text className="font-sans text-sm text-muted">No readiness, adherence, pain, video, or comment exceptions require review.</Text>}</View>
      <View className="flex-1 bg-ink p-5"><Text className="font-mono text-xs uppercase text-[#ABB5C8]">Current response snapshot</Text><Text className="mt-4 font-heading text-5xl text-white">{readiness}<Text className="text-lg"> readiness</Text></Text><View className="mt-5 border-t border-[#52607A] pt-4"><Text className="font-sans text-sm text-white">Adherence {analytics.adherencePercent}% · fatigue {analytics.currentFatigueScore}/100</Text><Text className="mt-2 font-sans text-xs leading-5 text-[#ABB5C8]">{recovery.length < 8 ? `Insufficient history for personalized response estimates (${recovery.length}/8 check-ins). Deterministic rules remain authoritative.` : "Recovery sample threshold met. Patterns are correlations and require coach confirmation."}</Text></View></View></View>

    <View className="bg-paper p-5"><SectionTitle icon={GitCompare} eyebrow="Rules v1 · coach approval required" title="Adaptive recommendations" count={recommendations.length} /><TextInput className="mb-4 min-h-11 border border-fog bg-canvas px-3 font-sans text-ink" value={reason} onChangeText={setReason} placeholder="Decision reason (required for rejection)" placeholderTextColor="#8996AC" />{recommendations.length ? recommendations.map((item) => <View key={item.id} className="border-t border-fog py-4"><View className="flex-row flex-wrap items-start justify-between gap-2"><View className="flex-1"><Text className="font-heading text-lg uppercase text-ink">{item.title}</Text><Text className="mt-1 font-sans text-sm leading-5 text-muted">{item.rationale}</Text></View><Text className="font-mono text-xs uppercase text-moss">{item.confidence}</Text></View><View className="mt-3 bg-canvas p-3"><Text className="font-mono text-xs text-muted">{item.before} → {item.after}</Text>{item.evidence.map((evidence) => <Text key={evidence} className="mt-1 font-sans text-xs text-ink">• {evidence}</Text>)}</View><View className="mt-3 flex-row gap-2"><Pressable className="min-h-10 flex-1 flex-row items-center justify-center gap-2 bg-moss" onPress={() => void applyRecommendation(item)}><Check size={15} color="#FFFFFF" /><Text className="font-heading uppercase text-white">Approve</Text></Pressable><Pressable className="min-h-10 flex-1 flex-row items-center justify-center gap-2 border border-signal" onPress={() => void rejectRecommendation(item)}><X size={15} color="#FF3B45" /><Text className="font-heading uppercase text-signal">Reject</Text></Pressable></View></View>) : <Text className="font-sans text-sm text-muted">No pending recommendation meets the bounded rule thresholds.</Text>}</View>

    <View className="gap-5 lg:flex-row"><View className="flex-1 bg-paper p-5"><SectionTitle icon={Clock3} eyebrow="Immutable local snapshots" title="Program versions" count={versions.length} />{versions.slice(0, 6).map((version) => <View key={version.id} className="border-t border-fog py-3"><View className="flex-row justify-between"><Text className="font-heading uppercase text-ink">Version {version.version}</Text><Text className="font-mono text-[10px] text-muted">{new Date(version.createdAt).toLocaleString()}</Text></View><Text className="mt-1 font-sans text-xs text-muted">{version.reason}</Text></View>)}{!versions.length ? <Text className="font-sans text-sm text-muted">The first approved mutation captures a baseline and an attributable next version.</Text> : null}</View>
      <View className="flex-1 bg-paper p-5"><SectionTitle icon={BookOpen} eyebrow="Intervention memory" title="Decision journal" count={decisions.length} /><View className="flex-row flex-wrap gap-2">{["fatigue-management", "technique", "schedule", "pain-review", "meet-strategy"].map((code) => <Pressable key={code} className={`border px-2 py-1 ${journalReason === code ? "border-ink bg-ink" : "border-fog"}`} onPress={() => setJournalReason(code)}><Text className={`font-mono text-[10px] ${journalReason === code ? "text-white" : "text-muted"}`}>{code}</Text></Pressable>)}</View><TextInput className="mt-3 min-h-20 border border-fog bg-canvas p-3 font-sans text-ink" multiline value={journalNotes} onChangeText={setJournalNotes} placeholder="Decision, evidence, and alternatives considered" placeholderTextColor="#8996AC" /><View className="mt-2 flex-row gap-2"><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={expectedOutcome} onChangeText={setExpectedOutcome} placeholder="Expected outcome" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 w-32 border border-fog bg-canvas px-3 font-sans text-ink" value={reviewDate} onChangeText={setReviewDate} placeholder="Review date" placeholderTextColor="#8996AC" /></View><Pressable className="mt-3 min-h-10 items-center justify-center bg-ink" onPress={() => void addJournalEntry()}><Text className="font-heading uppercase text-white">Record decision</Text></Pressable></View></View>

    <View className="gap-5 lg:flex-row"><View className="flex-1 bg-paper p-5"><SectionTitle icon={Video} eyebrow="Latest analyzed clip" title="Time-coded review" /><Text className="font-sans text-xs text-muted">Private local analysis metadata only. Signed uploads, transcoding, malware scanning, and voice tracks require the production media service.</Text><View className="mt-3 flex-row gap-2"><TextInput className="min-h-11 w-20 border border-fog bg-canvas px-3 font-sans text-ink" value={timestamp} onChangeText={setTimestamp} keyboardType="decimal-pad" placeholder="Sec" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={annotation} onChangeText={setAnnotation} placeholder="Timestamped coaching note" placeholderTextColor="#8996AC" /></View><Pressable className="mt-3 min-h-10 flex-row items-center justify-center gap-2 border border-ink" onPress={() => void addVideoNote()}><MessageSquare size={15} color="#17212B" /><Text className="font-heading uppercase text-ink">Pin note</Text></Pressable></View>
      <View className="flex-1 bg-paper p-5"><SectionTitle icon={Users} eyebrow="Tenant-scoped local groups" title="Team programming" /><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-sans text-ink" value={groupName} onChangeText={setGroupName} placeholder="Group name" placeholderTextColor="#8996AC" /><Pressable className="mt-3 min-h-10 items-center justify-center bg-ink" onPress={() => void saveGroup()}><Text className="font-heading uppercase text-white">Add selected athlete</Text></Pressable>{performance.groups.filter((group) => group.coachId === currentProfile?.id).map((group) => <View key={group.id} className="mt-3 flex-row justify-between border-t border-fog pt-3"><Text className="font-sans text-sm font-bold text-ink">{group.name}</Text><Text className="font-mono text-xs text-muted">{group.athleteIds.length} athlete{group.athleteIds.length === 1 ? "" : "s"}</Text></View>)}<Text className="mt-4 font-sans text-xs text-muted">Roster available: {profiles.filter((profile) => profile.role === "ATHLETE").length}. Bulk template assignment remains in Programs with an individual preview.</Text></View></View>
  </ScrollView></AppShell>;
}