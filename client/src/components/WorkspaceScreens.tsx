import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BarChart3, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, Dumbbell, MessageCircle, Send, TrendingDown, TrendingUp, Users } from "lucide-react-native";
import { router } from "expo-router";

import { useSession } from "../auth/AuthSessionContext";
import { coachReviewItems, formatTonnage, getCoachInsights } from "../data/dashboardData";
import { getProgramAnalytics, type WeeklyProgramAnalytics } from "../data/programAnalytics";
import { useProgramWorkspaceStore } from "../data/programWorkspaceStore";
import { AppShell } from "./AppShell";

function ProgressBar({ value, color }: { value: number; color: string }) {
  return <View className="h-2 overflow-hidden rounded-sm bg-fog"><View className="h-2 rounded-sm" style={{ backgroundColor: color, width: `${Math.max(0, Math.min(value, 100))}%` }} /></View>;
}

function MetricCard({ label, value, detail, accent = "#2E6F5E" }: { label: string; value: string; detail: string; accent?: string }) {
  return <View className="flex-1 border border-fog bg-paper p-4"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">{label}</Text><Text className="mt-3 font-serif text-3xl font-bold" style={{ color: accent }}>{value}</Text><Text className="mt-1 font-serif text-xs leading-5 text-[#52675F]">{detail}</Text></View>;
}

function BarGraph({ values, color, formatter }: { values: Array<{ label: string; value: number; detail?: string }>; color: string; formatter: (value: number) => string }) {
  const maximum = Math.max(1, ...values.map((item) => item.value));
  return <View className="mt-5 h-56 flex-row items-end gap-2 border-b border-fog pb-7">{values.map((item) => <View key={item.label} className="h-full flex-1 items-center justify-end"><Text className="mb-2 font-serif text-xs font-bold text-ink">{formatter(item.value)}</Text><View className="w-full max-w-10 rounded-t-sm" style={{ height: `${Math.max(3, (item.value / maximum) * 100)}%`, backgroundColor: color }} /><Text className="absolute -bottom-6 font-serif text-xs text-[#52675F]">{item.label}</Text></View>)}</View>;
}

function AdherenceGraph({ weeks }: { weeks: WeeklyProgramAnalytics[] }) {
  return <View className="mt-5 gap-4">{weeks.map((week) => {
    const total = Math.max(1, week.plannedSets);
    return <View key={week.weekNumber}><View className="mb-2 flex-row items-center justify-between"><Text className="font-serif text-sm font-bold text-ink">W{week.weekNumber}</Text><Text className="font-serif text-xs text-[#52675F]">{week.completedSets} done · {week.skippedSets} skipped · {week.remainingSets} remaining</Text></View><View className="h-4 flex-row overflow-hidden bg-fog"><View style={{ width: `${(week.completedSets / total) * 100}%`, backgroundColor: "#2E6F5E" }} /><View style={{ width: `${(week.skippedSets / total) * 100}%`, backgroundColor: "#D74F32" }} /></View></View>;
  })}</View>;
}

function AccessDenied({ title }: { title: string }) {
  return <AppShell title={title}><View className="flex-1 items-center justify-center px-6"><CircleAlert size={28} color="#D32F2F" /><Text className="mt-4 font-serif text-xl font-bold text-ink">Coach access required</Text><Text className="mt-2 text-center font-serif text-sm text-[#B7B7AF]">This workspace is available to authenticated coach accounts only.</Text><Pressable className="mt-5 bg-ink px-4 py-3" onPress={() => router.replace("/dashboard")}><Text className="font-serif text-sm font-bold text-white">Return to dashboard</Text></Pressable></View></AppShell>;
}

export function AnalyticsScreen() {
  const { session, currentProfile, activeAthlete } = useSession();
  const { programs, dayLogs, isLoading } = useProgramWorkspaceStore();
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const isCoach = session?.role === "COACH";
  const athlete = isCoach ? activeAthlete : currentProfile;
  const athletePrograms = programs.filter((program) => program.athleteId === athlete?.id).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const selectedProgram = athletePrograms.find((program) => program.id === selectedProgramId) ?? athletePrograms.find((program) => program.status === "active") ?? athletePrograms[0] ?? null;
  const analytics = getProgramAnalytics(selectedProgram, dayLogs);

  if (isLoading) {
    return <AppShell title="Analytics"><View className="flex-1 items-center justify-center"><Text className="font-serif text-sm text-[#52675F]">Preparing training analytics</Text></View></AppShell>;
  }

  return (
    <AppShell title="Analytics">
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
        <View className="border-l-4 border-signal pl-4"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Training analytics</Text><Text className="mt-2 font-serif text-3xl font-bold text-ink">Logged work, not estimates.</Text><Text className="mt-2 font-serif text-base text-[#52675F]">{isCoach ? `${athlete?.displayName}'s completed program work` : "Your completed program work"}</Text></View>

        {athletePrograms.length ? <><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Program</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="mt-2 gap-2">{athletePrograms.map((program) => <Pressable key={program.id} className={`w-56 border p-3 ${selectedProgram?.id === program.id ? "border-ink bg-ink" : "border-fog bg-paper"}`} onPress={() => setSelectedProgramId(program.id)}><Text className={`font-serif text-sm font-bold ${selectedProgram?.id === program.id ? "text-white" : "text-ink"}`}>{program.name}</Text><Text className={`mt-1 font-serif text-xs ${selectedProgram?.id === program.id ? "text-[#FFFFFFCC]" : "text-[#52675F]"}`}>{program.phase} · {program.status}</Text></Pressable>)}</ScrollView></View>
          <View className="flex-col gap-3 sm:flex-row"><MetricCard label="Completed volume" value={formatTonnage(analytics.completedTonnageKg)} detail="From completed sets with recorded actual loads" /><MetricCard label="Adherence" value={`${analytics.adherencePercent}%`} detail={`${analytics.completedSets} done of ${analytics.plannedSets} prescribed sets`} accent="#D74F32" /><MetricCard label="Readiness estimate" value={`${analytics.currentReadinessScore}`} detail={`Based on load, completion, and session ratings`} accent="#17212B" /></View>
          <View className="border border-fog bg-paper p-5"><View className="flex-row items-center justify-between"><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Completed tonnage</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">Weekly volume</Text></View><BarChart3 size={22} color="#2E6F5E" /></View><Text className="mt-2 font-serif text-sm text-[#52675F]">Actual kg moved from completed sets. Pounds are converted to kg for a consistent total.</Text><BarGraph values={analytics.weeks.map((week) => ({ label: `W${week.weekNumber}`, value: week.completedTonnageKg }))} color="#2E6F5E" formatter={(value) => value ? `${Math.round(value / 1000)}t` : "-"} /></View>
          <View className="border border-fog bg-paper p-5"><View className="flex-row items-center justify-between"><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Adherence</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">Done, skipped, and remaining</Text></View><CheckCircle2 size={22} color="#2E6F5E" /></View><View className="mt-4 flex-row gap-4"><Text className="font-serif text-xs text-moss">Done</Text><Text className="font-serif text-xs text-signal">Skipped</Text><Text className="font-serif text-xs text-[#52675F]">Remaining</Text></View><AdherenceGraph weeks={analytics.weeks} /></View>
          <View className="flex-col gap-5 lg:flex-row"><View className="flex-1 border border-fog bg-paper p-5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Heaviest completed set</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">Competition lift trend</Text><Text className="mt-2 font-serif text-sm text-[#52675F]">Heaviest actual weight logged in this program.</Text><BarGraph values={[{ label: "Squat", value: analytics.topSets.squat ?? 0 }, { label: "Bench", value: analytics.topSets.bench ?? 0 }, { label: "Deadlift", value: analytics.topSets.deadlift ?? 0 }]} color="#1E7490" formatter={(value) => value ? `${value} kg` : "-"} /></View><View className="flex-1 border border-fog bg-paper p-5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Session rating</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">Athlete-reported effort</Text><Text className="mt-2 font-serif text-sm text-[#52675F]">Average $1$–$10$ rating for logged sessions in each week.</Text><BarGraph values={analytics.weeks.map((week) => ({ label: `W${week.weekNumber}`, value: week.sessionRating ?? 0 }))} color="#A36F05" formatter={(value) => value ? value.toFixed(1) : "-"} /></View></View>
          <View className="border border-fog bg-paper p-5"><View className="flex-row items-center justify-between"><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Fatigue and readiness</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">Training stress trend</Text></View><CalendarDays size={21} color="#52675F" /></View><Text className="mt-2 font-serif text-sm leading-6 text-[#52675F]">Fatigue combines athlete rating, completed-set proportion, and completed tonnage. Readiness is $100 - fatigue$ and is a planning aid, not a medical score.</Text><View className="mt-5 gap-4">{analytics.weeks.map((week) => <View key={week.weekNumber}><View className="mb-2 flex-row items-center justify-between"><Text className="font-serif text-sm font-bold text-ink">W{week.weekNumber}</Text><Text className="font-serif text-xs text-[#52675F]">Fatigue {week.fatigueScore} · Readiness {week.readinessScore}</Text></View><View className="h-3 overflow-hidden bg-fog"><View className="h-full bg-signal" style={{ width: `${week.fatigueScore}%` }} /></View><View className="mt-1 h-3 overflow-hidden bg-fog"><View className="h-full bg-moss" style={{ width: `${week.readinessScore}%` }} /></View></View>)}</View></View>
        </> : <View className="items-center border border-fog bg-paper px-5 py-12"><BarChart3 size={26} color="#688078" /><Text className="mt-3 font-serif text-base font-bold text-ink">No program data yet</Text><Text className="mt-1 text-center font-serif text-sm text-[#52675F]">Create a program, then log completed sets and session ratings to build analytics.</Text></View>}
      </ScrollView>
    </AppShell>
  );
}

interface LocalMessage {
  id: string;
  author: string;
  body: string;
  timestamp: string;
  isCurrentUser: boolean;
}

const initialMessages: LocalMessage[] = [
  { id: "message-1", author: "Coach Taylor", body: "Strong first rep. Keep the knees tracking over the mid-foot on the final rep.", timestamp: "Today, 16:20", isCurrentUser: false },
  { id: "message-2", author: "Alex Morgan", body: "I will keep the same load for set two and tighten the walkout.", timestamp: "Today, 16:24", isCurrentUser: true }
];

export function MessagesScreen() {
  const { session, currentProfile } = useSession();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");

  function sendMessage() {
    const body = draft.trim();
    if (!body || !currentProfile) {
      return;
    }
    setMessages((items) => [...items, { id: `message-${Date.now()}`, author: currentProfile.displayName, body, timestamp: "Just now", isCurrentUser: true }]);
    setDraft("");
  }

  return (
    <AppShell title="Messages">
      <View className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
        <View className="mb-5 border-l-4 border-signal pl-4"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{session?.role === "COACH" ? "Coach communication" : "Coach thread"}</Text><Text className="mt-2 font-serif text-3xl font-bold text-ink">Competition squat · Day 1</Text><Text className="mt-2 font-serif text-base text-[#52675F]">{session?.role === "COACH" ? "Alex Morgan's active training thread" : "Feedback stays attached to your training context"}</Text></View>
        <View className="flex-1 border border-fog bg-paper"><ScrollView className="flex-1" contentContainerClassName="gap-4 p-4" showsVerticalScrollIndicator={false}>{messages.map((message) => <View key={message.id} className={message.isCurrentUser ? "items-end" : "items-start"}><View className={`max-w-[86%] px-4 py-3 ${message.isCurrentUser ? "bg-ink" : "bg-canvas"}`}><Text className={`font-serif text-sm leading-6 ${message.isCurrentUser ? "text-white" : "text-ink"}`}>{message.body}</Text></View><Text className="mt-1 font-serif text-xs text-[#688078]">{message.author} · {message.timestamp}</Text></View>)}</ScrollView><View className="border-t border-fog p-3"><TextInput className="min-h-20 border border-fog bg-canvas p-3 font-serif text-base text-ink" multiline value={draft} onChangeText={setDraft} placeholder="Write a coaching note" placeholderTextColor="#688078" accessibilityLabel="Write a message" /><View className="mt-3 flex-row justify-between"><Text className="font-serif text-xs text-[#52675F]">Local-first thread · syncs when online</Text><Pressable className="h-10 w-10 items-center justify-center rounded-md bg-ink disabled:opacity-50" onPress={sendMessage} disabled={!draft.trim()} accessibilityLabel="Send message"><Send size={17} color="#FFFFFF" /></Pressable></View></View></View>
      </View>
    </AppShell>
  );
}

export function AthletesScreen() {
  const { session, profiles, activeAthlete, selectAthlete } = useSession();
  if (session?.role !== "COACH") {
    return <AccessDenied title="Athletes" />;
  }
  const insights = getCoachInsights(profiles);
  const athletes = profiles.filter((profile) => profile.role === "ATHLETE");

  return (
    <AppShell title="Athletes">
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
        <View className="border-l-4 border-signal pl-4"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Coach roster</Text><Text className="mt-2 font-serif text-3xl font-bold text-ink">Athlete readiness and adherence.</Text><Text className="mt-2 font-serif text-base text-[#52675F]">Select a lifter to update the active review context.</Text></View>
        <View className="border border-fog bg-paper">{athletes.map((athlete, index) => { const insight = insights.find((item) => item.athleteId === athlete.id); const isSelected = activeAthlete?.id === athlete.id; return <Pressable key={athlete.id} className={`flex-col gap-4 px-4 py-5 active:bg-canvas sm:flex-row sm:items-center ${index ? "border-t border-fog" : ""}`} onPress={() => void selectAthlete(athlete.id)} accessibilityLabel={`Select ${athlete.displayName} for review`}><View className="flex-row items-center gap-3 sm:w-60"><View className={`h-11 w-11 items-center justify-center rounded-md ${isSelected ? "bg-signal" : "bg-moss"}`}><Text className="font-serif text-xs font-bold text-white">{athlete.initials}</Text></View><View><Text className="font-serif text-base font-bold text-ink">{athlete.displayName}</Text><Text className="font-serif text-xs text-[#52675F]">{athlete.competitionWeightClass} · {athlete.activeBlock}</Text></View></View><View className="flex-row flex-1 justify-between"><View><Text className="font-serif text-xs text-[#688078]">Readiness</Text><Text className="font-serif text-lg font-bold text-ink">{insight?.readiness}</Text></View><View><Text className="font-serif text-xs text-[#688078]">Adherence</Text><Text className="font-serif text-lg font-bold text-ink">{insight?.adherencePercent}%</Text></View><View><Text className="font-serif text-xs text-[#688078]">Sync</Text><Text className="font-serif text-sm font-bold text-moss">{insight?.syncStatus}</Text></View></View><ChevronRight size={20} color="#52675F" /></Pressable>; })}</View>
      </ScrollView>
    </AppShell>
  );
}

export function ProgramReviewScreen() {
  const { session, activeAthlete, profiles } = useSession();
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  if (session?.role !== "COACH") {
    return <AccessDenied title="Program Review" />;
  }
  const insight = getCoachInsights(profiles).find((item) => item.athleteId === activeAthlete?.id);
  const reviewItems = coachReviewItems.filter((item) => item.athleteId === activeAthlete?.id && !reviewedIds.includes(item.id));
  const stressPercent = insight ? Math.round((insight.completedTonnageKg / insight.plannedTonnageKg) * 100) : 0;

  return (
    <AppShell title="Program Review">
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
        <View className="flex-col gap-3 border-l-4 border-signal pl-4 sm:flex-row sm:items-end sm:justify-between"><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Active athlete</Text><Text className="mt-2 font-serif text-3xl font-bold text-ink">{activeAthlete?.displayName}</Text><Text className="mt-2 font-serif text-base text-[#52675F]">{activeAthlete?.activeBlock} · {activeAthlete?.upcomingMeet}</Text></View><Pressable className="min-h-10 flex-row items-center gap-2 rounded-md border border-fog bg-paper px-3 py-2" onPress={() => router.push("/athletes")}><Users size={16} color="#17212B" /><Text className="font-serif text-sm font-bold text-ink">Change athlete</Text></Pressable></View>
        <View className="flex-col gap-3 sm:flex-row"><View className="flex-1 border border-fog bg-paper p-4"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Readiness decision</Text><View className="mt-3 flex-row items-center gap-2">{(insight?.readiness ?? 0) < 65 ? <TrendingDown size={20} color="#D74F32" /> : <TrendingUp size={20} color="#2E6F5E" />}<Text className="font-serif text-3xl font-bold text-ink">{insight?.readiness}</Text></View><Text className="mt-1 font-serif text-xs text-[#52675F]">{(insight?.readiness ?? 0) < 65 ? "Reduce top-set exposure" : "Maintain planned exposure"}</Text></View><View className="flex-1 border border-fog bg-paper p-4"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Volume completion</Text><Text className="mt-3 font-serif text-3xl font-bold text-ink">{stressPercent}%</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">{formatTonnage(insight?.completedTonnageKg ?? 0)} of {formatTonnage(insight?.plannedTonnageKg ?? 0)}</Text></View><View className="flex-1 border border-fog bg-paper p-4"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Main lift baselines</Text><Text className="mt-3 font-serif text-xl font-bold text-ink">{activeAthlete?.squatOneRepMaxKg} / {activeAthlete?.benchOneRepMaxKg} / {activeAthlete?.deadliftOneRepMaxKg}</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">Squat · bench · deadlift kg</Text></View></View>
        <View className="border border-fog bg-paper p-5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Stress check</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">Planned versus actual tonnage</Text><View className="mt-5"><ProgressBar value={stressPercent} color="#2E6F5E" /></View><View className="mt-4 flex-row justify-between"><Text className="font-serif text-sm text-[#52675F]">{formatTonnage(insight?.completedTonnageKg ?? 0)} actual</Text><Text className="font-serif text-sm font-bold text-ink">{formatTonnage(insight?.plannedTonnageKg ?? 0)} planned</Text></View></View>
        <View><View className="mb-3"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Coaching actions</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">Form flags and review notes</Text></View><View className="border border-fog bg-paper">{reviewItems.length ? reviewItems.map((item, index) => <View key={item.id} className={`flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center ${index ? "border-t border-fog" : ""}`}><Dumbbell size={20} color="#D74F32" /><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{item.lift}</Text><Text className="mt-1 font-serif text-xs leading-5 text-[#52675F]">{item.note}</Text></View><Pressable className="min-h-10 flex-row items-center justify-center gap-2 rounded-md bg-moss px-3 py-2" onPress={() => setReviewedIds((ids) => [...ids, item.id])}><CheckCircle2 size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Complete</Text></Pressable></View>) : <View className="items-center py-10"><CheckCircle2 size={26} color="#2E6F5E" /><Text className="mt-3 font-serif text-base font-bold text-ink">Review complete</Text><Text className="mt-1 font-serif text-sm text-[#52675F]">No outstanding form flags for this athlete.</Text></View>}</View></View>
      </ScrollView>
    </AppShell>
  );
}