import { useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { Activity, ChevronDown, ChevronUp, Download, Gauge, RefreshCw, ShieldCheck, Trash2, Video } from "lucide-react-native";
import { Redirect } from "expo-router";

import { useSession } from "../auth/AuthSessionContext";
import { calculateRecoveryReadiness, projectStrength } from "../data/adaptiveEngine";
import { usePerformanceStore } from "../data/performanceStore";
import { useProgramWorkspaceStore } from "../data/programWorkspaceStore";
import type { PrimaryLift } from "../lib/liftAnalysis";
import { AppShell } from "./AppShell";
import { MeetDayCommandCenter } from "./MeetDayCommandCenter";

const lifts: PrimaryLift[] = ["squat", "bench", "deadlift"];

function SectionTitle({ icon: Icon, eyebrow, title }: { icon: typeof Activity; eyebrow: string; title: string }) {
  return <View className="mb-4 flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center bg-ink"><Icon size={19} color="#FF565E" /></View><View className="flex-1"><Text className="font-mono text-[10px] uppercase text-muted">{eyebrow}</Text><Text className="font-heading text-xl uppercase text-ink">{title}</Text></View></View>;
}

function Stepper({ label, value, onChange, inverse = false }: { label: string; value: number; onChange: (value: number) => void; inverse?: boolean }) {
  return <View className="min-w-36 flex-1 border-t border-fog py-3"><Text className="font-sans text-xs text-muted">{label}</Text><View className="mt-2 flex-row items-center justify-between"><Pressable className="h-9 w-9 items-center justify-center border border-fog" onPress={() => onChange(Math.max(0, value - 1))} accessibilityLabel={`Decrease ${label}`}><ChevronDown size={16} color="#52607A" /></Pressable><View className="items-center"><Text className={`font-heading text-2xl ${inverse && value >= 4 ? "text-signal" : "text-ink"}`}>{value}</Text><Text className="font-mono text-[9px] text-muted">/ 10</Text></View><Pressable className="h-9 w-9 items-center justify-center border border-fog" onPress={() => onChange(Math.min(10, value + 1))} accessibilityLabel={`Increase ${label}`}><ChevronUp size={16} color="#52607A" /></Pressable></View></View>;
}

function ToggleRow({ label, detail, enabled, onPress }: { label: string; detail: string; enabled: boolean; onPress: () => void }) {
  return <Pressable className="flex-row items-center gap-3 border-t border-fog py-3" onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: enabled }}><View className={`h-6 w-11 justify-center px-1 ${enabled ? "items-end bg-moss" : "items-start bg-fog"}`}><View className="h-4 w-4 bg-paper" /></View><View className="flex-1"><Text className="font-sans text-sm font-bold text-ink">{label}</Text><Text className="font-sans text-xs leading-4 text-muted">{detail}</Text></View></Pressable>;
}

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function AthletePerformanceScreen() {
  const { currentProfile, session } = useSession();
  const { programs, dayLogs } = useProgramWorkspaceStore();
  const performance = usePerformanceStore();
  const athleteId = currentProfile?.id ?? "";
  const program = programs.find((item) => item.athleteId === athleteId && item.status === "active") ?? null;
  const recovery = performance.recovery.filter((item) => item.athleteId === athleteId);
  const latestRecovery = [...recovery].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0];
  const readiness = calculateRecoveryReadiness(latestRecovery);
  const consent = performance.consents.find((item) => item.athleteId === athleteId) ?? { operationalData: true, modelTraining: false, videoModelTraining: false };
  const [checkIn, setCheckIn] = useState({ sleep: 7, soreness: 3, stress: 3, pain: 0, motivation: 7 });
  const [bodyWeight, setBodyWeight] = useState(currentProfile?.bodyWeightKg?.toString() ?? "");
  const [notes, setNotes] = useState("");
  const [cycleContext, setCycleContext] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (session && session.role !== "ATHLETE") return <Redirect href="/dashboard" />;

  const projections = Object.fromEntries(lifts.map((lift) => [lift, projectStrength(program, dayLogs, lift, lift === "squat" ? currentProfile?.squatOneRepMaxKg : lift === "bench" ? currentProfile?.benchOneRepMaxKg : currentProfile?.deadliftOneRepMaxKg)])) as Record<PrimaryLift, ReturnType<typeof projectStrength>>;
  const analyses = dayLogs.filter((log) => log.programId === program?.id).flatMap((log) => log.sets.map((set) => set.videoAnalysis)).filter((analysis) => analysis?.liftType);

  async function submitRecovery() {
    if (!athleteId) return;
    try {
      const weight = numeric(bodyWeight);
      await performance.saveRecovery({ athleteId, ...checkIn, ...(weight ? { bodyWeightKg: weight } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}), ...(cycleContext.trim() ? { cycleContext: cycleContext.trim() } : {}) });
      setNotes("");
      setMessage("Recovery check-in saved locally and queued for synchronization.");
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : "Recovery check-in could not be saved.");
    }
  }

  async function updateConsent(changes: Partial<typeof consent>) {
    if (!athleteId) return;
    await performance.setConsent({ athleteId, operationalData: changes.operationalData ?? consent.operationalData, modelTraining: changes.modelTraining ?? consent.modelTraining, videoModelTraining: changes.videoModelTraining ?? consent.videoModelTraining });
  }

  async function exportData() {
    if (!athleteId) return;
    const contents = await performance.exportAthleteData(athleteId);
    if (Platform.OS === "web" && typeof globalThis.document !== "undefined") {
      const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
      const link = globalThis.document.createElement("a");
      link.href = url;
      link.download = `iron-forge-${athleteId}-export.json`;
      link.click();
      URL.revokeObjectURL(url);
    }
    else {
      await Share.share({ title: "Iron Forge performance export", message: contents });
    }
    setMessage("Performance data export created.");
  }

  return <AppShell title="Performance Hub"><ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-8 px-4 py-6 pb-16">
    <View className="border-l-4 border-signal pl-4"><Text className="font-mono text-xs uppercase text-moss">Athlete intelligence</Text><Text className="mt-1 font-heading text-3xl uppercase text-ink">{currentProfile?.displayName ?? "Performance"}</Text><Text className="mt-2 max-w-2xl font-sans text-sm text-muted">Readiness, strength, technique, and meet execution in one private workspace.</Text></View>
    {message ? <View className="border border-moss bg-paper p-3"><Text className="font-sans text-sm text-ink">{message}</Text></View> : null}
    <View className="flex-col gap-3 border border-fog bg-paper p-3 sm:flex-row sm:items-center"><View className="flex-1"><Text className="font-sans text-sm font-bold text-ink">{performance.isSyncing ? "Synchronizing performance data" : performance.lastSyncError ? "Saved locally; server sync pending" : "Performance data synchronized"}</Text><Text className="mt-1 font-mono text-[10px] text-muted">{performance.lastSyncError ?? (performance.lastSyncedAt ? `Last sync ${new Date(performance.lastSyncedAt).toLocaleString()}` : "Local-first storage active")}</Text></View><View className="flex-row gap-2"><Pressable className="h-10 w-10 items-center justify-center border border-fog" onPress={() => void performance.syncNow()} accessibilityLabel="Synchronize performance data"><RefreshCw size={17} color="#52607A" /></Pressable><Pressable className="h-10 w-10 items-center justify-center bg-ink" onPress={() => void exportData()} accessibilityLabel="Export performance data"><Download size={17} color="#FFFFFF" /></Pressable></View></View>

    <View className="gap-4 lg:flex-row"><View className="flex-[1.2] bg-paper p-5"><SectionTitle icon={Activity} eyebrow="Daily signal" title="Recovery check-in" /><View className="flex-row flex-wrap gap-x-5"><Stepper label="Sleep" value={checkIn.sleep} onChange={(sleep) => setCheckIn((current) => ({ ...current, sleep }))} /><Stepper label="Soreness" value={checkIn.soreness} inverse onChange={(soreness) => setCheckIn((current) => ({ ...current, soreness }))} /><Stepper label="Stress" value={checkIn.stress} inverse onChange={(stress) => setCheckIn((current) => ({ ...current, stress }))} /><Stepper label="Pain" value={checkIn.pain} inverse onChange={(pain) => setCheckIn((current) => ({ ...current, pain }))} /><Stepper label="Motivation" value={checkIn.motivation} onChange={(motivation) => setCheckIn((current) => ({ ...current, motivation }))} /></View><View className="mt-3 flex-row flex-wrap gap-3"><TextInput className="min-h-11 w-28 border border-fog bg-canvas px-3 font-sans text-ink" value={bodyWeight} onChangeText={setBodyWeight} keyboardType="decimal-pad" placeholder="Body kg" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 min-w-48 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={notes} onChangeText={setNotes} placeholder="Notes (optional)" placeholderTextColor="#8996AC" /></View><TextInput className="mt-3 min-h-11 border border-fog bg-canvas px-3 font-sans text-ink" value={cycleContext} onChangeText={setCycleContext} placeholder="Cycle context (optional and private)" placeholderTextColor="#8996AC" /><Pressable className="mt-4 min-h-11 items-center justify-center bg-ink px-5" onPress={() => void submitRecovery()}><Text className="font-heading uppercase text-white">Save check-in</Text></Pressable>{checkIn.pain >= 4 ? <Text className="mt-3 font-sans text-xs leading-5 text-signal">Pain is flagged for human review. Iron Forge does not diagnose injuries or replace medical care. Seek qualified help for urgent or worsening symptoms.</Text> : null}</View><View className="flex-1 bg-ink p-5"><Text className="font-mono text-xs uppercase text-[#ABB5C8]">Current readiness</Text><Text className="mt-3 font-heading text-6xl text-white">{readiness}</Text><Text className="mt-2 font-sans text-sm text-[#D7DCE7]">{readiness >= 75 ? "Stable signal. Follow the approved plan." : readiness > 60 ? "Mixed signal. Use conservative warm-ups." : "Low signal. Coach review recommended."}</Text><Text className="mt-6 border-t border-[#52607A] pt-4 font-mono text-xs text-[#ABB5C8]">{recovery.length} check-in{recovery.length === 1 ? "" : "s"} retained</Text></View></View>

    <View><SectionTitle icon={Gauge} eyebrow="Probability, not promises" title="Projected strength" /><View className="gap-3 md:flex-row">{lifts.map((lift) => { const projection = projections[lift]; return <View key={lift} className="flex-1 border-t-4 border-moss bg-paper p-4"><Text className="font-mono text-xs uppercase text-muted">{lift} · {projection.confidence}</Text><Text className="mt-3 font-heading text-4xl text-ink">{projection.medianKg ?? "-"}<Text className="text-base"> kg</Text></Text><Text className="mt-2 font-sans text-xs text-muted">50%: {projection.lower50Kg ?? "-"}–{projection.upper50Kg ?? "-"} kg</Text><Text className="font-sans text-xs text-muted">90%: {projection.lower90Kg ?? "-"}–{projection.upper90Kg ?? "-"} kg</Text><Text className="mt-3 font-mono text-[10px] text-muted">{projection.sampleSize} recent valid session top sets</Text></View>; })}</View></View>

    <View className="bg-paper p-5"><SectionTitle icon={Video} eyebrow="Compatible samples only" title="Technique timeline" />{analyses.length ? analyses.slice(-9).reverse().map((analysis, index) => <View key={`${analysis!.analyzedAt}-${index}`} className="border-t border-fog py-3"><View className="flex-row flex-wrap justify-between gap-2"><Text className="font-heading uppercase text-ink">{analysis!.liftType}</Text><Text className={`font-mono text-xs uppercase ${analysis!.confidence === "high" ? "text-moss" : "text-muted"}`}>{analysis!.confidence} confidence</Text></View><Text className="mt-1 font-sans text-xs text-muted">{analysis!.cameraView} view · velocity {analysis!.confidence === "low" ? "withheld" : analysis!.meanConcentricVelocityMps ?? "withheld"} m/s · drift {analysis!.confidence === "low" ? "withheld" : analysis!.barPathHorizontalDriftCm ?? "withheld"} cm</Text></View>) : <Text className="font-sans text-sm text-muted">Completed squat, bench, and deadlift analyses appear here. Low-confidence measurements remain withheld.</Text>}</View>

    <MeetDayCommandCenter athleteId={athleteId} projections={projections} readiness={readiness} />

    <View className="bg-paper p-5"><SectionTitle icon={ShieldCheck} eyebrow="Revocable controls" title="Data consent" /><ToggleRow label="Operational data" detail="Required to calculate your private performance workspace." enabled={consent.operationalData} onPress={() => void updateConsent({ operationalData: !consent.operationalData })} /><ToggleRow label="Model training" detail="Opt in to de-identified future model training." enabled={consent.modelTraining} onPress={() => void updateConsent({ modelTraining: !consent.modelTraining })} /><ToggleRow label="Video model training" detail="Off by default and controlled separately." enabled={consent.videoModelTraining} onPress={() => void updateConsent({ videoModelTraining: !consent.videoModelTraining })} /><Pressable className="mt-4 min-h-11 flex-row items-center justify-center gap-2 border border-signal" onPress={() => Alert.alert("Delete performance data?", "This removes local records immediately and queues deletion of the canonical server event stream.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void performance.deleteAthleteData(athleteId) }])}><Trash2 size={16} color="#FF3B45" /><Text className="font-heading uppercase text-signal">Delete performance data</Text></Pressable></View>
  </ScrollView></AppShell>;
}