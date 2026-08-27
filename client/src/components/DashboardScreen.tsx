import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Activity, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, ClipboardCheck, ClipboardList, Dumbbell, Flame, Gauge, Instagram, Play, RefreshCcw, Trophy, Users } from "lucide-react-native";
import { router } from "expo-router";

import { useProxySession } from "../auth/ProxySessionContext";
import { achievements, coachReviewItems, formatTonnage, getCoachInsights, getWorkoutProgress } from "../data/dashboardData";
import { useSyncWorkout } from "../hooks/useSyncWorkout";
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
  const { workout, isLoading, queueCount, isSyncing, flush } = useSyncWorkout();

  if (isLoading || !workout) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator color="#2E6F5E" /><Text className="mt-3 font-serif text-sm text-[#52675F]">Preparing dashboard</Text></View>;
  }

  const progress = getWorkoutProgress(workout);
  const completionPercent = progress.totalSets ? Math.round((progress.completedSets / progress.totalSets) * 100) : 0;
  const stressPercent = progress.plannedTonnageKg ? Math.round((progress.completedTonnageKg / progress.plannedTonnageKg) * 100) : 0;
  const linkedSet = workout.day.exercises.flatMap((exercise) => exercise.sets.map((trainingSet) => ({ exercise, trainingSet }))).find(({ trainingSet }) => trainingSet.instagramVideoUrl);

  return (
    <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
      <View className="border-l-4 border-signal pl-4">
        <Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{workout.athlete.activeBlockTag}</Text>
        <Text className="mt-2 font-serif text-3xl font-bold text-ink">Train with the day you have.</Text>
        <Text className="mt-2 font-serif text-base text-[#52675F]">{workout.athlete.upcomingMeetIdentifier} · {workout.day.focus}</Text>
      </View>

      <View className="flex-col gap-3 sm:flex-row">
        <Metric label="Readiness" value={`${workout.athlete.readinessScore}`} detail={`Acute ${workout.athlete.acuteLoad} / chronic ${workout.athlete.chronicLoad}`} />
        <Metric label="Session progress" value={`${completionPercent}%`} detail={`${progress.completedSets} of ${progress.totalSets} prescribed sets`} accent="#D74F32" />
        <Metric label="Current streak" value={`${workout.athlete.workoutStreak} days`} detail={`${workout.athlete.experiencePoints.toLocaleString()} experience points`} accent="#17212B" />
      </View>

      <View className="border border-fog bg-paper p-5">
        <View className="flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <View className="flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Planned training</Text><Text className="mt-1 font-serif text-2xl font-bold text-ink">{workout.day.name}</Text><Text className="mt-1 font-serif text-sm text-[#52675F]">{workout.day.exercises.length} exercises · {progress.totalSets} prescribed sets</Text></View>
          <Pressable className="min-h-12 flex-row items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 active:opacity-80" onPress={() => router.push("/training")} accessibilityLabel="Open training log">
            <Dumbbell size={18} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Open training log</Text><ArrowRight size={16} color="#FFFFFF" />
          </Pressable>
        </View>
        <View className="mt-5"><View className="mb-2 flex-row justify-between"><Text className="font-serif text-sm font-bold text-ink">Planned vs actual stress</Text><Text className="font-serif text-sm text-[#52675F]">{formatTonnage(progress.completedTonnageKg)} / {formatTonnage(progress.plannedTonnageKg)}</Text></View><ProgressBar value={stressPercent} /></View>
      </View>

      <View>
        <SectionHeading eyebrow="Main lift baselines" title="Current 1RM" />
        <View className="flex-col gap-3 sm:flex-row">
          <Metric label="Squat" value={`${workout.athlete.squatOneRepMaxKg} kg`} detail="Competition baseline" />
          <Metric label="Bench press" value={`${workout.athlete.benchOneRepMaxKg} kg`} detail="Competition baseline" accent="#D74F32" />
          <Metric label="Deadlift" value={`${workout.athlete.deadliftOneRepMaxKg} kg`} detail="Competition baseline" accent="#17212B" />
        </View>
      </View>

      <View className="flex-col gap-5 lg:flex-row">
        <View className="flex-1">
          <SectionHeading eyebrow="Consistency" title="Recent achievements" />
          <View className="border border-fog bg-paper">
            {achievements.map((achievement, index) => <View key={achievement.code} className={`flex-row items-center gap-3 px-4 py-4 ${index ? "border-t border-fog" : ""}`}><View className="h-9 w-9 items-center justify-center rounded-md bg-[#E9C46A33]"><Trophy size={17} color="#A36F05" /></View><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{achievement.title}</Text><Text className="mt-0.5 font-serif text-xs text-[#52675F]">{achievement.detail}</Text></View></View>)}
          </View>
        </View>
        <View className="flex-1">
          <SectionHeading eyebrow="Video review" title="Top-set footage" />
          <View className="border border-fog bg-paper p-4">
            {linkedSet ? <><View className="flex-row items-start gap-3"><View className="h-10 w-10 items-center justify-center rounded-md bg-[#D74F321A]"><Instagram size={20} color="#D74F32" /></View><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{linkedSet.exercise.name} · set {linkedSet.trainingSet.setNumber}</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">Ready for coach review</Text></View></View><Pressable className="mt-4 min-h-10 flex-row items-center justify-center gap-2 rounded-md border border-signal px-3 py-2" onPress={() => Linking.openURL(linkedSet.trainingSet.instagramVideoUrl!)} accessibilityLabel="Open Instagram video"><Play size={16} color="#D74F32" /><Text className="font-serif text-sm font-bold text-signal">Open Instagram</Text></Pressable></> : <View className="items-start"><Text className="font-serif text-sm font-bold text-ink">No top-set video linked</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">Add a public Instagram reel from the training log.</Text></View>}
          </View>
        </View>
      </View>

      <View className="flex-row items-center border border-fog bg-paper p-4">
        <View className="h-10 w-10 items-center justify-center rounded-md bg-[#2E6F5E1A]"><RefreshCcw size={18} color="#2E6F5E" /></View>
        <View className="ml-3 flex-1"><Text className="font-serif text-sm font-bold text-ink">{queueCount ? `${queueCount} local change${queueCount === 1 ? "" : "s"} waiting to sync` : "All training changes synchronized"}</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">{queueCount ? "Your log stays available while you are offline." : "Your current session is up to date."}</Text></View>
        {queueCount ? <Pressable className="h-10 w-10 items-center justify-center rounded-md bg-ink disabled:opacity-50" onPress={() => flush()} disabled={isSyncing} accessibilityLabel="Synchronize queued workout changes"><RefreshCcw size={17} color="#FFFFFF" /></Pressable> : <CheckCircle2 size={21} color="#2E6F5E" />}
      </View>
    </ScrollView>
  );
}

function CoachDashboard() {
  const { profiles, activeAthlete } = useProxySession();
  const [completedReviewIds, setCompletedReviewIds] = useState<string[]>([]);
  const insights = getCoachInsights(profiles);
  const selectedInsight = insights.find((insight) => insight.athleteId === activeAthlete?.id);
  const pendingReviews = coachReviewItems.filter((item) => !completedReviewIds.includes(item.id));
  const attentionItems = insights.filter((insight) => insight.attention !== "On track");

  return (
    <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
      <View className="flex-col justify-between gap-4 border-l-4 border-signal pl-4 sm:flex-row sm:items-end">
        <View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Coaching desk</Text><Text className="mt-2 font-serif text-3xl font-bold text-ink">Four athletes need attention.</Text><Text className="mt-2 font-serif text-base text-[#52675F]">Review readiness, training stress, and new footage before the next session.</Text></View>
        <View className="flex-row gap-2"><Pressable className="h-10 w-10 items-center justify-center rounded-md border border-fog bg-paper" onPress={() => router.push("/programs")} accessibilityLabel="Open athlete programs"><ClipboardList size={18} color="#17212B" /></Pressable><Pressable className="h-10 w-10 items-center justify-center rounded-md bg-ink" onPress={() => router.push("/program-review")} accessibilityLabel="Open program review"><ClipboardCheck size={18} color="#FFFFFF" /></Pressable></View>
      </View>

      <View className="flex-col gap-3 sm:flex-row">
        <Metric label="Assigned athletes" value="12" detail="4 active this week" />
        <Metric label="Attention queue" value={`${attentionItems.length}`} detail="Readiness, video, and pending work" accent="#D74F32" />
        <Metric label="Reviews complete" value={`${coachReviewItems.length - pendingReviews.length}/${coachReviewItems.length}`} detail="Current review queue" accent="#17212B" />
      </View>

      <View className="flex-col gap-5 lg:flex-row">
        <View className="flex-[1.35]">
          <SectionHeading eyebrow="Roster" title="Training status" action={{ label: "All athletes", onPress: () => router.push("/athletes") }} />
          <View className="border border-fog bg-paper">
            {profiles.filter((profile) => profile.role === "lifter").map((athlete, index) => {
              const insight = insights.find((candidate) => candidate.athleteId === athlete.id);
              return <Pressable key={athlete.id} className={`flex-col gap-3 px-4 py-4 active:bg-canvas sm:flex-row sm:items-center ${index ? "border-t border-fog" : ""}`} onPress={() => router.push("/athletes")} accessibilityLabel={`Open ${athlete.displayName}'s athlete overview`}><View className="flex-row items-center gap-3 sm:w-48"><View className="h-9 w-9 items-center justify-center rounded-md bg-moss"><Text className="font-serif text-xs font-bold text-white">{athlete.initials}</Text></View><View><Text className="font-serif text-sm font-bold text-ink">{athlete.displayName}</Text><Text className="font-serif text-xs text-[#52675F]">{athlete.activeBlock}</Text></View></View><View className="flex-row flex-1 justify-between gap-3"><View><Text className="font-serif text-xs text-[#688078]">Readiness</Text><Text className="font-serif text-sm font-bold text-ink">{insight?.readiness ?? "-"}</Text></View><View><Text className="font-serif text-xs text-[#688078]">Adherence</Text><Text className="font-serif text-sm font-bold text-ink">{insight?.adherencePercent ?? "-"}%</Text></View><View><Text className="font-serif text-xs text-[#688078]">Last session</Text><Text className="font-serif text-sm font-bold text-ink">{insight?.lastSession ?? "-"}</Text></View></View><Text className={`font-serif text-xs font-bold ${insight?.attention === "On track" ? "text-moss" : "text-signal"}`}>{insight?.attention}</Text></Pressable>;
            })}
          </View>
        </View>

        <View className="flex-1">
          <SectionHeading eyebrow="Selected athlete" title={activeAthlete?.displayName ?? "Athlete"} />
          <View className="border border-fog bg-paper p-4">
            <View className="flex-row items-center gap-3"><View className="h-11 w-11 items-center justify-center rounded-md bg-ink"><Text className="font-serif text-sm font-bold text-white">{activeAthlete?.initials}</Text></View><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{activeAthlete?.competitionWeightClass} class</Text><Text className="font-serif text-xs text-[#52675F]">{activeAthlete?.upcomingMeet}</Text></View></View>
            <View className="mt-5 flex-row justify-between border-y border-fog py-4"><View><Text className="font-serif text-xs text-[#688078]">Readiness</Text><Text className="mt-1 font-serif text-2xl font-bold text-moss">{selectedInsight?.readiness ?? "-"}</Text></View><View><Text className="font-serif text-xs text-[#688078]">Stress</Text><Text className="mt-1 font-serif text-2xl font-bold text-ink">{selectedInsight ? `${formatTonnage(selectedInsight.completedTonnageKg)}` : "-"}</Text></View><View><Text className="font-serif text-xs text-[#688078]">Adherence</Text><Text className="mt-1 font-serif text-2xl font-bold text-signal">{selectedInsight?.adherencePercent ?? "-"}%</Text></View></View>
            <View className="mt-4 flex-row justify-between"><Text className="font-serif text-sm text-[#52675F]">S / B / D</Text><Text className="font-serif text-sm font-bold text-ink">{activeAthlete?.squatOneRepMaxKg} · {activeAthlete?.benchOneRepMaxKg} · {activeAthlete?.deadliftOneRepMaxKg} kg</Text></View>
          </View>
        </View>
      </View>

      <View className="flex-col gap-5 lg:flex-row">
        <View className="flex-1">
          <SectionHeading eyebrow="Attention queue" title="Review next" />
          <View className="border border-fog bg-paper">
            {attentionItems.map((item, index) => {
              const athlete = profiles.find((profile) => profile.id === item.athleteId);
              return <View key={item.athleteId} className={`flex-row items-center gap-3 px-4 py-4 ${index ? "border-t border-fog" : ""}`}><CircleAlert size={18} color="#D74F32" /><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{athlete?.displayName}</Text><Text className="mt-0.5 font-serif text-xs text-[#52675F]">{item.attention} · {item.syncStatus}</Text></View><Text className="font-serif text-sm font-bold text-signal">{item.readiness}</Text></View>;
            })}
          </View>
        </View>
        <View className="flex-1">
          <SectionHeading eyebrow="Planned vs actual" title="Current training stress" />
          <View className="border border-fog bg-paper p-4">
            {selectedInsight ? <><View className="flex-row items-center justify-between"><View><Text className="font-serif text-sm font-bold text-ink">{activeAthlete?.activeBlock}</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">{formatTonnage(selectedInsight.completedTonnageKg)} completed of {formatTonnage(selectedInsight.plannedTonnageKg)} planned</Text></View><Activity size={21} color="#2E6F5E" /></View><View className="mt-5"><ProgressBar value={Math.round((selectedInsight.completedTonnageKg / selectedInsight.plannedTonnageKg) * 100)} /></View></> : <Text className="font-serif text-sm text-[#52675F]">Choose an athlete to inspect training stress.</Text>}
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
  const { session } = useProxySession();

  return <AppShell title="Dashboard">{session?.role === "coach" ? <CoachDashboard /> : <LifterDashboard />}</AppShell>;
}