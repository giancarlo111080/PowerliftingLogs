import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Activity, CalendarClock, Check, ChevronDown, ChevronUp, Dumbbell, Gauge, Scale, ShieldCheck, Trash2, Trophy, Video } from "lucide-react-native";
import { Redirect } from "expo-router";

import { useSession } from "../auth/AuthSessionContext";
import { calculateRecoveryReadiness, generateWarmUps, projectStrength } from "../data/adaptiveEngine";
import { usePerformanceStore } from "../data/performanceStore";
import { useProgramWorkspaceStore } from "../data/programWorkspaceStore";
import type { PrimaryLift } from "../lib/liftAnalysis";
import { AppShell } from "./AppShell";

const lifts: PrimaryLift[] = ["squat", "bench", "deadlift"];
const checklistItems = ["Membership card", "Singlet", "Belt", "Shoes", "Knee sleeves", "Wrist wraps"];

function SectionTitle({ icon: Icon, eyebrow, title }: { icon: typeof Activity; eyebrow: string; title: string }) {
  return <View className="mb-4 flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center bg-ink"><Icon size={19} color="#FF565E" /></View><View><Text className="font-mono text-[10px] uppercase text-muted">{eyebrow}</Text><Text className="font-heading text-xl uppercase text-ink">{title}</Text></View></View>;
}

function Stepper({ label, value, onChange, inverse = false }: { label: string; value: number; onChange: (value: number) => void; inverse?: boolean }) {
  return <View className="min-w-36 flex-1 border-t border-fog py-3"><Text className="font-sans text-xs text-muted">{label}</Text><View className="mt-2 flex-row items-center justify-between"><Pressable className="h-9 w-9 items-center justify-center border border-fog" onPress={() => onChange(Math.max(0, value - 1))} accessibilityLabel={`Decrease ${label}`}><ChevronDown size={16} color="#52607A" /></Pressable><View className="items-center"><Text className={`font-heading text-2xl ${inverse && value >= 4 ? "text-signal" : "text-ink"}`}>{value}</Text><Text className="font-mono text-[9px] text-muted">/ 10</Text></View><Pressable className="h-9 w-9 items-center justify-center border border-fog" onPress={() => onChange(Math.min(10, value + 1))} accessibilityLabel={`Increase ${label}`}><ChevronUp size={16} color="#52607A" /></Pressable></View></View>;
}

function ToggleRow({ label, detail, enabled, onPress }: { label: string; detail: string; enabled: boolean; onPress: () => void }) {
  return <Pressable className="flex-row items-center gap-3 border-t border-fog py-3" onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: enabled }}><View className={`h-6 w-11 justify-center px-1 ${enabled ? "items-end bg-moss" : "items-start bg-fog"}`}><View className="h-4 w-4 bg-paper" /></View><View className="flex-1"><Text className="font-sans text-sm font-bold text-ink">{label}</Text><Text className="font-sans text-xs leading-4 text-muted">{detail}</Text></View></Pressable>;
}

function numeric(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function PerformanceHubScreen() {
  const { currentProfile, activeAthlete, session } = useSession();
  const athlete = session?.role === "COACH" ? activeAthlete : currentProfile;
  const athleteId = athlete?.id ?? "";
  const { programs, dayLogs } = useProgramWorkspaceStore();
  const performance = usePerformanceStore();
  const program = programs.find((item) => item.athleteId === athleteId && item.status === "active") ?? null;
  const recovery = performance.recovery.filter((item) => item.athleteId === athleteId);
  const latestRecovery = [...recovery].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
  const readiness = calculateRecoveryReadiness(latestRecovery);
  const existingMeet = performance.meetPlans.find((item) => item.athleteId === athleteId);
  const consent = performance.consents.find((item) => item.athleteId === athleteId) ?? { operationalData: true, modelTraining: false, videoModelTraining: false };
  const [checkIn, setCheckIn] = useState({ sleep: 7, soreness: 3, stress: 3, pain: 0, motivation: 7 });
  const [bodyWeight, setBodyWeight] = useState(athlete?.bodyWeightKg?.toString() ?? "");
  const [notes, setNotes] = useState("");
  const [cycleContext, setCycleContext] = useState("");
  const [selectedLift, setSelectedLift] = useState<PrimaryLift>("squat");
  const [target, setTarget] = useState("180");
  const [meetDate, setMeetDate] = useState("");
  const [federation, setFederation] = useState("IPF");
  const [attempts, setAttempts] = useState<Record<PrimaryLift, [string, string, string]>>({ squat: ["", "", ""], bench: ["", "", ""], deadlift: ["", "", ""] });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!existingMeet) return;
    setMeetDate(existingMeet.meetDate);
    setFederation(existingMeet.federation);
    setTarget(existingMeet.targetKg.toString());
    setSelectedLift(existingMeet.targetLift);
    setAttempts(Object.fromEntries(lifts.map((lift) => [lift, existingMeet.attempts[lift].map(String)])) as Record<PrimaryLift, [string, string, string]>);
    setChecklist(existingMeet.checklist);
  }, [existingMeet]);

  if (session && session.role !== "ATHLETE") return <Redirect href="/dashboard" />;

  const projections = Object.fromEntries(lifts.map((lift) => [lift, projectStrength(program, dayLogs, lift, lift === "squat" ? athlete?.squatOneRepMaxKg : lift === "bench" ? athlete?.benchOneRepMaxKg : athlete?.deadliftOneRepMaxKg)])) as Record<PrimaryLift, ReturnType<typeof projectStrength>>;
  const warmUps = generateWarmUps(numeric(target, 0), existingMeet?.barWeightKg ?? 20, undefined, 5, readiness);
  const analyses = dayLogs.filter((log) => log.programId === program?.id).flatMap((log) => log.sets.map((set) => set.videoAnalysis)).filter((analysis) => analysis && analysis.liftType);

  async function submitRecovery() {
    if (!athleteId) return;
    await performance.saveRecovery({ athleteId, ...checkIn, ...(numeric(bodyWeight, 0) ? { bodyWeightKg: numeric(bodyWeight, 0) } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}), ...(cycleContext.trim() ? { cycleContext: cycleContext.trim() } : {}) });
    setNotes("");
    setMessage("Recovery check-in saved on this device.");
  }

  async function saveMeet() {
    if (!athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(meetDate)) {
      setMessage("Enter the meet date as YYYY-MM-DD.");
      return;
    }
    await performance.saveMeetPlan({ athleteId, meetDate, federation: federation.trim() || "Unspecified", targetLift: selectedLift, targetKg: numeric(target, 0), barWeightKg: 20, flightsAway: existingMeet?.flightsAway ?? 2, liftersPerFlight: existingMeet?.liftersPerFlight ?? 14, attempts: Object.fromEntries(lifts.map((lift) => [lift, attempts[lift].map((value) => numeric(value, 0))])) as Record<PrimaryLift, [number, number, number]>, checklist });
    setMessage("Meet plan saved for offline access.");
  }

  async function updateConsent(changes: Partial<typeof consent>) {
    if (!athleteId) return;
    await performance.setConsent({ athleteId, operationalData: changes.operationalData ?? consent.operationalData, modelTraining: changes.modelTraining ?? consent.modelTraining, videoModelTraining: changes.videoModelTraining ?? consent.videoModelTraining });
  }

  return <AppShell title="Performance Hub"><ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-8 px-4 py-6 pb-16">
    <View className="border-l-4 border-signal pl-4"><Text className="font-mono text-xs uppercase text-moss">Athlete intelligence</Text><Text className="mt-1 font-heading text-3xl uppercase text-ink">{athlete?.displayName ?? "Performance"}</Text><Text className="mt-2 max-w-2xl font-sans text-sm text-muted">Readiness, strength, technique, and meet execution in one private workspace.</Text></View>
    {message ? <View className="border border-moss bg-paper p-3"><Text className="font-sans text-sm text-ink">{message}</Text></View> : null}

    <View className="gap-4 lg:flex-row"><View className="flex-[1.2] bg-paper p-5"><SectionTitle icon={Activity} eyebrow="Daily signal" title="Recovery check-in" /><View className="flex-row flex-wrap gap-x-5"><Stepper label="Sleep" value={checkIn.sleep} onChange={(sleep) => setCheckIn({ ...checkIn, sleep })} /><Stepper label="Soreness" value={checkIn.soreness} inverse onChange={(soreness) => setCheckIn({ ...checkIn, soreness })} /><Stepper label="Stress" value={checkIn.stress} inverse onChange={(stress) => setCheckIn({ ...checkIn, stress })} /><Stepper label="Pain" value={checkIn.pain} inverse onChange={(pain) => setCheckIn({ ...checkIn, pain })} /><Stepper label="Motivation" value={checkIn.motivation} onChange={(motivation) => setCheckIn({ ...checkIn, motivation })} /></View><View className="mt-3 flex-row gap-3"><TextInput className="min-h-11 w-28 border border-fog bg-canvas px-3 font-sans text-ink" value={bodyWeight} onChangeText={setBodyWeight} keyboardType="decimal-pad" placeholder="Body kg" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={notes} onChangeText={setNotes} placeholder="Notes (optional)" placeholderTextColor="#8996AC" /></View><TextInput className="mt-3 min-h-11 border border-fog bg-canvas px-3 font-sans text-ink" value={cycleContext} onChangeText={setCycleContext} placeholder="Cycle context (optional and private)" placeholderTextColor="#8996AC" /><Pressable className="mt-4 min-h-11 items-center justify-center bg-ink px-5" onPress={() => void submitRecovery()}><Text className="font-heading uppercase text-white">Save check-in</Text></Pressable>{checkIn.pain >= 4 ? <Text className="mt-3 font-sans text-xs leading-5 text-signal">Pain is flagged for human review. Iron Forge does not diagnose injuries or replace medical care. Seek qualified help for urgent or worsening symptoms.</Text> : null}</View>
      <View className="flex-1 bg-ink p-5"><Text className="font-mono text-xs uppercase text-[#ABB5C8]">Current readiness</Text><Text className="mt-3 font-heading text-6xl text-white">{readiness}</Text><Text className="mt-2 font-sans text-sm text-[#D7DCE7]">{readiness >= 75 ? "Stable signal. Follow the approved plan." : readiness > 60 ? "Mixed signal. Use conservative warm-ups." : "Low signal. Coach review recommended."}</Text><Text className="mt-6 border-t border-[#52607A] pt-4 font-mono text-xs text-[#ABB5C8]">{recovery.length} check-in{recovery.length === 1 ? "" : "s"} retained</Text></View></View>

    <View><SectionTitle icon={Gauge} eyebrow="Probability, not promises" title="Projected strength" /><View className="gap-3 md:flex-row">{lifts.map((lift) => { const projection = projections[lift]; return <View key={lift} className="flex-1 border-t-4 border-moss bg-paper p-4"><Text className="font-mono text-xs uppercase text-muted">{lift} · {projection.confidence}</Text><Text className="mt-3 font-heading text-4xl text-ink">{projection.medianKg ?? "-"}<Text className="text-base"> kg</Text></Text><Text className="mt-2 font-sans text-xs text-muted">50%: {projection.lower50Kg ?? "-"}–{projection.upper50Kg ?? "-"} kg</Text><Text className="font-sans text-xs text-muted">90%: {projection.lower90Kg ?? "-"}–{projection.upper90Kg ?? "-"} kg</Text><Text className="mt-3 font-mono text-[10px] text-muted">{projection.sampleSize} recent valid top sets</Text></View>; })}</View></View>

    <View className="gap-5 lg:flex-row"><View className="flex-1 bg-paper p-5"><SectionTitle icon={Dumbbell} eyebrow="Achievable loading" title="Smart warm-ups" /><View className="mb-4 flex-row gap-2">{lifts.map((lift) => <Pressable key={lift} className={`flex-1 items-center border py-2 ${selectedLift === lift ? "border-signal bg-signal" : "border-fog"}`} onPress={() => setSelectedLift(lift)}><Text className={`font-heading uppercase ${selectedLift === lift ? "text-white" : "text-ink"}`}>{lift}</Text></Pressable>)}</View><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-sans text-ink" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="Target kg" placeholderTextColor="#8996AC" />{warmUps.map((set, index) => <View key={`${set.loadKg}-${index}`} className="flex-row items-center border-b border-fog py-3"><Text className="w-8 font-mono text-xs text-muted">{index + 1}</Text><Text className="w-24 font-heading text-xl text-ink">{set.loadKg} kg</Text><Text className="w-16 font-sans text-sm text-muted">× {set.repetitions}</Text><Text className="flex-1 font-mono text-xs text-muted">{set.platesPerSide.length ? `${set.platesPerSide.join(" + ")} / side` : "empty bar"}</Text></View>)}</View>
      <View className="flex-1 bg-paper p-5"><SectionTitle icon={Video} eyebrow="Compatible samples only" title="Technique timeline" />{analyses.length ? analyses.slice(-6).reverse().map((analysis, index) => <View key={`${analysis!.analyzedAt}-${index}`} className="border-t border-fog py-3"><View className="flex-row justify-between"><Text className="font-heading uppercase text-ink">{analysis!.liftType}</Text><Text className={`font-mono text-xs uppercase ${analysis!.confidence === "high" ? "text-moss" : "text-muted"}`}>{analysis!.confidence} confidence</Text></View><Text className="mt-1 font-sans text-xs text-muted">{analysis!.cameraView} view · velocity {analysis!.meanConcentricVelocityMps ?? "withheld"} m/s · drift {analysis!.barPathHorizontalDriftCm ?? "withheld"} cm</Text></View>) : <Text className="font-sans text-sm text-muted">Completed lift analyses will form separate squat, bench, and deadlift timelines. Low-confidence measurements remain withheld.</Text>}</View></View>

    <View className="bg-paper p-5"><SectionTitle icon={Trophy} eyebrow="Offline meet plan" title="Meet-day command center" /><View className="gap-3 sm:flex-row"><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={meetDate} onChangeText={setMeetDate} placeholder="YYYY-MM-DD" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={federation} onChangeText={setFederation} placeholder="Federation" placeholderTextColor="#8996AC" /></View><View className="mt-5 gap-4">{lifts.map((lift) => <View key={lift}><Text className="mb-2 font-heading uppercase text-ink">{lift} attempts · kg</Text><View className="flex-row gap-2">{attempts[lift].map((value, index) => <TextInput key={index} className="min-h-11 flex-1 border border-fog bg-canvas px-3 text-center font-sans text-ink" value={value} onChangeText={(next) => setAttempts({ ...attempts, [lift]: attempts[lift].map((item, itemIndex) => itemIndex === index ? next : item) as [string, string, string] })} keyboardType="decimal-pad" placeholder={`${index + 1}`} placeholderTextColor="#8996AC" />)}</View></View>)}</View><View className="mt-5 flex-row flex-wrap gap-2">{checklistItems.map((item) => <Pressable key={item} className={`flex-row items-center gap-2 border px-3 py-2 ${checklist[item] ? "border-moss bg-moss" : "border-fog"}`} onPress={() => setChecklist({ ...checklist, [item]: !checklist[item] })}><Check size={14} color={checklist[item] ? "#FFFFFF" : "#52607A"} /><Text className={`font-sans text-xs ${checklist[item] ? "text-white" : "text-ink"}`}>{item}</Text></Pressable>)}</View><View className="mt-5 flex-row items-center gap-3 border-y border-fog py-3"><CalendarClock size={18} color="#FF565E" /><Text className="flex-1 font-sans text-sm text-ink">Warm-up clock: {existingMeet ? `${existingMeet.flightsAway * existingMeet.liftersPerFlight * 1.2} estimated minutes` : "save flight details to estimate"}. Verify live flight changes manually.</Text></View><Pressable className="mt-4 min-h-11 items-center justify-center bg-signal" onPress={() => void saveMeet()}><Text className="font-heading uppercase text-white">Save meet plan</Text></Pressable></View>

    <View className="gap-5 lg:flex-row"><View className="flex-1 bg-paper p-5"><SectionTitle icon={Scale} eyebrow="Reference · verify with meet director" title="Competition rules" /><Text className="font-sans text-sm leading-6 text-ink">{federation || "Selected federation"}: commands, approved equipment, weight classes, weigh-in windows, and attempt deadlines can vary by jurisdiction and effective date.</Text><Text className="mt-3 font-mono text-xs text-signal">Reference status: local MVP · not an official rules source</Text></View><View className="flex-1 bg-paper p-5"><SectionTitle icon={ShieldCheck} eyebrow="Revocable controls" title="Data consent" /><ToggleRow label="Operational data" detail="Required to calculate your private performance workspace." enabled={consent.operationalData} onPress={() => void updateConsent({ operationalData: !consent.operationalData })} /><ToggleRow label="Model training" detail="Opt in to de-identified future model training." enabled={consent.modelTraining} onPress={() => void updateConsent({ modelTraining: !consent.modelTraining })} /><ToggleRow label="Video model training" detail="Off by default and controlled separately." enabled={consent.videoModelTraining} onPress={() => void updateConsent({ videoModelTraining: !consent.videoModelTraining })} /><Pressable className="mt-4 min-h-11 flex-row items-center justify-center gap-2 border border-signal" onPress={() => Alert.alert("Delete performance data?", "This removes local recovery, meet, decision, annotation, version, and consent records for this athlete.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void performance.deleteAthleteData(athleteId) }])}><Trash2 size={16} color="#FF3B45" /><Text className="font-heading uppercase text-signal">Delete local performance data</Text></Pressable></View></View>
  </ScrollView></AppShell>;
}