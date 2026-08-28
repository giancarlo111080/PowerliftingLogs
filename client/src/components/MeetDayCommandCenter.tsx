import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { CalendarClock, Check, CircleCheck, CircleX, Scale, Trophy } from "lucide-react-native";

import { generateWarmUps, type StrengthProjection } from "../data/adaptiveEngine";
import { attemptRiskBand, federationRule, federationRules, formatCountdown, fromKilograms, isRulesCacheStale, roundDisplayWeight, toKilograms, type MeetWeightUnit, validateAttemptSeries } from "../data/meetRules";
import { usePerformanceStore, type MeetPlan } from "../data/performanceStore";
import type { PrimaryLift } from "../lib/liftAnalysis";

const lifts: PrimaryLift[] = ["squat", "bench", "deadlift"];
const checklistItems = ["Photo ID", "Membership card", "Singlet", "Belt", "Shoes", "Knee sleeves", "Wrist wraps", "Deadlift socks", "Rack heights", "Opening attempts"];
const defaultInventory = [25, 20, 15, 10, 5, 2.5, 1.25].map((weightKg) => ({ weightKg, leftCount: weightKg >= 20 ? 4 : 2, rightCount: weightKg >= 20 ? 4 : 2 }));

interface MeetDayCommandCenterProps {
  athleteId: string;
  projections: Record<PrimaryLift, StrengthProjection>;
  readiness: number;
}

function SectionTitle({ icon: Icon, eyebrow, title }: { icon: typeof Trophy; eyebrow: string; title: string }) {
  return <View className="mb-4 flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center bg-ink"><Icon size={19} color="#FF565E" /></View><View className="flex-1"><Text className="font-mono text-[10px] uppercase text-muted">{eyebrow}</Text><Text className="font-heading text-xl uppercase text-ink">{title}</Text></View></View>;
}

function numeric(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function display(valueKg: number, unit: MeetWeightUnit) {
  return roundDisplayWeight(valueKg, unit).toString();
}

function isoDraft(value?: string) {
  return value ? value.slice(0, 16) : "";
}

function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseDateTime(value: string) {
  if (!value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function planWithoutVersion(plan: MeetPlan) {
  const { updatedAt: _, revision: __, ...input } = plan;
  return input;
}

export function MeetDayCommandCenter({ athleteId, projections, readiness }: MeetDayCommandCenterProps) {
  const performance = usePerformanceStore();
  const existingMeet = performance.meetPlans.find((item) => item.athleteId === athleteId);
  const conflict = performance.meetPlanConflicts.find((item) => item.athleteId === athleteId);
  const [displayUnit, setDisplayUnit] = useState<MeetWeightUnit>("kg");
  const [meetDate, setMeetDate] = useState("");
  const [federation, setFederation] = useState("IPF");
  const [selectedLift, setSelectedLift] = useState<PrimaryLift>("squat");
  const [target, setTarget] = useState("180");
  const [barWeight, setBarWeight] = useState("20");
  const [collarWeight, setCollarWeight] = useState("0");
  const [plateInventory, setPlateInventory] = useState(defaultInventory);
  const [flightsAway, setFlightsAway] = useState("2");
  const [liftersPerFlight, setLiftersPerFlight] = useState("14");
  const [liftersAhead, setLiftersAhead] = useState("28");
  const [weighInAt, setWeighInAt] = useState("");
  const [sessionStartAt, setSessionStartAt] = useState("");
  const [attempts, setAttempts] = useState<Record<PrimaryLift, [string, string, string]>>({ squat: ["", "", ""], bench: ["", "", ""], deadlift: ["", "", ""] });
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!existingMeet) return;
    const unit = existingMeet.displayUnit ?? "kg";
    setDisplayUnit(unit);
    setMeetDate(existingMeet.meetDate);
    setFederation(existingMeet.federation);
    setSelectedLift(existingMeet.targetLift);
    setTarget(display(existingMeet.targetKg, unit));
    setBarWeight(display(existingMeet.barWeightKg, unit));
    setCollarWeight(display(existingMeet.collarWeightKg ?? 0, unit));
    setPlateInventory(existingMeet.plateInventory?.length ? existingMeet.plateInventory : defaultInventory);
    setFlightsAway(existingMeet.flightsAway.toString());
    setLiftersPerFlight(existingMeet.liftersPerFlight.toString());
    setLiftersAhead((existingMeet.liftersAhead ?? existingMeet.flightsAway * existingMeet.liftersPerFlight).toString());
    setWeighInAt(isoDraft(existingMeet.weighInAt));
    setSessionStartAt(isoDraft(existingMeet.sessionStartAt));
    setAttempts(Object.fromEntries(lifts.map((lift) => [lift, existingMeet.attempts[lift].map((weight) => display(weight, unit))])) as Record<PrimaryLift, [string, string, string]>);
    setChecklist(existingMeet.checklist);
  }, [existingMeet]);

  const rule = federationRule(federation);
  const attemptsKg = Object.fromEntries(lifts.map((lift) => [lift, attempts[lift].map((value) => toKilograms(numeric(value), displayUnit))])) as Record<PrimaryLift, [number, number, number]>;
  const attemptErrors = Object.fromEntries(lifts.map((lift) => {
    const values = attemptsKg[lift];
    return [lift, values.some((value) => value > 0) ? validateAttemptSeries(values, rule) : []];
  })) as Record<PrimaryLift, string[]>;
  const usablePlatePairs = plateInventory.flatMap((plate) => Array.from({ length: Math.min(plate.leftCount, plate.rightCount) }, () => plate.weightKg));
  const targetKg = toKilograms(numeric(target), displayUnit);
  const warmUps = generateWarmUps(targetKg, toKilograms(numeric(barWeight), displayUnit) + toKilograms(numeric(collarWeight), displayUnit), usablePlatePairs, 5, readiness);
  const asymmetricInventory = plateInventory.some((plate) => plate.leftCount !== plate.rightCount);
  const athleteAttempts = performance.competitionAttempts.filter((item) => item.athleteId === athleteId && (!meetDate || item.meetDate === meetDate));
  const athleteResults = performance.competitionResults.filter((item) => item.athleteId === athleteId && (!meetDate || item.meetDate === meetDate));
  const ledger = [...athleteAttempts.map((item) => ({ ...item, kind: "attempt" as const })), ...athleteResults.map((item) => ({ ...item, kind: "result" as const }))].sort((left, right) => right.sequence - left.sequence);
  const estimatedMinutes = Math.max(0, numeric(liftersAhead)) * 1.2;

  function changeUnit(nextUnit: MeetWeightUnit) {
    if (nextUnit === displayUnit) return;
    const convert = (value: string) => display(toKilograms(numeric(value), displayUnit), nextUnit);
    setTarget(convert(target));
    setBarWeight(convert(barWeight));
    setCollarWeight(convert(collarWeight));
    setAttempts(Object.fromEntries(lifts.map((lift) => [lift, attempts[lift].map(convert)])) as Record<PrimaryLift, [string, string, string]>);
    setDisplayUnit(nextUnit);
  }

  async function saveMeet() {
    if (!athleteId || !validIsoDate(meetDate)) return setMessage("Enter a valid meet date as YYYY-MM-DD.");
    const weighIn = parseDateTime(weighInAt);
    const sessionStart = parseDateTime(sessionStartAt);
    if (weighIn === null || sessionStart === null) return setMessage("Use YYYY-MM-DDTHH:mm for weigh-in and session times.");
    const validationErrors = lifts.flatMap((lift) => attemptErrors[lift].map((error) => `${lift}: ${error}`));
    if (validationErrors.length) return setMessage(validationErrors[0]);
    if (plateInventory.some((plate) => plate.weightKg <= 0 || !Number.isInteger(plate.leftCount) || plate.leftCount < 0 || !Number.isInteger(plate.rightCount) || plate.rightCount < 0)) return setMessage("Plate weights must be positive and side counts must be non-negative whole numbers.");
    try {
      await performance.saveMeetPlan({ athleteId, meetDate, federation: federation.trim() || "Unspecified", targetLift: selectedLift, targetKg, barWeightKg: toKilograms(numeric(barWeight), displayUnit), collarWeightKg: toKilograms(numeric(collarWeight), displayUnit), displayUnit, plateInventory, flightsAway: Math.max(0, Math.floor(numeric(flightsAway))), liftersPerFlight: Math.max(1, Math.floor(numeric(liftersPerFlight, 1))), liftersAhead: Math.max(0, Math.floor(numeric(liftersAhead))), ...(weighIn ? { weighInAt: weighIn } : {}), ...(sessionStart ? { sessionStartAt: sessionStart } : {}), attempts: attemptsKg, checklist, ...(rule ? { rulesEffectiveDate: rule.referenceEffectiveDate, rulesCachedAt: rule.cachedAt } : {}) }, existingMeet?.revision ?? 0);
      setMessage("Meet plan saved with a new offline revision.");
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : "The meet plan could not be saved.");
    }
  }

  async function advanceLifter() {
    if (!existingMeet) return setMessage("Save the meet plan before starting live flight tracking.");
    const next = Math.max(0, (existingMeet.liftersAhead ?? numeric(liftersAhead)) - 1);
    try {
      await performance.saveMeetPlan({ ...planWithoutVersion(existingMeet), liftersAhead: next }, existingMeet.revision ?? 0);
      setLiftersAhead(next.toString());
      setMessage(next ? `${next} lifter${next === 1 ? "" : "s"} ahead.` : "You are on deck. Confirm with the expeditor.");
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : "Flight position could not be updated.");
    }
  }

  function latestAttempt(lift: PrimaryLift, attemptNumber: 1 | 2 | 3) {
    return athleteAttempts.filter((item) => item.lift === lift && item.attemptNumber === attemptNumber).sort((a, b) => b.sequence - a.sequence)[0];
  }

  async function submitAttempt(lift: PrimaryLift, attemptNumber: 1 | 2 | 3) {
    if (!validIsoDate(meetDate)) return setMessage("Save a valid meet date before submitting attempts.");
    const weightKg = attemptsKg[lift][attemptNumber - 1];
    if (!weightKg || attemptErrors[lift].length) return setMessage(attemptErrors[lift][0] ?? "Enter a valid attempt first.");
    const previous = latestAttempt(lift, attemptNumber);
    await performance.recordCompetitionAttempt({ athleteId, meetDate, lift, attemptNumber, weightKg, status: previous ? "changed" : "submitted" });
    setMessage(`${lift} attempt ${attemptNumber} ${previous ? "change" : "submission"} recorded offline.`);
  }

  async function recordResult(lift: PrimaryLift, attemptNumber: 1 | 2 | 3, outcome: "good" | "missed") {
    const attempt = latestAttempt(lift, attemptNumber);
    if (!attempt) return setMessage("Submit this attempt before recording its result.");
    await performance.recordCompetitionResult({ athleteId, attemptId: attempt.id, meetDate: attempt.meetDate, lift, attemptNumber, weightKg: attempt.weightKg, outcome });
    setMessage(`${lift} attempt ${attemptNumber} marked ${outcome}.`);
  }

  return <View className="gap-5">
    {conflict ? <View className="border border-signal bg-paper p-4"><Text className="font-heading text-lg uppercase text-signal">Meet-plan conflict</Text><Text className="mt-2 font-sans text-sm text-muted">Two devices edited revision {conflict.revision}. Choose the plan to keep; the resolution becomes revision {conflict.revision + 1}.</Text><View className="mt-3 flex-row gap-2"><Pressable className="min-h-10 flex-1 border border-ink px-3 py-2" onPress={() => void performance.resolveMeetPlanConflict(athleteId, "local")}><Text className="text-center font-heading uppercase text-ink">Keep this device</Text></Pressable><Pressable className="min-h-10 flex-1 bg-ink px-3 py-2" onPress={() => void performance.resolveMeetPlanConflict(athleteId, "remote")}><Text className="text-center font-heading uppercase text-white">Use server copy</Text></Pressable></View></View> : null}
    {message ? <View className="border border-moss bg-paper px-4 py-3"><Text className="font-sans text-sm text-ink">{message}</Text></View> : null}

    <View className="bg-paper p-5"><SectionTitle icon={Trophy} eyebrow={`Offline plan · revision ${existingMeet?.revision ?? 0}`} title="Meet-day command center" /><View className="flex-row flex-wrap gap-2">{federationRules.map((item) => <Pressable key={item.code} className={`border px-3 py-2 ${federation === item.code ? "border-ink bg-ink" : "border-fog"}`} onPress={() => setFederation(item.code)}><Text className={`font-heading uppercase ${federation === item.code ? "text-white" : "text-ink"}`}>{item.code}</Text></Pressable>)}{(["kg", "lb"] as const).map((unit) => <Pressable key={unit} className={`border px-3 py-2 ${displayUnit === unit ? "border-moss bg-moss" : "border-fog"}`} onPress={() => changeUnit(unit)}><Text className={`font-heading uppercase ${displayUnit === unit ? "text-white" : "text-ink"}`}>{unit}</Text></Pressable>)}</View><View className="mt-4 flex-row flex-wrap gap-3"><TextInput className="min-h-11 min-w-40 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={meetDate} onChangeText={setMeetDate} placeholder="Meet YYYY-MM-DD" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 min-w-48 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={weighInAt} onChangeText={setWeighInAt} placeholder="Weigh-in YYYY-MM-DDTHH:mm" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 min-w-48 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={sessionStartAt} onChangeText={setSessionStartAt} placeholder="Session YYYY-MM-DDTHH:mm" placeholderTextColor="#8996AC" /></View><View className="mt-4 flex-row flex-wrap gap-3 border-y border-fog py-4"><View className="min-w-36 flex-1"><Text className="font-mono text-[10px] uppercase text-muted">Weigh-in</Text><Text className="mt-1 font-heading text-2xl text-ink">{formatCountdown(existingMeet?.weighInAt, now)}</Text></View><View className="min-w-36 flex-1"><Text className="font-mono text-[10px] uppercase text-muted">Session start</Text><Text className="mt-1 font-heading text-2xl text-ink">{formatCountdown(existingMeet?.sessionStartAt, now)}</Text></View><View className="min-w-36 flex-1"><Text className="font-mono text-[10px] uppercase text-muted">Estimated platform call</Text><Text className="mt-1 font-heading text-2xl text-ink">{Math.round(estimatedMinutes)} min</Text></View></View>

      <View className="mt-5 gap-4">{lifts.map((lift) => <View key={lift} className="border-t border-fog pt-4"><Text className="font-heading uppercase text-ink">{lift} attempts · {displayUnit}</Text><View className="mt-2 gap-2 sm:flex-row">{attempts[lift].map((value, index) => { const attemptNumber = (index + 1) as 1 | 2 | 3; const risk = attemptRiskBand(attemptsKg[lift][index], projections[lift], attemptNumber); const submitted = latestAttempt(lift, attemptNumber); return <View key={attemptNumber} className="min-w-40 flex-1"><TextInput className="min-h-11 border border-fog bg-canvas px-3 text-center font-sans text-ink" value={value} onChangeText={(next) => setAttempts((current) => ({ ...current, [lift]: current[lift].map((item, itemIndex) => itemIndex === index ? next : item) as [string, string, string] }))} keyboardType="decimal-pad" placeholder={`Attempt ${attemptNumber}`} placeholderTextColor="#8996AC" /><View className="mt-1 flex-row items-center justify-between"><Text className={`font-mono text-[10px] uppercase ${risk === "high" ? "text-signal" : risk === "low" ? "text-moss" : "text-muted"}`}>{risk} risk</Text><Text className="font-mono text-[10px] text-muted">{submitted ? submitted.status : "not submitted"}</Text></View><Pressable className="mt-2 min-h-9 items-center justify-center border border-ink" onPress={() => void submitAttempt(lift, attemptNumber)}><Text className="font-heading uppercase text-ink">{submitted ? "Record change" : "Submit"}</Text></Pressable><View className="mt-2 flex-row gap-2"><Pressable className="h-9 flex-1 flex-row items-center justify-center gap-1 border border-moss" onPress={() => void recordResult(lift, attemptNumber, "good")} accessibilityLabel={`Mark ${lift} attempt ${attemptNumber} good`}><CircleCheck size={14} color="#2E6F5E" /><Text className="font-mono text-[10px] uppercase text-moss">Good</Text></Pressable><Pressable className="h-9 flex-1 flex-row items-center justify-center gap-1 border border-signal" onPress={() => void recordResult(lift, attemptNumber, "missed")} accessibilityLabel={`Mark ${lift} attempt ${attemptNumber} missed`}><CircleX size={14} color="#FF3B45" /><Text className="font-mono text-[10px] uppercase text-signal">Miss</Text></Pressable></View></View>; })}</View>{attemptErrors[lift][0] ? <Text className="mt-2 font-sans text-xs text-signal">{attemptErrors[lift][0]}</Text> : null}</View>)}</View>

      <View className="mt-5 flex-row flex-wrap gap-3"><View className="min-w-40 flex-1"><Text className="mb-1 font-mono text-[10px] uppercase text-muted">Flights away</Text><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-sans text-ink" value={flightsAway} onChangeText={setFlightsAway} keyboardType="number-pad" /></View><View className="min-w-40 flex-1"><Text className="mb-1 font-mono text-[10px] uppercase text-muted">Lifters per flight</Text><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-sans text-ink" value={liftersPerFlight} onChangeText={setLiftersPerFlight} keyboardType="number-pad" /></View><View className="min-w-40 flex-1"><Text className="mb-1 font-mono text-[10px] uppercase text-muted">Lifters ahead</Text><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-sans text-ink" value={liftersAhead} onChangeText={setLiftersAhead} keyboardType="number-pad" /></View><Pressable className="min-h-11 min-w-40 items-center justify-center border border-signal px-4" onPress={() => void advanceLifter()}><Text className="font-heading uppercase text-signal">Next lifter</Text></Pressable></View>

      <Text className="mt-5 font-mono text-[10px] uppercase text-muted">Equipment checklist</Text><View className="mt-2 flex-row flex-wrap gap-2">{checklistItems.map((item) => <Pressable key={item} className={`flex-row items-center gap-2 border px-3 py-2 ${checklist[item] ? "border-moss bg-moss" : "border-fog"}`} onPress={() => setChecklist((current) => ({ ...current, [item]: !current[item] }))}><Check size={14} color={checklist[item] ? "#FFFFFF" : "#52607A"} /><Text className={`font-sans text-xs ${checklist[item] ? "text-white" : "text-ink"}`}>{item}</Text></Pressable>)}</View><Pressable className="mt-5 min-h-11 items-center justify-center bg-ink" onPress={() => void saveMeet()}><Text className="font-heading uppercase text-white">Save meet revision</Text></Pressable>
    </View>

    <View className="gap-5 lg:flex-row"><View className="flex-1 bg-paper p-5"><SectionTitle icon={Scale} eyebrow="Real inventory" title="Warm-up loading" /><View className="mb-3 flex-row flex-wrap gap-2">{lifts.map((lift) => <Pressable key={lift} className={`border px-3 py-2 ${selectedLift === lift ? "border-signal bg-signal" : "border-fog"}`} onPress={() => setSelectedLift(lift)}><Text className={`font-heading uppercase ${selectedLift === lift ? "text-white" : "text-ink"}`}>{lift}</Text></Pressable>)}</View><View className="flex-row gap-2"><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-sans text-ink" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder={`Target ${displayUnit}`} placeholderTextColor="#8996AC" /><TextInput className="min-h-11 w-24 border border-fog bg-canvas px-3 font-sans text-ink" value={barWeight} onChangeText={setBarWeight} keyboardType="decimal-pad" placeholder="Bar" placeholderTextColor="#8996AC" /><TextInput className="min-h-11 w-24 border border-fog bg-canvas px-3 font-sans text-ink" value={collarWeight} onChangeText={setCollarWeight} keyboardType="decimal-pad" placeholder="Collars" placeholderTextColor="#8996AC" /></View>{warmUps.map((set, index) => <View key={`${set.loadKg}-${index}`} className="flex-row items-center border-b border-fog py-3"><Text className="w-8 font-mono text-xs text-muted">{index + 1}</Text><Text className="w-24 font-heading text-lg text-ink">{roundDisplayWeight(set.loadKg, displayUnit)} {displayUnit}</Text><Text className="w-12 font-sans text-sm text-muted">× {set.repetitions}</Text><Text className="flex-1 font-mono text-[10px] text-muted">{set.platesPerSide.length ? `${set.platesPerSide.map((plate) => roundDisplayWeight(plate, displayUnit)).join(" + ")} / side` : "bar + collars"}</Text></View>)}</View>
      <View className="flex-1 bg-paper p-5"><SectionTitle icon={Scale} eyebrow="Left and right counts" title="Plate inventory" />{plateInventory.map((plate, index) => <View key={`${plate.weightKg}-${index}`} className="flex-row items-center gap-2 border-t border-fog py-2"><TextInput className="min-h-10 w-24 border border-fog bg-canvas px-2 font-sans text-ink" value={display(plate.weightKg, displayUnit)} onChangeText={(value) => setPlateInventory((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, weightKg: toKilograms(numeric(value), displayUnit) } : item))} keyboardType="decimal-pad" accessibilityLabel={`Plate ${index + 1} weight`} /><TextInput className="min-h-10 w-16 border border-fog bg-canvas px-2 text-center font-sans text-ink" value={plate.leftCount.toString()} onChangeText={(value) => setPlateInventory((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, leftCount: Math.max(0, Math.floor(numeric(value))) } : item))} keyboardType="number-pad" accessibilityLabel={`${plate.weightKg} kilogram left plate count`} /><Text className="font-mono text-[10px] text-muted">L / R</Text><TextInput className="min-h-10 w-16 border border-fog bg-canvas px-2 text-center font-sans text-ink" value={plate.rightCount.toString()} onChangeText={(value) => setPlateInventory((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, rightCount: Math.max(0, Math.floor(numeric(value))) } : item))} keyboardType="number-pad" accessibilityLabel={`${plate.weightKg} kilogram right plate count`} /></View>)}{asymmetricInventory ? <Text className="mt-3 font-sans text-xs text-signal">Asymmetric inventory detected. Warm-ups use only complete left/right pairs.</Text> : null}</View></View>

    <View className="gap-5 lg:flex-row"><View className="flex-1 bg-paper p-5"><SectionTitle icon={CalendarClock} eyebrow="Verify with meet staff" title="Rules and deadlines" /><Text className="font-sans text-sm leading-6 text-ink">{rule?.name ?? federation}: minimum attempt increment {rule?.minimumIncrementKg ?? 2.5} kg; reference weigh-in window {rule?.weighInWindowMinutes ?? "unknown"} minutes.</Text><Text className="mt-2 font-sans text-sm leading-6 text-muted">{rule?.attemptChangeGuidance ?? "Use the current event rulebook and meet-director instructions."}</Text><Text className={`mt-3 font-mono text-xs ${isRulesCacheStale(rule, now) ? "text-signal" : "text-moss"}`}>{rule ? `Reference effective ${rule.referenceEffectiveDate} · cached ${rule.cachedAt.slice(0, 10)}` : "No cached federation reference"}{isRulesCacheStale(rule, now) ? " · stale, verify before competing" : ""}</Text></View>
      <View className="flex-1 bg-paper p-5"><SectionTitle icon={Trophy} eyebrow="Append-only offline record" title="Meet event ledger" />{ledger.length ? ledger.slice(0, 12).map((item) => <View key={`${item.kind}-${item.id}`} className="flex-row items-center justify-between gap-3 border-t border-fog py-3"><View className="flex-1"><Text className="font-sans text-sm font-bold text-ink">{item.lift} attempt {item.attemptNumber} · {roundDisplayWeight(item.weightKg, displayUnit)} {displayUnit}</Text><Text className="mt-1 font-mono text-[10px] text-muted">#{item.sequence} · {new Date(item.recordedAt).toLocaleString()}</Text></View><Text className={`font-mono text-xs uppercase ${item.kind === "result" && item.outcome === "missed" ? "text-signal" : "text-moss"}`}>{item.kind === "result" ? item.outcome : item.status}</Text></View>) : <Text className="font-sans text-sm text-muted">Attempt submissions, changes, and results will remain available offline and replay idempotently.</Text>}</View></View>
  </View>;
}