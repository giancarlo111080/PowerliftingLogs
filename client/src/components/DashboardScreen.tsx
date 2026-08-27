import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Activity, ArrowRight, CheckCircle2, ChevronRight, CircleAlert, ClipboardCheck, ClipboardList, Dumbbell, Instagram, Link2, Play, Save, Send, Trophy, Users } from "lucide-react-native";
import { router } from "expo-router";

import { useSession } from "../auth/AuthSessionContext";
import { formatTonnage, getCoachInsights, getCoachReviewItems } from "../data/dashboardData";
import { getProgramAnalytics } from "../data/programAnalytics";
import { useProgramWorkspaceStore } from "../data/programWorkspaceStore";
import { createAthleteInvitation } from "../lib/platformApi";
import { AppShell } from "./AppShell";

function ProgressBar({ value, color = "#2E6F5E" }: { value: number; color?: string }) {
  return (
    <View className="h-2 overflow-hidden rounded-sm bg-fog">
      <View className="h-2 rounded-sm" style={{ backgroundColor: color, width: `${Math.max(0, Math.min(value, 100))}%` }} />
    </View>
  );
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="mb-3 flex-row items-end justify-between">
      <View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{eyebrow}</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">{title}</Text></View>
      {action ? <Pressable className="flex-row items-center gap-1 py-1" onPress={action.onPress}><Text className="font-serif text-sm font-bold text-signal">{action.label}</Text><ChevronRight size={16} color="#D74F32" /></Pressable> : null}
    </View>
  );
}

function Metric({ label, value, detail, accent = "#2E6F5E" }: { label: string; value: string; detail: string; accent?: string }) {
  return (
    <View className="min-h-28 flex-1 border border-fog bg-paper p-4">
      <Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">{label}</Text>
      <Text className="mt-3 font-serif text-3xl font-bold" style={{ color: accent }}>{value}</Text>
      <Text className="mt-1 font-serif text-xs text-[#52675F]">{detail}</Text>
    </View>
  );
}

function LifterDashboard() {
  const { currentProfile } = useSession();
  const { programs, dayLogs, isLoading } = useProgramWorkspaceStore();
  const athletePrograms = programs.filter((program) => program.athleteId === currentProfile?.id).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const activeProgram = athletePrograms.find((program) => program.status === "active") ?? athletePrograms[0] ?? null;

  if (isLoading || !currentProfile) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#2E6F5E" /><Text className="mt-3 font-serif text-sm text-[#52675F]">Preparing dashboard</Text></View>;
  }

  const analytics = getProgramAnalytics(activeProgram, dayLogs);
  const programDays = activeProgram?.weeks.flatMap((week) => week.days).sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate)) ?? [];
  const dayLogById = new Map(dayLogs.filter((dayLog) => dayLog.programId === activeProgram?.id).map((dayLog) => [dayLog.dayId, dayLog]));
  const nextDay = programDays.find((day) => {
    const plannedSets = day.exercises.reduce((total, exercise) => total + exercise.sets, 0);
    const handledSets = dayLogById.get(day.id)?.sets.filter((set) => set.completionStatus !== "pending").length ?? 0;
    return handledSets < plannedSets;
  }) ?? programDays.at(-1);
  const exerciseById = new Map(programDays.flatMap((day) => day.exercises).map((exercise) => [exercise.id, exercise]));
  const linkedSet = dayLogs.filter((dayLog) => dayLog.programId === activeProgram?.id)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .flatMap((dayLog) => dayLog.sets)
    .find((set) => set.instagramVideoUrl || set.videoAnalysis);
  const linkedExercise = linkedSet ? exerciseById.get(linkedSet.exerciseId) : null;
  const milestones = analytics.completedSets ? [
    { code: "logged-sets", title: `${analytics.completedSets} sets logged`, detail: `${formatTonnage(analytics.completedTonnageKg)} completed in ${activeProgram?.name ?? "the current program"}` }
  ] : [];
  if (analytics.plannedSets > 0 && analytics.remainingSets === 0) {
    milestones.push({ code: "program-complete", title: "Program complete", detail: "Every prescribed set has been handled" });
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
      <View className="border-l-4 border-signal pl-4">
        <Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{activeProgram ? `${activeProgram.phase} program` : "Training workspace"}</Text>
        <Text className="mt-2 font-serif text-3xl font-bold text-ink">Train with the day you have.</Text>
        <Text className="mt-2 font-serif text-base text-[#52675F]">{currentProfile.upcomingMeet ?? "No meet scheduled"} · {nextDay?.focus ?? "No workout scheduled"}</Text>
      </View>

      <View className="flex-col gap-3 sm:flex-row">
        <Metric label="Readiness estimate" value={`${analytics.currentReadinessScore}`} detail={`Fatigue estimate ${analytics.currentFatigueScore} / 100`} />
        <Metric label="Program adherence" value={`${analytics.adherencePercent}%`} detail={`${analytics.completedSets} of ${analytics.plannedSets} prescribed sets`} accent="#D74F32" />
        <Metric label="Completed volume" value={formatTonnage(analytics.completedTonnageKg)} detail={`${analytics.remainingSets} sets remaining`} accent="#17212B" />
      </View>

      <View className="border border-fog bg-paper p-5">
        <View className="flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <View className="flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{activeProgram?.name ?? "Planned training"}</Text><Text className="mt-1 font-serif text-2xl font-bold text-ink">{nextDay?.name ?? "No active workout"}</Text><Text className="mt-1 font-serif text-sm text-[#52675F]">{nextDay ? `${nextDay.exercises.length} exercises · ${nextDay.scheduledDate}` : "Your coach has not scheduled a training day yet."}</Text></View>
          <Pressable className="min-h-12 flex-row items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 active:opacity-80" onPress={() => router.push("/training")} accessibilityLabel="Open training log">
            <Dumbbell size={18} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Open training log</Text><ArrowRight size={16} color="#FFFFFF" />
          </Pressable>
        </View>
        <View className="mt-5"><View className="mb-2 flex-row justify-between"><Text className="font-serif text-sm font-bold text-ink">Program set completion</Text><Text className="font-serif text-sm text-[#52675F]">{analytics.completedSets} done · {analytics.skippedSets} skipped</Text></View><ProgressBar value={analytics.adherencePercent} /></View>
      </View>

      <View>
        <SectionHeading eyebrow="Main lift baselines" title="Current 1RM" />
        <View className="flex-col gap-3 sm:flex-row">
          <Metric label="Squat" value={currentProfile.squatOneRepMaxKg ? `${currentProfile.squatOneRepMaxKg} kg` : "Not set"} detail="Competition baseline" />
          <Metric label="Bench press" value={currentProfile.benchOneRepMaxKg ? `${currentProfile.benchOneRepMaxKg} kg` : "Not set"} detail="Competition baseline" accent="#D74F32" />
          <Metric label="Deadlift" value={currentProfile.deadliftOneRepMaxKg ? `${currentProfile.deadliftOneRepMaxKg} kg` : "Not set"} detail="Competition baseline" accent="#17212B" />
        </View>
      </View>

      <View className="flex-col gap-5 lg:flex-row">
        <View className="flex-1">
          <SectionHeading eyebrow="Consistency" title="Recent achievements" />
          <View className="border border-fog bg-paper">
            {milestones.length ? milestones.map((achievement, index) => <View key={achievement.code} className={`flex-row items-center gap-3 px-4 py-4 ${index ? "border-t border-fog" : ""}`}><View className="h-9 w-9 items-center justify-center rounded-md bg-[#E9C46A33]"><Trophy size={17} color="#A36F05" /></View><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{achievement.title}</Text><Text className="mt-0.5 font-serif text-xs text-[#52675F]">{achievement.detail}</Text></View></View>) : <View className="px-4 py-6"><Text className="font-serif text-sm font-bold text-ink">No achievements yet</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">Complete your first prescribed set to begin your progress record.</Text></View>}
          </View>
        </View>
        <View className="flex-1">
          <SectionHeading eyebrow="Video review" title="Top-set footage" />
          <View className="border border-fog bg-paper p-4">
            {linkedSet ? <><View className="flex-row items-start gap-3"><View className="h-10 w-10 items-center justify-center rounded-md bg-[#D74F321A]"><Instagram size={20} color="#D74F32" /></View><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{linkedExercise?.name ?? "Competition lift"} · set {linkedSet.setNumber}</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">{linkedSet.videoAnalysis ? `${linkedSet.videoAnalysis.estimatedRepetitions} reps detected · ${linkedSet.videoAnalysis.confidence} confidence` : "Ready for coach review"}</Text></View></View>{linkedSet.instagramVideoUrl ? <Pressable className="mt-4 min-h-10 flex-row items-center justify-center gap-2 rounded-md border border-signal px-3 py-2" onPress={() => Linking.openURL(linkedSet.instagramVideoUrl!)} accessibilityLabel="Open Instagram video"><Play size={16} color="#D74F32" /><Text className="font-serif text-sm font-bold text-signal">Open Instagram</Text></Pressable> : null}</> : <View className="items-start"><Text className="font-serif text-sm font-bold text-ink">No top-set video linked</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">Analyze a competition lift or add an Instagram reel from the training log.</Text></View>}
          </View>
        </View>
      </View>

      <View className="flex-row items-center border border-fog bg-paper p-4">
        <View className="h-10 w-10 items-center justify-center rounded-md bg-[#2E6F5E1A]"><Save size={18} color="#2E6F5E" /></View>
        <View className="ml-3 flex-1"><Text className="font-serif text-sm font-bold text-ink">Training changes saved on this device</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">Program logs remain available when this device is offline.</Text></View>
        <CheckCircle2 size={21} color="#2E6F5E" />
      </View>
    </ScrollView>
  );
}

function CoachDashboard() {
  const { session, profiles, activeAthlete, selectAthlete } = useSession();
  const { programs, dayLogs, comments } = useProgramWorkspaceStore();
  const [completedReviewIds, setCompletedReviewIds] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const athletes = profiles.filter((profile) => profile.role === "ATHLETE");
  const insights = getCoachInsights(profiles, programs, dayLogs);
  const reviewItems = getCoachReviewItems(profiles, programs, dayLogs, comments);
  const selectedInsight = insights.find((insight) => insight.athleteId === activeAthlete?.id);
  const pendingReviews = reviewItems.filter((item) => !completedReviewIds.includes(item.id));
  const attentionItems = insights.filter((insight) => insight.attention !== "On track");
  const programById = new Map(programs.map((program) => [program.id, program]));
  const activeSince = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activeThisWeek = new Set(dayLogs.filter((dayLog) => new Date(dayLog.updatedAt).getTime() >= activeSince).map((dayLog) => programById.get(dayLog.programId)?.athleteId).filter((athleteId): athleteId is string => Boolean(athleteId))).size;
  const completedReviewCount = reviewItems.length - pendingReviews.length;
  const attentionHeading = attentionItems.length ? `${attentionItems.length} athlete${attentionItems.length === 1 ? " needs" : "s need"} attention.` : "Your coaching desk is clear.";

  async function sendInvite() {
    if (!session || !inviteEmail.trim()) {
      setInviteMessage("Enter an athlete email address.");
      return;
    }
    try {
      const invitation = await createAthleteInvitation(session.accessToken, inviteEmail.trim());
      setInviteEmail("");
      setInviteLink(invitation.registrationUrl);
      setInviteMessage(`Invitation sent. It expires ${new Date(invitation.expiresAt).toLocaleString()}.`);
    }
    catch (reason) {
      setInviteLink(null);
      setInviteMessage(reason instanceof Error ? reason.message : "Could not send the athlete invitation.");
    }
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
      <View className="flex-col justify-between gap-4 border-l-4 border-signal pl-4 sm:flex-row sm:items-end">
        <View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Coaching desk</Text><Text className="mt-2 font-serif text-3xl font-bold text-ink">{attentionHeading}</Text><Text className="mt-2 font-serif text-base text-[#52675F]">Review readiness, training progress, and new footage before the next session.</Text></View>
        <View className="flex-row gap-2"><Pressable className="h-10 w-10 items-center justify-center rounded-md border border-fog bg-paper" onPress={() => router.push("/programs")} accessibilityLabel="Open athlete programs"><ClipboardList size={18} color="#17212B" /></Pressable><Pressable className="h-10 w-10 items-center justify-center rounded-md bg-ink" onPress={() => router.push("/program-review")} accessibilityLabel="Open program review"><ClipboardCheck size={18} color="#FFFFFF" /></Pressable></View>
      </View>

      <View className="flex-col gap-3 sm:flex-row">
        <Metric label="Assigned athletes" value={`${athletes.length}`} detail={`${activeThisWeek} active this week`} />
        <Metric label="Attention queue" value={`${attentionItems.length}`} detail="Readiness, video, and pending work" accent="#D74F32" />
        <Metric label="Reviews complete" value={`${completedReviewCount}/${reviewItems.length}`} detail="Current review queue" accent="#17212B" />
      </View>

      <View className="border border-zinc bg-zinc/10 p-5"><View className="flex-row items-center gap-3"><Send size={20} color="#CCFF00" /><View><Text className="font-heading text-lg uppercase text-ink">Generate athlete invite</Text><Text className="mt-1 font-sans text-sm text-muted">Iron Forge emails a secure registration link that expires after 48 hours.</Text></View></View><View className="mt-4 flex-col gap-3 sm:flex-row"><TextInput className="min-h-12 flex-1 border border-fog bg-canvas px-3 font-sans text-base text-ink" value={inviteEmail} onChangeText={setInviteEmail} placeholder="athlete@email.com" placeholderTextColor="#9B9B95" keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Athlete email address" /><Pressable className="min-h-12 flex-row items-center justify-center gap-2 bg-signal px-4 py-3" onPress={() => void sendInvite()}><Send size={17} color="#F4F4ED" /><Text className="font-heading text-sm uppercase text-white">Send invite</Text></Pressable></View>{inviteMessage ? <Text className="mt-3 font-sans text-sm text-ink">{inviteMessage}</Text> : null}{inviteLink ? <View className="mt-3 flex-row items-center gap-2 border border-fog bg-canvas p-3"><Link2 size={16} color="#CCFF00" /><Text selectable className="flex-1 font-mono text-xs text-muted">{inviteLink}</Text></View> : null}</View>

      <View className="flex-col gap-5 lg:flex-row">
        <View className="flex-[1.35]">
          <SectionHeading eyebrow="Roster" title="Training status" action={{ label: "All athletes", onPress: () => router.push("/athletes") }} />
          <View className="border border-fog bg-paper">
            {athletes.length ? athletes.map((athlete, index) => {
              const insight = insights.find((candidate) => candidate.athleteId === athlete.id);
              return <Pressable key={athlete.id} className={`flex-col gap-3 px-4 py-4 active:bg-canvas sm:flex-row sm:items-center ${index ? "border-t border-fog" : ""}`} onPress={() => void selectAthlete(athlete.id)} accessibilityLabel={`Select ${athlete.displayName} for review`}><View className="flex-row items-center gap-3 sm:w-48"><View className="h-9 w-9 items-center justify-center rounded-md bg-moss"><Text className="font-serif text-xs font-bold text-white">{athlete.initials}</Text></View><View><Text className="font-serif text-sm font-bold text-ink">{athlete.displayName}</Text><Text className="font-serif text-xs text-[#52675F]">{insight?.activeProgramName ?? "No active program"}</Text></View></View><View className="flex-row flex-1 justify-between gap-3"><View><Text className="font-serif text-xs text-[#688078]">Readiness</Text><Text className="font-serif text-sm font-bold text-ink">{insight?.readiness ?? "-"}</Text></View><View><Text className="font-serif text-xs text-[#688078]">Adherence</Text><Text className="font-serif text-sm font-bold text-ink">{insight?.adherencePercent === null || insight?.adherencePercent === undefined ? "-" : `${insight.adherencePercent}%`}</Text></View><View><Text className="font-serif text-xs text-[#688078]">Last session</Text><Text className="font-serif text-sm font-bold text-ink">{insight?.lastSession ?? "Not started"}</Text></View></View><Text className={`font-serif text-xs font-bold ${insight?.attention === "On track" ? "text-moss" : "text-signal"}`}>{insight?.attention ?? "No active program"}</Text></Pressable>;
            }) : <View className="px-4 py-8"><Text className="font-serif text-sm font-bold text-ink">No athletes assigned</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">Send an invitation to connect your first athlete.</Text></View>}
          </View>
        </View>

        <View className="flex-1">
          <SectionHeading eyebrow="Selected athlete" title={activeAthlete?.displayName ?? "Athlete"} />
          <View className="border border-fog bg-paper p-4">
            {activeAthlete ? <><View className="flex-row items-center gap-3"><View className="h-11 w-11 items-center justify-center rounded-md bg-ink"><Text className="font-serif text-sm font-bold text-white">{activeAthlete.initials}</Text></View><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{activeAthlete.competitionWeightClass ?? "Unspecified"} class</Text><Text className="font-serif text-xs text-[#52675F]">{activeAthlete.upcomingMeet ?? "No meet scheduled"}</Text></View></View><View className="mt-5 flex-row justify-between border-y border-fog py-4"><View><Text className="font-serif text-xs text-[#688078]">Readiness</Text><Text className="mt-1 font-serif text-2xl font-bold text-moss">{selectedInsight?.readiness ?? "-"}</Text></View><View><Text className="font-serif text-xs text-[#688078]">Volume</Text><Text className="mt-1 font-serif text-2xl font-bold text-ink">{selectedInsight ? formatTonnage(selectedInsight.completedTonnageKg) : "-"}</Text></View><View><Text className="font-serif text-xs text-[#688078]">Adherence</Text><Text className="mt-1 font-serif text-2xl font-bold text-signal">{selectedInsight?.adherencePercent === null || selectedInsight?.adherencePercent === undefined ? "-" : `${selectedInsight.adherencePercent}%`}</Text></View></View><View className="mt-4 flex-row justify-between"><Text className="font-serif text-sm text-[#52675F]">S / B / D</Text><Text className="font-serif text-sm font-bold text-ink">{activeAthlete.squatOneRepMaxKg ?? "-"} · {activeAthlete.benchOneRepMaxKg ?? "-"} · {activeAthlete.deadliftOneRepMaxKg ?? "-"} kg</Text></View></> : <View className="py-5"><Text className="font-serif text-sm font-bold text-ink">No athlete selected</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">Invite an athlete to begin coaching.</Text></View>}
          </View>
        </View>
      </View>

      <View className="flex-col gap-5 lg:flex-row">
        <View className="flex-1">
          <SectionHeading eyebrow="Attention queue" title="Review next" />
          <View className="border border-fog bg-paper">
            {attentionItems.length ? attentionItems.map((item, index) => {
              const athlete = profiles.find((profile) => profile.id === item.athleteId);
              return <View key={item.athleteId} className={`flex-row items-center gap-3 px-4 py-4 ${index ? "border-t border-fog" : ""}`}><CircleAlert size={18} color="#D74F32" /><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{athlete?.displayName}</Text><Text className="mt-0.5 font-serif text-xs text-[#52675F]">{item.attention} · {item.syncStatus}</Text></View><Text className="font-serif text-sm font-bold text-signal">{item.readiness}</Text></View>;
            }) : <View className="px-4 py-8"><Text className="font-serif text-sm font-bold text-ink">Nothing needs review</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">New footage, comments, and readiness flags will appear here.</Text></View>}
          </View>
        </View>
        <View className="flex-1">
          <SectionHeading eyebrow="Planned vs actual" title="Current training stress" />
          <View className="border border-fog bg-paper p-4">
            {selectedInsight?.activeProgramName ? <><View className="flex-row items-center justify-between"><View><Text className="font-serif text-sm font-bold text-ink">{selectedInsight.activeProgramName}</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">{selectedInsight.completedSets} completed · {selectedInsight.skippedSets} skipped · {selectedInsight.plannedSets} prescribed</Text></View><Activity size={21} color="#2E6F5E" /></View><View className="mt-5"><ProgressBar value={selectedInsight.adherencePercent ?? 0} /></View></> : <Text className="font-serif text-sm text-[#52675F]">Assign a program to begin tracking this athlete.</Text>}
          </View>
        </View>
      </View>

      <View>
        <SectionHeading eyebrow="Review queue" title="Footage and form notes" action={{ label: "Programs", onPress: () => router.push("/programs") }} />
        <View className="border border-fog bg-paper">
          {pendingReviews.length ? pendingReviews.map((review, index) => <View key={review.id} className={`flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center ${index ? "border-t border-fog" : ""}`}><View className="h-10 w-10 items-center justify-center rounded-md bg-[#D74F321A]">{review.instagramUrl ? <Instagram size={19} color="#D74F32" /> : <ClipboardCheck size={19} color="#D74F32" />}</View><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{review.athleteName} · {review.lift}</Text><Text className="mt-1 font-serif text-xs leading-5 text-[#52675F]">{review.note}</Text></View><View className="flex-row items-center gap-2"><Text className="font-serif text-xs font-bold text-signal">{review.status}</Text>{review.instagramUrl ? <Pressable className="h-9 w-9 items-center justify-center rounded-md border border-fog" onPress={() => Linking.openURL(review.instagramUrl!)} accessibilityLabel={`Open Instagram video for ${review.athleteName}`}><Play size={16} color="#17212B" /></Pressable> : null}<Pressable className="h-9 w-9 items-center justify-center rounded-md bg-moss" onPress={() => setCompletedReviewIds((ids) => [...ids, review.id])} accessibilityLabel={`Mark ${review.lift} review complete`}><CheckCircle2 size={17} color="#FFFFFF" /></Pressable></View></View>) : <View className="items-center py-8"><CheckCircle2 size={24} color="#2E6F5E" /><Text className="mt-2 font-serif text-sm font-bold text-ink">Review queue clear</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">All current videos, flags, and day comments are handled.</Text></View>}
        </View>
      </View>
    </ScrollView>
  );
}

export function DashboardScreen() {
  const { session } = useSession();

  return <AppShell title="Dashboard">{session?.role === "COACH" ? <CoachDashboard /> : <LifterDashboard />}</AppShell>;
}