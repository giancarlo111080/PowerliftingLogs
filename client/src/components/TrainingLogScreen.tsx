import { useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Activity, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, ExternalLink, Instagram, Link2, MessageCircle, Minus, Pencil, Plus, Send, Trash2, X } from "lucide-react-native";

import { useSession } from "../auth/AuthSessionContext";
import { type ExerciseCategory, type ProgramDay, type ProgramDaySetLog, type ProgramExercise, type ProgramSetOutcomeReason, type TrainingProgram, useProgramWorkspaceStore } from "../data/programWorkspaceStore";
import { AppShell } from "./AppShell";
import { AccessoryExercisePicker } from "./AccessoryExercisePicker";
import { InstagramLinkModal } from "./InstagramLinkModal";
import { TrainingLogSchedulePanel } from "./TrainingLogSchedulePanel";
import { VideoAnalysisModal } from "./VideoAnalysisModal";
import type { VideoAnalysisTarget } from "./VideoAnalysisModal.types";
import type { LiftVideoAnalysis, PrimaryLift } from "../lib/liftAnalysis";

interface ScheduledDay {
  weekId: string;
  weekNumber: number;
  weekName: string;
  day: ProgramDay;
}

interface InstagramTarget {
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
}

interface WorkoutDraft {
  name: string;
  focus: string;
  scheduledDate: string;
}

interface AccessoryDraft {
  name: string;
  sets: string;
  repetitions: string;
  prescriptionMode: "rpe" | "rir" | "exact";
  prescriptionValue: string;
  weightUnit: "kg" | "lb";
}

interface ExerciseDraft {
  name: string;
  sets: string;
  repetitions: string;
  prescriptionMode: ProgramExercise["prescriptionMode"];
  prescriptionValue: string;
  weightUnit: ProgramExercise["weightUnit"];
}

const missedWorkReasons: Array<{ value: ProgramSetOutcomeReason; label: string }> = [
  { value: "failed", label: "Failed" },
  { value: "interrupted", label: "Interrupted" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "pain-limited", label: "Pain limited" },
  { value: "unavailable-equipment", label: "Equipment" },
  { value: "other", label: "Other" }
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00.000Z`));
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
}

function prescriptionLabel(exercise: ProgramDay["exercises"][number]) {
  return exercise.prescriptionMode === "exact"
    ? `${exercise.prescriptionValue} ${exercise.weightUnit}`
    : `${exercise.prescriptionMode.toUpperCase()} ${exercise.prescriptionValue}`;
}

function getSetLog(logs: ProgramDaySetLog[], exerciseId: string, setNumber: number) {
  return logs.find((log) => log.exerciseId === exerciseId && log.setNumber === setNumber);
}

function analysisMetric(value: number | null, suffix: string) {
  return value === null ? "Not captured" : `${value.toFixed(1)}${suffix}`;
}

function SetStatusIcon({ status }: { status: "pending" | "done" | "skipped" }) {
  if (status === "done") {
    return <Check size={16} color="#FFFFFF" strokeWidth={3} />;
  }
  if (status === "skipped") {
    return <Minus size={16} color="#FFFFFF" strokeWidth={3} />;
  }
  return <Circle size={16} color="#688078" strokeWidth={2} />;
}

interface LiveProgramDraft {
  name: string;
  phase: TrainingProgram["phase"];
  goal: string;
  startDate: string;
  endDate: string;
  trainingDaysPerWeek: string;
}

interface LiveDayDraft {
  name: string;
  focus: string;
  scheduledDate: string;
}

interface CoachLiveLogControlsProps {
  program: TrainingProgram;
  selectedEntry: ScheduledDay | null;
  onAddWorkout: (weekId: string) => void;
  onProgramDeleted: () => void;
  onWeekDeleted: (weekId: string) => void;
  onDayDeleted: (dayId: string) => void;
}

function createLiveProgramDraft(program: TrainingProgram): LiveProgramDraft {
  return {
    name: program.name,
    phase: program.phase,
    goal: program.goal,
    startDate: program.startDate,
    endDate: program.endDate,
    trainingDaysPerWeek: program.trainingDaysPerWeek.toString()
  };
}

function CoachLiveLogControls({ program, selectedEntry, onAddWorkout, onProgramDeleted, onWeekDeleted, onDayDeleted }: CoachLiveLogControlsProps) {
  const { addWeek, updateProgram, deleteProgram, updateWeek, deleteWeek, updateDay, deleteDay } = useProgramWorkspaceStore();
  const [editing, setEditing] = useState<"program" | "week" | "day" | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<"program" | "week" | "day" | null>(null);
  const [programDraft, setProgramDraft] = useState<LiveProgramDraft>(() => createLiveProgramDraft(program));
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [weekName, setWeekName] = useState("");
  const [dayDraft, setDayDraft] = useState<LiveDayDraft>({ name: "", focus: "", scheduledDate: "" });
  const [feedback, setFeedback] = useState<string | null>(null);
  const selectedWeek = program.weeks.find((week) => week.id === selectedWeekId)
    ?? program.weeks.find((week) => week.id === selectedEntry?.weekId)
    ?? program.weeks[0]
    ?? null;

  function beginProgramEditing() {
    setProgramDraft(createLiveProgramDraft(program));
    setEditing("program");
    setFeedback(null);
  }

  function beginWeekEditing() {
    if (!selectedWeek) {
      return;
    }
    setSelectedWeekId(selectedWeek.id);
    setWeekName(selectedWeek.name);
    setEditing("week");
    setFeedback(null);
  }

  function beginDayEditing() {
    if (!selectedEntry) {
      return;
    }
    setDayDraft({ name: selectedEntry.day.name, focus: selectedEntry.day.focus, scheduledDate: selectedEntry.day.scheduledDate });
    setEditing("day");
    setFeedback(null);
  }

  async function addLiveWeek() {
    try {
      await addWeek(program.id);
      setSelectedWeekId(null);
      setFeedback("Week added. Select it below to add its workouts.");
    }
    catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Could not add a week.");
    }
  }

  async function saveProgram() {
    const trainingDaysPerWeek = Number(programDraft.trainingDaysPerWeek);
    if (!programDraft.name.trim() || !programDraft.goal.trim() || !isIsoDate(programDraft.startDate) || !isIsoDate(programDraft.endDate) || programDraft.startDate > programDraft.endDate || !Number.isInteger(trainingDaysPerWeek) || trainingDaysPerWeek < 1 || trainingDaysPerWeek > 7) {
      setFeedback("Enter a program name, goal, valid dates, and 1 to 7 training days per week.");
      return;
    }
    await updateProgram(program.id, {
      name: programDraft.name.trim(),
      phase: programDraft.phase,
      goal: programDraft.goal.trim(),
      startDate: programDraft.startDate,
      endDate: programDraft.endDate,
      trainingDaysPerWeek,
      status: program.status
    });
    setEditing(null);
    setFeedback("Program details updated.");
  }

  async function saveWeek() {
    if (!selectedWeek) {
      return;
    }
    await updateWeek(program.id, selectedWeek.id, weekName);
    setEditing(null);
    setFeedback("Week name updated.");
  }

  async function saveDay() {
    if (!selectedEntry || !dayDraft.name.trim() || !isIsoDate(dayDraft.scheduledDate)) {
      setFeedback("Enter a workout name and date as YYYY-MM-DD.");
      return;
    }
    await updateDay(program.id, selectedEntry.weekId, selectedEntry.day.id, dayDraft);
    setEditing(null);
    setFeedback("Workout updated.");
  }

  async function confirmRemoval() {
    try {
      if (pendingRemoval === "program") {
        await deleteProgram(program.id);
        onProgramDeleted();
        return;
      }
      if (pendingRemoval === "week" && selectedWeek) {
        await deleteWeek(program.id, selectedWeek.id);
        onWeekDeleted(selectedWeek.id);
        setSelectedWeekId(null);
        setFeedback("Week removed.");
      }
      if (pendingRemoval === "day" && selectedEntry) {
        await deleteDay(program.id, selectedEntry.weekId, selectedEntry.day.id);
        onDayDeleted(selectedEntry.day.id);
        setFeedback("Workout removed.");
      }
      setPendingRemoval(null);
    }
    catch (reason) {
      setPendingRemoval(null);
      setFeedback(reason instanceof Error ? reason.message : "Could not remove this item.");
    }
  }

  return (
    <View className="border border-fog bg-paper">
      <View className="flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <View>
          <Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Coach log controls</Text>
          <Text className="mt-1 font-serif text-lg font-bold text-ink">Edit this athlete&apos;s live plan</Text>
        </View>
        <View className="flex-row flex-wrap justify-end gap-2">
          <Pressable className="min-h-10 flex-row items-center gap-2 border border-fog bg-canvas px-3 py-2" onPress={() => void addLiveWeek()} accessibilityLabel="Add program week">
            <Plus size={16} color="#F5F7FB" />
            <Text className="font-serif text-sm font-bold text-ink">Week</Text>
          </Pressable>
          <Pressable className="min-h-10 flex-row items-center gap-2 border border-fog bg-canvas px-3 py-2 disabled:opacity-40" onPress={() => selectedWeek && onAddWorkout(selectedWeek.id)} disabled={!selectedWeek || selectedWeek.days.length >= 7} accessibilityLabel={selectedWeek?.days.length === 7 ? "Maximum 7 workouts reached for selected week" : "Add workout to selected week"}>
            <Plus size={16} color="#F5F7FB" />
            <Text className="font-serif text-sm font-bold text-ink">Workout</Text>
          </Pressable>
          <Pressable className="h-10 w-10 items-center justify-center border border-fog bg-canvas" onPress={beginProgramEditing} accessibilityLabel={`Edit ${program.name}`}>
            <Pencil size={17} color="#F5F7FB" />
          </Pressable>
          <Pressable className="min-h-10 flex-row items-center gap-2 border border-signal bg-canvas px-3 py-2" onPress={() => { setPendingRemoval("program"); setEditing(null); }} accessibilityLabel={`Remove ${program.name}`}>
            <Trash2 size={17} color="#FF3B45" />
            <Text className="font-serif text-sm font-bold text-signal">Remove</Text>
          </Pressable>
        </View>
      </View>

      <Modal transparent animationType="fade" visible={pendingRemoval !== null} onRequestClose={() => setPendingRemoval(null)}>
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className="w-full max-w-md border border-fog bg-paper p-5">
            <Text className="font-serif text-xs font-bold uppercase tracking-widest text-signal">Confirm removal</Text>
            <Text className="mt-2 font-heading text-2xl uppercase text-ink">Remove this {pendingRemoval === "day" ? "workout" : pendingRemoval}?</Text>
            <Text className="mt-3 font-serif text-sm leading-6 text-muted">This removes the selected {pendingRemoval === "day" ? "workout" : pendingRemoval} and its related training data. This action cannot be undone.</Text>
            <View className="mt-5 flex-row justify-end gap-2"><Pressable className="min-h-11 border border-fog px-4 py-3" onPress={() => setPendingRemoval(null)}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="min-h-11 bg-signal px-4 py-3" onPress={() => void confirmRemoval()}><Text className="font-serif text-sm font-bold text-white">Remove</Text></Pressable></View>
          </View>
        </View>
      </Modal>
      {feedback ? <View className="border-t border-fog px-4 py-3"><Text className="font-serif text-sm text-muted">{feedback}</Text></View> : null}

      {editing === "program" ? <View className="border-t border-fog px-4 py-4"><Text className="font-serif text-sm font-bold text-ink">Program details</Text><View className="mt-3 gap-3"><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={programDraft.name} onChangeText={(name) => setProgramDraft((draft) => ({ ...draft, name }))} placeholder="Program name" placeholderTextColor="#8996AC" accessibilityLabel="Program name" /><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={programDraft.goal} onChangeText={(goal) => setProgramDraft((draft) => ({ ...draft, goal }))} placeholder="Coaching goal" placeholderTextColor="#8996AC" accessibilityLabel="Coaching goal" /><View className="flex-col gap-3 sm:flex-row"><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={programDraft.startDate} onChangeText={(startDate) => setProgramDraft((draft) => ({ ...draft, startDate }))} placeholder="Start YYYY-MM-DD" placeholderTextColor="#8996AC" accessibilityLabel="Program start date" /><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={programDraft.endDate} onChangeText={(endDate) => setProgramDraft((draft) => ({ ...draft, endDate }))} placeholder="End YYYY-MM-DD" placeholderTextColor="#8996AC" accessibilityLabel="Program end date" /><TextInput className="min-h-11 w-full border border-fog bg-canvas px-3 font-serif text-base text-ink sm:w-36" value={programDraft.trainingDaysPerWeek} onChangeText={(trainingDaysPerWeek) => setProgramDraft((draft) => ({ ...draft, trainingDaysPerWeek }))} placeholder="Days/week" placeholderTextColor="#8996AC" keyboardType="number-pad" accessibilityLabel="Training days per week" /></View><View className="flex-row flex-wrap gap-2">{(["Hypertrophy", "Strength", "Peak", "Recovery"] as const).map((phase) => <Pressable key={phase} className={`border px-3 py-2 ${programDraft.phase === phase ? "border-signal bg-signal/10" : "border-fog bg-canvas"}`} onPress={() => setProgramDraft((draft) => ({ ...draft, phase }))}><Text className={`font-serif text-sm font-bold ${programDraft.phase === phase ? "text-ink" : "text-muted"}`}>{phase}</Text></Pressable>)}</View><View className="flex-row justify-end gap-2"><Pressable className="min-h-10 border border-fog px-3 py-2" onPress={() => setEditing(null)}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="min-h-10 bg-ink px-3 py-2" onPress={() => void saveProgram()}><Text className="font-serif text-sm font-bold text-white">Save program</Text></Pressable></View></View></View> : null}

      {program.weeks.length ? <View className="border-t border-fog px-4 py-4"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Week controls</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="mt-3 gap-2">{[...program.weeks].sort((left, right) => left.weekNumber - right.weekNumber).map((week) => <Pressable key={week.id} className={`border px-3 py-2 ${selectedWeek?.id === week.id ? "border-signal bg-signal/10" : "border-fog bg-canvas"}`} onPress={() => { setSelectedWeekId(week.id); setEditing(null); }} accessibilityLabel={`Select ${week.name}`}><Text className={`font-serif text-sm font-bold ${selectedWeek?.id === week.id ? "text-ink" : "text-muted"}`}>W{week.weekNumber}</Text></Pressable>)}</ScrollView>{selectedWeek ? <View className="mt-3 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><View className="flex-1">{editing === "week" ? <TextInput className="min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={weekName} onChangeText={setWeekName} accessibilityLabel={`Week ${selectedWeek.weekNumber} name`} /> : <><Text className="font-serif text-base font-bold text-ink">{selectedWeek.name}</Text><Text className="mt-1 font-serif text-xs text-muted">{selectedWeek.days.length} workout{selectedWeek.days.length === 1 ? "" : "s"}</Text></>}</View><View className="flex-row gap-2">{editing === "week" ? <><Pressable className="min-h-10 border border-fog px-3 py-2" onPress={() => setEditing(null)}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="min-h-10 bg-ink px-3 py-2" onPress={() => void saveWeek()}><Text className="font-serif text-sm font-bold text-white">Save week</Text></Pressable></> : <><Pressable className="h-10 w-10 items-center justify-center border border-fog bg-canvas" onPress={beginWeekEditing} accessibilityLabel={`Rename ${selectedWeek.name}`}><Pencil size={16} color="#F5F7FB" /></Pressable><Pressable className="h-10 w-10 items-center justify-center border border-signal bg-canvas" onPress={() => { setPendingRemoval("week"); setEditing(null); }} accessibilityLabel={`Remove ${selectedWeek.name}`}><Trash2 size={16} color="#FF3B45" /></Pressable></>}</View></View> : null}</View> : null}

      {selectedEntry ? <View className="border-t border-fog px-4 py-4"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Workout controls</Text><View className="mt-3 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><View className="flex-1">{editing === "day" ? <View className="gap-3"><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={dayDraft.name} onChangeText={(name) => setDayDraft((draft) => ({ ...draft, name }))} placeholder="Workout name" placeholderTextColor="#8996AC" accessibilityLabel="Workout name" /><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={dayDraft.focus} onChangeText={(focus) => setDayDraft((draft) => ({ ...draft, focus }))} placeholder="Workout focus" placeholderTextColor="#8996AC" accessibilityLabel="Workout focus" /><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={dayDraft.scheduledDate} onChangeText={(scheduledDate) => setDayDraft((draft) => ({ ...draft, scheduledDate }))} placeholder="YYYY-MM-DD" placeholderTextColor="#8996AC" accessibilityLabel="Workout date" /></View> : <><Text className="font-serif text-base font-bold text-ink">{selectedEntry.day.name}</Text><Text className="mt-1 font-serif text-xs text-muted">{formatDate(selectedEntry.day.scheduledDate)}</Text></>}</View><View className="flex-row gap-2">{editing === "day" ? <><Pressable className="min-h-10 border border-fog px-3 py-2" onPress={() => setEditing(null)}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="min-h-10 bg-ink px-3 py-2" onPress={() => void saveDay()}><Text className="font-serif text-sm font-bold text-white">Save workout</Text></Pressable></> : <><Pressable className="h-10 w-10 items-center justify-center border border-fog bg-canvas" onPress={beginDayEditing} accessibilityLabel={`Edit ${selectedEntry.day.name}`}><Pencil size={16} color="#F5F7FB" /></Pressable><Pressable className="h-10 w-10 items-center justify-center border border-signal bg-canvas" onPress={() => { setPendingRemoval("day"); setEditing(null); }} accessibilityLabel={`Remove ${selectedEntry.day.name}`}><Trash2 size={16} color="#FF3B45" /></Pressable></>}</View></View></View> : null}
    </View>
  );
}

export function TrainingLogScreen() {
  const { session, currentProfile, activeAthlete } = useSession();
  const { programs, comments, dayLogs, isLoading, addDay, addExercise, updateExercise, deleteExercise, logDaySet, updateDaySetInstagramLink, updateDaySetVideoAnalysis, updateDayRating, addComment } = useProgramWorkspaceStore();
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [actualWeightDrafts, setActualWeightDrafts] = useState<Record<string, string>>({});
  const [setResultDraft, setSetResultDraft] = useState({ repetitions: "", rpe: "", velocity: "", restSeconds: "", outcomeReason: "" as ProgramSetOutcomeReason | "" });
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [instagramTarget, setInstagramTarget] = useState<InstagramTarget | null>(null);
  const [isVideoAnalysisOpen, setIsVideoAnalysisOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isAddingWorkout, setIsAddingWorkout] = useState(false);
  const [workoutDraft, setWorkoutDraft] = useState<WorkoutDraft>({ name: "", focus: "", scheduledDate: "" });
  const [workoutWeekId, setWorkoutWeekId] = useState<string | null>(null);
  const [isAddingAccessory, setIsAddingAccessory] = useState(false);
  const [isChoosingAccessory, setIsChoosingAccessory] = useState(false);
  const [accessoryDraft, setAccessoryDraft] = useState<AccessoryDraft>({ name: "", sets: "3", repetitions: "10", prescriptionMode: "rir", prescriptionValue: "2", weightUnit: "kg" });
  const [editingExercise, setEditingExercise] = useState<ProgramExercise | null>(null);
  const [exerciseDraft, setExerciseDraft] = useState<ExerciseDraft | null>(null);
  const [exercisePendingRemoval, setExercisePendingRemoval] = useState<ProgramExercise | null>(null);
  const [collapsedExerciseIds, setCollapsedExerciseIds] = useState<Record<string, boolean>>({});

  const isCoach = session?.role === "COACH";
  const athlete = isCoach ? activeAthlete : currentProfile;
  const isAthletesCoach = Boolean(isCoach && activeAthlete?.coachId === currentProfile?.userId);
  const athletePrograms = programs.filter((program) => program.athleteId === athlete?.id).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const selectedProgram = athletePrograms.find((program) => program.id === selectedProgramId) ?? athletePrograms.find((program) => program.status === "active") ?? athletePrograms[0] ?? null;
  const scheduledDays: ScheduledDay[] = selectedProgram
    ? [...selectedProgram.weeks].sort((left, right) => left.weekNumber - right.weekNumber).flatMap((week) => [...week.days].sort((left, right) => left.sequence - right.sequence).map((day) => ({ weekId: week.id, weekNumber: week.weekNumber, weekName: week.name, day })))
    : [];
  const selectedDayIndex = Math.max(0, scheduledDays.findIndex((entry) => entry.day.id === selectedDayId));
  const selectedEntry = scheduledDays[selectedDayIndex] ?? null;
  const dayLog = selectedEntry && selectedProgram ? dayLogs.find((entry) => entry.programId === selectedProgram.id && entry.dayId === selectedEntry.day.id) : undefined;
  const selectedDayComments = selectedEntry && selectedProgram ? comments.filter((comment) => comment.programId === selectedProgram.id && comment.dayId === selectedEntry.day.id).sort((left, right) => left.createdAt.localeCompare(right.createdAt)) : [];
  const commentDraft = selectedEntry ? commentDrafts[selectedEntry.day.id] ?? "" : "";
  const analysisTargets: VideoAnalysisTarget[] = selectedEntry ? selectedEntry.day.exercises.filter((exercise) => exercise.category !== "accessory").flatMap((exercise) => Array.from({ length: exercise.sets }, (_, index) => {
    const setNumber = index + 1;
    const existingAnalysis = getSetLog(dayLog?.sets ?? [], exercise.id, setNumber)?.videoAnalysis;
    return { exerciseId: exercise.id, exerciseName: exercise.name, liftType: exercise.category as PrimaryLift, prescribedRepetitions: exercise.repetitions, setNumber, videoAnalysis: existingAnalysis?.liftType === exercise.category ? existingAnalysis : undefined };
  })) : [];
  const savedAnalysisTargets = analysisTargets.filter((target) => Boolean(target.videoAnalysis));

  if (!session || !currentProfile) {
    return <AppShell title="Training Log"><View className="flex-1 items-center justify-center"><ActivityIndicator color="#2E6F5E" /></View></AppShell>;
  }
  if (isCoach && !activeAthlete) {
    return <AppShell title="Training Log"><View className="flex-1 items-center justify-center px-5"><Text className="font-serif text-lg font-bold text-ink">No athlete selected</Text><Text className="mt-2 max-w-md text-center font-serif text-sm leading-6 text-muted">Link an athlete to this coach account, or select an available athlete from the sidebar.</Text></View></AppShell>;
  }
  if (!athlete) {
    return null;
  }

  function selectProgram(program: TrainingProgram) {
    setSelectedProgramId(program.id);
    setSelectedDayId(null);
    setMessage(null);
  }

  function selectDay(dayId: string) {
    setSelectedDayId(dayId);
    setMessage(null);
  }

  function isExerciseCollapsed(exerciseId: string) {
    if (!isCoach) {
      return false;
    }
    return collapsedExerciseIds[exerciseId] ?? true;
  }

  function toggleExerciseCollapse(exerciseId: string) {
    setCollapsedExerciseIds((current) => ({ ...current, [exerciseId]: !(current[exerciseId] ?? true) }));
  }

  function openWorkoutCreator(weekId?: string) {
    if (!selectedProgram) {
      return;
    }
    const targetWeekId = weekId ?? selectedEntry?.weekId ?? selectedProgram.weeks[0]?.id;
    if (!targetWeekId) {
      setMessage("Add a week before adding a workout.");
      return;
    }
    const targetWeek = selectedProgram.weeks.find((week) => week.id === targetWeekId);
    if (targetWeek && targetWeek.days.length >= 7) {
      setMessage("A training week can contain no more than 7 days.");
      setIsAddingWorkout(false);
      return;
    }
    setWorkoutDraft({ name: "", focus: "", scheduledDate: selectedEntry?.day.scheduledDate ?? selectedProgram.startDate });
    setWorkoutWeekId(targetWeekId);
    setIsAddingWorkout(true);
    setIsAddingAccessory(false);
  }

  async function saveWorkout() {
    if (!isCoach || !selectedProgram) {
      return;
    }
    const weekId = workoutWeekId ?? selectedEntry?.weekId ?? selectedProgram.weeks[0]?.id;
    if (!weekId) {
      setMessage("Add a week in Programs before adding a workout.");
      return;
    }
    const targetWeek = selectedProgram.weeks.find((week) => week.id === weekId);
    if (targetWeek && targetWeek.days.length >= 7) {
      setMessage("A training week can contain no more than 7 days.");
      setIsAddingWorkout(false);
      return;
    }
    if (!workoutDraft.name.trim() || !isIsoDate(workoutDraft.scheduledDate)) {
      setMessage("Enter a workout name and date as YYYY-MM-DD.");
      return;
    }
    try {
      const createdDay = await addDay(selectedProgram.id, weekId, workoutDraft);
      setSelectedDayId(createdDay.id);
      setIsAddingWorkout(false);
      setWorkoutWeekId(null);
      setMessage(`${createdDay.name} added to the training log.`);
    }
    catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not add this workout.");
    }
  }

  function openAccessoryCreator() {
    if (!selectedEntry) {
      setMessage("Choose a training day before adding an accessory.");
      return;
    }
    setAccessoryDraft({ name: "", sets: "3", repetitions: "10", prescriptionMode: "rir", prescriptionValue: "2", weightUnit: "kg" });
    setIsChoosingAccessory(true);
    setIsAddingAccessory(false);
    setIsAddingWorkout(false);
  }

  async function addPrimaryLift(category: Exclude<ExerciseCategory, "accessory">) {
    if (!isAthletesCoach || !selectedProgram || !selectedEntry) return;
    try {
      const exercise = await addExercise(selectedProgram.id, selectedEntry.weekId, selectedEntry.day.id, category);
      setMessage(`${exercise.name} added to ${selectedEntry.day.name}.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : `Could not add ${category}.`);
    }
  }

  function beginExerciseEditing(exercise: ProgramExercise) {
    setEditingExercise(exercise);
    setExerciseDraft({ name: exercise.name, sets: exercise.sets.toString(), repetitions: exercise.repetitions.toString(), prescriptionMode: exercise.prescriptionMode, prescriptionValue: exercise.prescriptionValue.toString(), weightUnit: exercise.weightUnit });
  }

  async function saveExercise() {
    if (!isAthletesCoach || !selectedProgram || !selectedEntry || !editingExercise || !exerciseDraft) return;
    const sets = Number(exerciseDraft.sets);
    const repetitions = Number(exerciseDraft.repetitions);
    const prescriptionValue = Number(exerciseDraft.prescriptionValue);
    if (!exerciseDraft.name.trim() || !Number.isInteger(sets) || sets < 1 || !Number.isInteger(repetitions) || repetitions < 1 || !Number.isFinite(prescriptionValue) || prescriptionValue < 0) {
      setMessage("Enter an exercise name, positive whole-number sets and reps, and a valid prescription target.");
      return;
    }
    try {
      await updateExercise(selectedProgram.id, selectedEntry.weekId, selectedEntry.day.id, { ...editingExercise, name: exerciseDraft.name.trim(), sets, repetitions, prescriptionMode: exerciseDraft.prescriptionMode, prescriptionValue, weightUnit: exerciseDraft.weightUnit });
      setEditingExercise(null);
      setExerciseDraft(null);
      setMessage("Exercise updated.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not update this exercise.");
    }
  }

  async function confirmExerciseRemoval() {
    if (!isAthletesCoach || !selectedProgram || !selectedEntry || !exercisePendingRemoval) return;
    try {
      await deleteExercise(selectedProgram.id, selectedEntry.weekId, selectedEntry.day.id, exercisePendingRemoval.id);
      setMessage(`${exercisePendingRemoval.name} removed.`);
      setExercisePendingRemoval(null);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not remove this exercise.");
      setExercisePendingRemoval(null);
    }
  }

  async function saveAccessory() {
    if (!isCoach || !selectedProgram || !selectedEntry) {
      return;
    }
    const sets = Number(accessoryDraft.sets);
    const repetitions = Number(accessoryDraft.repetitions);
    const prescriptionValue = Number(accessoryDraft.prescriptionValue);
    if (!accessoryDraft.name.trim() || !Number.isInteger(sets) || sets < 1 || !Number.isInteger(repetitions) || repetitions < 1 || !Number.isFinite(prescriptionValue) || prescriptionValue < 0) {
      setMessage("Enter an accessory name, whole-number sets and reps, and a valid prescription target.");
      return;
    }
    try {
      await addExercise(selectedProgram.id, selectedEntry.weekId, selectedEntry.day.id, "accessory", {
        name: accessoryDraft.name.trim(),
        sets,
        repetitions,
        prescriptionMode: accessoryDraft.prescriptionMode,
        prescriptionValue,
        weightUnit: accessoryDraft.weightUnit
      });
      setIsAddingAccessory(false);
      setMessage(`${accessoryDraft.name.trim()} added to ${selectedEntry.day.name}.`);
    }
    catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not add this accessory.");
    }
  }

  function weightDraftKey(exerciseId: string, setNumber: number) {
    return `${selectedEntry?.day.id ?? "day"}-${exerciseId}-${setNumber}`;
  }

  async function updateSet(exercise: ProgramDay["exercises"][number], setNumber: number, completionStatus: "pending" | "done" | "skipped") {
    if (!selectedProgram || !selectedEntry || isCoach) {
      return;
    }
    const existingSetLog = getSetLog(dayLog?.sets ?? [], exercise.id, setNumber);
    const weightValue = actualWeightDrafts[weightDraftKey(exercise.id, setNumber)] ?? existingSetLog?.actualWeight?.toString() ?? "";
    const actualWeight = Number(weightValue);
    if (completionStatus === "done" && exercise.prescriptionMode !== "exact" && (!Number.isFinite(actualWeight) || actualWeight <= 0)) {
      setMessage(`Enter the weight lifted for set ${setNumber} before marking it done.`);
      return;
    }
    if (completionStatus === "skipped" && !setResultDraft.outcomeReason) {
      setMessage(`Choose why set ${setNumber} was not completed.`);
      return;
    }
    const actualRepetitions = setResultDraft.repetitions.trim() ? Number(setResultDraft.repetitions) : exercise.repetitions;
    const actualRpe = setResultDraft.rpe.trim() ? Number(setResultDraft.rpe) : undefined;
    const meanVelocityMps = setResultDraft.velocity.trim() ? Number(setResultDraft.velocity) : undefined;
    const restSeconds = setResultDraft.restSeconds.trim() ? Number(setResultDraft.restSeconds) : undefined;
    try {
      await logDaySet(selectedProgram.id, selectedEntry.day.id, exercise.id, setNumber, completionStatus, completionStatus === "done" && exercise.prescriptionMode !== "exact" ? actualWeight : undefined, exercise.weightUnit, completionStatus === "pending" ? undefined : { actualRepetitions, actualRpe, meanVelocityMps, restSeconds, outcomeReason: completionStatus === "skipped" ? setResultDraft.outcomeReason || undefined : undefined });
      if (completionStatus !== "pending") setSetResultDraft({ repetitions: "", rpe: "", velocity: "", restSeconds: "", outcomeReason: "" });
      setMessage(completionStatus === "done" ? `Set ${setNumber} logged.` : completionStatus === "skipped" ? `Set ${setNumber} marked skipped.` : `Set ${setNumber} returned to pending.`);
    }
    catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not update this set.");
    }
  }

  async function saveInstagramLink(instagramVideoUrl: string) {
    if (!selectedProgram || !selectedEntry || !instagramTarget) {
      return;
    }
    await updateDaySetInstagramLink(selectedProgram.id, selectedEntry.day.id, instagramTarget.exerciseId, instagramTarget.setNumber, instagramVideoUrl);
    setMessage("Instagram link added to this set.");
  }

  async function saveVideoAnalysis(target: VideoAnalysisTarget, videoAnalysis: LiftVideoAnalysis) {
    if (!selectedProgram || !selectedEntry) {
      return;
    }
    await updateDaySetVideoAnalysis(selectedProgram.id, selectedEntry.day.id, target.exerciseId, target.setNumber, videoAnalysis);
    setMessage(`${target.exerciseName}, set ${target.setNumber} now has a local video analysis.`);
  }

  async function saveRating(rating: number) {
    if (!selectedProgram || !selectedEntry || isCoach) {
      return;
    }
    const nextRating = dayLog?.sessionRating === rating ? null : rating;
    await updateDayRating(selectedProgram.id, selectedEntry.day.id, nextRating);
    setMessage(nextRating ? `Session rating saved: ${nextRating}/10.` : "Session rating cleared.");
  }

  async function submitComment() {
    if (!selectedProgram || !selectedEntry || !currentProfile || !session || !commentDraft.trim()) {
      return;
    }
    await addComment({ programId: selectedProgram.id, dayId: selectedEntry.day.id, authorProfileId: currentProfile.id, authorName: currentProfile.displayName, authorRole: session.role === "COACH" ? "coach" : "lifter", body: commentDraft.trim() });
    setCommentDrafts((drafts) => ({ ...drafts, [selectedEntry.day.id]: "" }));
  }

  return (
    <AppShell title="Training Log">
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-6 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
        <View className="flex-col gap-3 border-l-4 border-signal pl-4 sm:flex-row sm:items-end sm:justify-between"><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{isCoach ? "Athlete training log" : "Your program"}</Text><Text className="mt-2 font-serif text-3xl font-bold text-ink">{isCoach ? `${athlete.displayName}'s workouts` : "Training Log"}</Text><Text className="mt-2 font-serif text-base text-[#52675F]">{isCoach ? "Navigate every workout, review actual loads and footage, then leave feedback in context." : "Every scheduled workout, actual set, video, rating, and coach note lives here."}</Text></View>{selectedProgram ? <View className="flex-row items-center gap-2"><CalendarDays size={18} color="#2E6F5E" /><Text className="font-serif text-sm font-bold text-ink">{scheduledDays.length} workout{scheduledDays.length === 1 ? "" : "s"}</Text></View> : null}</View>
        {selectedEntry && selectedProgram ? <TrainingLogSchedulePanel key={selectedEntry.day.id} programId={selectedProgram.id} weekId={selectedEntry.weekId} weekName={selectedEntry.weekName} day={selectedEntry.day} actorRole={session.role === "COACH" ? "coach" : "lifter"} /> : null}
        {selectedEntry && !isCoach ? <View className="border border-fog bg-paper p-4"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Next set result</Text><Text className="mt-1 font-serif text-sm text-muted">These values apply when you mark the next set done or skipped. Reps default to the prescription.</Text><View className="mt-3 flex-row flex-wrap gap-2"><TextInput className="min-h-10 min-w-28 flex-1 border border-fog bg-canvas px-3 font-serif text-ink" value={setResultDraft.repetitions} onChangeText={(repetitions) => setSetResultDraft((draft) => ({ ...draft, repetitions }))} keyboardType="number-pad" placeholder="Actual reps" placeholderTextColor="#8996AC" accessibilityLabel="Actual repetitions" /><TextInput className="min-h-10 min-w-28 flex-1 border border-fog bg-canvas px-3 font-serif text-ink" value={setResultDraft.rpe} onChangeText={(rpe) => setSetResultDraft((draft) => ({ ...draft, rpe }))} keyboardType="decimal-pad" placeholder="Actual RPE" placeholderTextColor="#8996AC" accessibilityLabel="Actual RPE" /><TextInput className="min-h-10 min-w-28 flex-1 border border-fog bg-canvas px-3 font-serif text-ink" value={setResultDraft.velocity} onChangeText={(velocity) => setSetResultDraft((draft) => ({ ...draft, velocity }))} keyboardType="decimal-pad" placeholder="Velocity m/s" placeholderTextColor="#8996AC" accessibilityLabel="Mean velocity metres per second" /><TextInput className="min-h-10 min-w-28 flex-1 border border-fog bg-canvas px-3 font-serif text-ink" value={setResultDraft.restSeconds} onChangeText={(restSeconds) => setSetResultDraft((draft) => ({ ...draft, restSeconds }))} keyboardType="number-pad" placeholder="Rest seconds" placeholderTextColor="#8996AC" accessibilityLabel="Rest time in seconds" /></View><Text className="mt-4 font-serif text-xs font-bold uppercase tracking-widest text-muted">If skipped, choose why</Text><View className="mt-2 flex-row flex-wrap gap-2">{missedWorkReasons.map((reason) => <Pressable key={reason.value} className={`border px-3 py-2 ${setResultDraft.outcomeReason === reason.value ? "border-signal bg-signal" : "border-fog bg-canvas"}`} onPress={() => setSetResultDraft((draft) => ({ ...draft, outcomeReason: draft.outcomeReason === reason.value ? "" : reason.value }))} accessibilityRole="radio" accessibilityState={{ selected: setResultDraft.outcomeReason === reason.value }}><Text className={`font-serif text-xs font-bold ${setResultDraft.outcomeReason === reason.value ? "text-white" : "text-ink"}`}>{reason.label}</Text></Pressable>)}</View></View> : null}
        {selectedEntry && selectedProgram && analysisTargets.length ? <View className="border border-fog bg-paper p-4"><View className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><View className="flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Technique review</Text><Text className="mt-1 font-serif text-lg font-bold text-ink">Analyze original lift footage</Text><Text className="mt-1 font-serif text-sm leading-6 text-muted">Browser-local AI pose analysis supports squat, bench, and deadlift sets. Accessories are excluded. The source video is never uploaded or saved.</Text></View><Pressable className="min-h-11 flex-row items-center justify-center gap-2 bg-ink px-4 py-3" onPress={() => setIsVideoAnalysisOpen(true)} accessibilityLabel="Analyze a lift video"><Activity size={17} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Analyze lift</Text></Pressable></View>{savedAnalysisTargets.length ? <View className="mt-4 flex-row flex-wrap gap-2 border-t border-fog pt-4">{savedAnalysisTargets.map((target) => <View key={`${target.exerciseId}-${target.setNumber}`} className="min-w-44 flex-1 border border-fog bg-canvas px-3 py-2"><Text className="font-serif text-xs font-bold text-ink">{target.exerciseName} · Set {target.setNumber}</Text><Text className="mt-1 font-mono text-xs text-muted">{analysisMetric(target.videoAnalysis?.meanConcentricVelocityMps ?? null, " m/s")} · Est. RPE {analysisMetric(target.videoAnalysis?.confidence === "low" ? null : target.videoAnalysis?.estimatedRpe ?? null, "")}</Text></View>)}</View> : null}</View> : null}
        {isAthletesCoach && selectedProgram ? <CoachLiveLogControls program={selectedProgram} selectedEntry={selectedEntry} onAddWorkout={openWorkoutCreator} onProgramDeleted={() => { setSelectedProgramId(null); setSelectedDayId(null); setMessage("Live program removed."); }} onWeekDeleted={(weekId) => { if (selectedEntry?.weekId === weekId) setSelectedDayId(null); setMessage("Week removed from the live program."); }} onDayDeleted={(dayId) => { if (selectedEntry?.day.id === dayId) setSelectedDayId(null); setMessage("Workout removed from the live program."); }} /> : null}
        {message ? <View className="border border-moss bg-[#2E6F5E12] px-4 py-3"><Text className="font-serif text-sm text-moss">{message}</Text></View> : null}
        {isLoading ? <View className="items-center border border-fog bg-paper py-12"><ActivityIndicator color="#2E6F5E" /><Text className="mt-3 font-serif text-sm text-[#52675F]">Loading training logs</Text></View> : null}

        {!isLoading && athletePrograms.length ? <><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Program</Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="mt-2 gap-2">
  {athletePrograms.map((program) => (
    <Pressable 
      key={program.id} 
      className={`w-64 border p-3 flex-row justify-between items-center ${selectedProgram?.id === program.id ? "border-ink bg-ink" : "border-fog bg-paper"}`} 
      onPress={() => selectProgram(program)}
    >
      <View className="flex-1 pr-2">
        <Text className={`font-serif text-sm font-bold ${selectedProgram?.id === program.id ? "text-white" : "text-ink"}`}>{program.name}</Text>
        <Text className={`mt-1 font-serif text-xs ${selectedProgram?.id === program.id ? "text-[#FFFFFFCC]" : "text-[#52675F]"}`}>{program.phase} · {program.status}</Text>
      </View>
      
      {/* Action buttons visible ONLY to the Coach of the athlete */}
      {isAthletesCoach && (
        <View className="flex-row gap-1">
          <Pressable 
            className="p-1.5 rounded border border-fog bg-canvas/20 active:opacity-70"
            onPress={(e) => {
              e.stopPropagation(); // Avoid triggering selectProgram
              // Opens programmatic editor mode from controls
              setSelectedProgramId(program.id);
            }}
          >
            <Pencil size={12} color={selectedProgram?.id === program.id ? "#FFFFFF" : "#17212B"} />
          </Pressable>
          <Pressable 
            className="p-1.5 rounded border border-red-900 bg-red-950/20 active:opacity-70"
            onPress={(e) => {
              e.stopPropagation(); // Avoid triggering selectProgram
              setSelectedProgramId(program.id);
              // Leverages the built-in modal confirmation inside CoachLiveLogControls
              setMessage("Use the standard Coach Log Controls panel below to securely execute program deletions.");
            }}
          >
            <Trash2 size={12} color="#FF3B45" />
          </Pressable>
        </View>
      )}
    </Pressable>
  ))}
</ScrollView>
</View>
          {!selectedEntry && selectedProgram && isCoach ? <View className="border border-fog bg-paper p-4"><View className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Build this log</Text><Text className="mt-1 font-serif text-lg font-bold text-ink">Add the first workout</Text><Text className="mt-1 font-serif text-sm text-[#52675F]">Create a dated day in {selectedProgram.weeks[0]?.name ?? "the first week"}, then add its prescriptions.</Text></View>{!isAddingWorkout ? <Pressable className="min-h-10 flex-row items-center justify-center gap-2 rounded-md bg-ink px-3 py-2" onPress={() => openWorkoutCreator()} accessibilityLabel="Add the first workout"><Plus size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Add workout</Text></Pressable> : null}</View>{isAddingWorkout ? <View className="mt-4 border-t border-fog pt-4"><View className="flex-col gap-3 sm:flex-row"><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={workoutDraft.name} onChangeText={(value) => setWorkoutDraft((draft) => ({ ...draft, name: value }))} placeholder="Workout name, e.g. Day 1" placeholderTextColor="#688078" accessibilityLabel="Workout name" /><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={workoutDraft.scheduledDate} onChangeText={(value) => setWorkoutDraft((draft) => ({ ...draft, scheduledDate: value }))} placeholder="YYYY-MM-DD" placeholderTextColor="#688078" accessibilityLabel="Workout date" /></View><TextInput className="mt-3 min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={workoutDraft.focus} onChangeText={(value) => setWorkoutDraft((draft) => ({ ...draft, focus: value }))} placeholder="Workout focus" placeholderTextColor="#688078" accessibilityLabel="Workout focus" /><View className="mt-3 flex-row justify-end gap-2"><Pressable className="rounded-md border border-fog px-3 py-2" onPress={() => setIsAddingWorkout(false)}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="rounded-md bg-ink px-3 py-2" onPress={() => void saveWorkout()}><Text className="font-serif text-sm font-bold text-white">Add workout</Text></Pressable></View></View> : null}</View> : null}
          {selectedEntry && selectedProgram ? <><View><View className="mb-2 flex-row items-center justify-between"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">All training days</Text><Text className="font-serif text-xs text-[#52675F]">Week {selectedEntry.weekNumber} of {selectedProgram.weeks.length}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">{scheduledDays.map((entry) => <Pressable key={entry.day.id} className={`w-36 border p-3 ${entry.day.id === selectedEntry.day.id ? "border-ink bg-ink" : "border-fog bg-paper"}`} onPress={() => selectDay(entry.day.id)} accessibilityLabel={`Open ${entry.weekName}, ${entry.day.name}`}><Text className={`font-serif text-xs font-bold ${entry.day.id === selectedEntry.day.id ? "text-[#FFFFFFCC]" : "text-[#688078]"}`}>Week {entry.weekNumber}</Text><Text className={`mt-1 font-serif text-sm font-bold ${entry.day.id === selectedEntry.day.id ? "text-white" : "text-ink"}`}>{entry.day.name}</Text><Text className={`mt-1 font-serif text-xs ${entry.day.id === selectedEntry.day.id ? "text-[#FFFFFFCC]" : "text-[#52675F]"}`}>{formatDate(entry.day.scheduledDate)}</Text></Pressable>)}</ScrollView></View>
            <View className="flex-col gap-4 border-y border-fog bg-canvas py-5 sm:flex-row sm:items-center sm:justify-between"><View className="flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{selectedEntry.weekName} · {formatDate(selectedEntry.day.scheduledDate)}</Text><Text className="mt-1 font-serif text-2xl font-bold text-ink">{selectedEntry.day.name}</Text><Text className="mt-1 font-serif text-sm leading-6 text-[#52675F]">{selectedEntry.day.focus}</Text></View><View className="flex-row flex-wrap gap-2">{isAthletesCoach ? <>{(["squat", "bench", "deadlift"] as const).map((category) => <Pressable key={category} className="min-h-10 flex-row items-center gap-2 rounded-md bg-ink px-3 py-2" onPress={() => void addPrimaryLift(category)} accessibilityLabel={`Add ${category} to selected workout`}><Plus size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold capitalize text-white">{category}</Text></Pressable>)}<Pressable className="min-h-10 flex-row items-center gap-2 rounded-md border border-fog bg-paper px-3 py-2" onPress={openAccessoryCreator} accessibilityLabel="Add accessory to selected workout"><Plus size={16} color="#17212B" /><Text className="font-serif text-sm font-bold text-ink">Accessories</Text></Pressable></> : null}<Pressable className="h-10 w-10 items-center justify-center rounded-md border border-fog bg-paper disabled:opacity-40" disabled={selectedDayIndex === 0} onPress={() => selectDay(scheduledDays[selectedDayIndex - 1].day.id)} accessibilityLabel="Open previous training day"><ChevronLeft size={18} color="#17212B" /></Pressable><Pressable className="h-10 w-10 items-center justify-center rounded-md border border-fog bg-paper disabled:opacity-40" disabled={selectedDayIndex === scheduledDays.length - 1} onPress={() => selectDay(scheduledDays[selectedDayIndex + 1].day.id)} accessibilityLabel="Open next training day"><ChevronRight size={18} color="#17212B" /></Pressable></View></View>
            {isCoach && isAddingWorkout ? <View className="border border-fog bg-paper p-4"><View className="flex-row items-center justify-between"><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">New workout</Text><Text className="mt-1 font-serif text-lg font-bold text-ink">Add to {selectedEntry.weekName}</Text></View><Pressable className="h-9 w-9 items-center justify-center rounded-md border border-fog" onPress={() => setIsAddingWorkout(false)} accessibilityLabel="Close new workout form"><X size={17} color="#17212B" /></Pressable></View><View className="mt-4 flex-col gap-3 sm:flex-row"><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={workoutDraft.name} onChangeText={(value) => setWorkoutDraft((draft) => ({ ...draft, name: value }))} placeholder="Workout name, e.g. Day 3" placeholderTextColor="#688078" accessibilityLabel="Workout name" /><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={workoutDraft.scheduledDate} onChangeText={(value) => setWorkoutDraft((draft) => ({ ...draft, scheduledDate: value }))} placeholder="YYYY-MM-DD" placeholderTextColor="#688078" accessibilityLabel="Workout date" /></View><TextInput className="mt-3 min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={workoutDraft.focus} onChangeText={(value) => setWorkoutDraft((draft) => ({ ...draft, focus: value }))} placeholder="Workout focus" placeholderTextColor="#688078" accessibilityLabel="Workout focus" /><View className="mt-3 flex-row justify-end gap-2"><Pressable className="rounded-md border border-fog px-3 py-2" onPress={() => setIsAddingWorkout(false)}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="rounded-md bg-ink px-3 py-2" onPress={() => void saveWorkout()}><Text className="font-serif text-sm font-bold text-white">Add workout</Text></Pressable></View></View> : null}
            {isCoach && isAddingAccessory ? <View className="border border-fog bg-paper p-4"><View className="flex-row items-center justify-between"><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Accessory prescription</Text><Text className="mt-1 font-serif text-lg font-bold text-ink">Add to {selectedEntry.day.name}</Text></View><Pressable className="h-9 w-9 items-center justify-center rounded-md border border-fog" onPress={() => setIsAddingAccessory(false)} accessibilityLabel="Close accessory form"><X size={17} color="#17212B" /></Pressable></View><TextInput className="mt-4 min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={accessoryDraft.name} onChangeText={(value) => setAccessoryDraft((draft) => ({ ...draft, name: value }))} placeholder="Accessory name, e.g. Chest-supported row" placeholderTextColor="#688078" accessibilityLabel="Accessory name" /><View className="mt-3 flex-col gap-3 sm:flex-row"><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={accessoryDraft.sets} onChangeText={(value) => setAccessoryDraft((draft) => ({ ...draft, sets: value }))} keyboardType="number-pad" placeholder="Sets" placeholderTextColor="#688078" accessibilityLabel="Accessory sets" /><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={accessoryDraft.repetitions} onChangeText={(value) => setAccessoryDraft((draft) => ({ ...draft, repetitions: value }))} keyboardType="number-pad" placeholder="Reps" placeholderTextColor="#688078" accessibilityLabel="Accessory repetitions" /><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={accessoryDraft.prescriptionValue} onChangeText={(value) => setAccessoryDraft((draft) => ({ ...draft, prescriptionValue: value }))} keyboardType="decimal-pad" placeholder="Target" placeholderTextColor="#688078" accessibilityLabel="Accessory prescription target" /></View><View className="mt-3 flex-row flex-wrap gap-2">{(["rpe", "rir", "exact"] as const).map((mode) => <Pressable key={mode} className={`rounded-md border px-3 py-2 ${accessoryDraft.prescriptionMode === mode ? "border-ink bg-ink" : "border-fog bg-canvas"}`} onPress={() => setAccessoryDraft((draft) => ({ ...draft, prescriptionMode: mode }))}><Text className={`font-serif text-sm font-bold ${accessoryDraft.prescriptionMode === mode ? "text-white" : "text-ink"}`}>{mode.toUpperCase()}</Text></Pressable>)}{(["kg", "lb"] as const).map((unit) => <Pressable key={unit} className={`rounded-md border px-3 py-2 ${accessoryDraft.weightUnit === unit ? "border-moss bg-[#2E6F5E1A]" : "border-fog bg-canvas"}`} onPress={() => setAccessoryDraft((draft) => ({ ...draft, weightUnit: unit }))}><Text className="font-serif text-sm font-bold text-ink">{unit}</Text></Pressable>)}</View><View className="mt-3 flex-row justify-end gap-2"><Pressable className="rounded-md border border-fog px-3 py-2" onPress={() => setIsAddingAccessory(false)}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="rounded-md bg-ink px-3 py-2" onPress={() => void saveAccessory()}><Text className="font-serif text-sm font-bold text-white">Add accessory</Text></Pressable></View></View> : null}
            <View className="border border-fog bg-paper p-4"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Session rating</Text><View className="mt-2 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><View><Text className="font-serif text-lg font-bold text-ink">{dayLog?.sessionRating ? `${dayLog.sessionRating} / 10` : "Not rated"}</Text><Text className="mt-1 font-serif text-sm text-[#52675F]">{isCoach ? "Athlete-reported effort for future stress management." : "Rate how demanding this session felt after you train."}</Text></View>{isCoach ? null : <View className="flex-row flex-wrap gap-1.5">{Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => <Pressable key={rating} className={`h-9 w-9 items-center justify-center rounded-md border ${dayLog?.sessionRating === rating ? "border-ink bg-ink" : "border-fog bg-canvas"}`} onPress={() => void saveRating(rating)} accessibilityLabel={`Rate this session ${rating} out of 10`}><Text className={`font-serif text-sm font-bold ${dayLog?.sessionRating === rating ? "text-white" : "text-ink"}`}>{rating}</Text></Pressable>)}</View>}</View></View>
            {selectedEntry.day.exercises.length ? selectedEntry.day.exercises.map((exercise) => {
              const collapsed = isExerciseCollapsed(exercise.id);
              return <View key={exercise.id} className="border border-fog bg-paper">
                <View className="flex-col gap-3 border-b border-fog px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <View className="flex-1">
                    <Text className="font-serif text-lg font-bold text-ink">{exercise.name}</Text>
                    <Text className="mt-1 font-serif text-sm text-[#52675F]">{exercise.sets} sets · {exercise.repetitions} reps · {prescriptionLabel(exercise)}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{exercise.category}</Text>
                    {isCoach ? <Pressable className="min-h-9 flex-row items-center gap-1 rounded-md border border-fog bg-canvas px-2 py-1.5" onPress={() => toggleExerciseCollapse(exercise.id)} accessibilityLabel={`${collapsed ? "Expand" : "Collapse"} ${exercise.name}`}>
                      <Text className="font-serif text-xs font-bold text-ink">{collapsed ? "Expand" : "Collapse"}</Text>
                      {collapsed ? <ChevronDown size={14} color="#17212B" /> : <ChevronUp size={14} color="#17212B" />}
                    </Pressable> : null}
                    {isAthletesCoach ? <>
                      <Pressable className="h-9 w-9 items-center justify-center rounded-md border border-fog bg-canvas" onPress={() => beginExerciseEditing(exercise)} accessibilityLabel={`Edit ${exercise.name}`}>
                        <Pencil size={15} color="#17212B" />
                      </Pressable>
                      <Pressable className="h-9 w-9 items-center justify-center rounded-md border border-signal bg-canvas" onPress={() => setExercisePendingRemoval(exercise)} accessibilityLabel={`Remove ${exercise.name}`}>
                        <Trash2 size={15} color="#FF3B45" />
                      </Pressable>
                    </> : null}
                  </View>
                </View>
                {isAthletesCoach && editingExercise?.id === exercise.id && exerciseDraft ? <View className="gap-3 border-b border-fog bg-canvas p-4"><TextInput className="min-h-11 border border-fog bg-paper px-3 font-serif text-base text-ink" value={exerciseDraft.name} onChangeText={(name) => setExerciseDraft((draft) => draft ? { ...draft, name } : draft)} accessibilityLabel="Exercise name" /><View className="flex-row flex-wrap gap-3"><TextInput className="min-h-11 min-w-24 flex-1 border border-fog bg-paper px-3 font-serif text-base text-ink" value={exerciseDraft.sets} onChangeText={(sets) => setExerciseDraft((draft) => draft ? { ...draft, sets } : draft)} keyboardType="number-pad" placeholder="Sets" accessibilityLabel="Exercise sets" /><TextInput className="min-h-11 min-w-24 flex-1 border border-fog bg-paper px-3 font-serif text-base text-ink" value={exerciseDraft.repetitions} onChangeText={(repetitions) => setExerciseDraft((draft) => draft ? { ...draft, repetitions } : draft)} keyboardType="number-pad" placeholder="Reps" accessibilityLabel="Exercise repetitions" /><TextInput className="min-h-11 min-w-24 flex-1 border border-fog bg-paper px-3 font-serif text-base text-ink" value={exerciseDraft.prescriptionValue} onChangeText={(prescriptionValue) => setExerciseDraft((draft) => draft ? { ...draft, prescriptionValue } : draft)} keyboardType="decimal-pad" placeholder="Target" accessibilityLabel="Exercise prescription target" /></View><View className="flex-row flex-wrap justify-between gap-2"><View className="flex-row flex-wrap gap-2">{(["rpe", "rir", "percent", "exact"] as const).map((mode) => <Pressable key={mode} className={`rounded-md border px-3 py-2 ${exerciseDraft.prescriptionMode === mode ? "border-ink bg-ink" : "border-fog bg-paper"}`} onPress={() => setExerciseDraft((draft) => draft ? { ...draft, prescriptionMode: mode } : draft)}><Text className={`font-serif text-xs font-bold uppercase ${exerciseDraft.prescriptionMode === mode ? "text-white" : "text-ink"}`}>{mode}</Text></Pressable>)}</View><View className="flex-row gap-2"><Pressable className="rounded-md border border-fog px-3 py-2" onPress={() => { setEditingExercise(null); setExerciseDraft(null); }}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="rounded-md bg-ink px-3 py-2" onPress={() => void saveExercise()}><Text className="font-serif text-sm font-bold text-white">Save</Text></Pressable></View></View></View> : null}
                {!collapsed ? Array.from({ length: exercise.sets }, (_, index) => {
              const setNumber = index + 1;
              const setLog = getSetLog(dayLog?.sets ?? [], exercise.id, setNumber);
              const status = setLog?.completionStatus ?? "pending";
              const weightKey = weightDraftKey(exercise.id, setNumber);
              const actualWeight = actualWeightDrafts[weightKey] ?? setLog?.actualWeight?.toString() ?? "";
              const needsActualWeight = exercise.prescriptionMode !== "exact";
              return <View key={setNumber} className="gap-3 border-b border-fog px-4 py-4 last:border-b-0"><View className="flex-row items-center gap-3"><Text className="w-7 font-serif text-sm font-bold text-ink">{setNumber}</Text><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{exercise.repetitions} reps · {prescriptionLabel(exercise)}</Text><Text className="mt-1 font-serif text-xs text-[#688078]">{status === "done" ? `Logged${setLog?.actualWeight ? ` · ${setLog.actualWeight} ${setLog.weightUnit}` : ""}` : status === "skipped" ? "Skipped" : needsActualWeight ? `Enter actual ${exercise.weightUnit} to complete` : "Exact prescribed load"}</Text></View>{isCoach ? <Text className={`font-serif text-xs font-bold ${status === "done" ? "text-moss" : status === "skipped" ? "text-signal" : "text-[#52675F]"}`}>{status === "pending" ? "Pending" : status === "done" ? "Done" : "Skipped"}</Text> : <View className="flex-row gap-2"><Pressable className={`h-9 w-9 items-center justify-center rounded-md border ${status === "done" ? "border-moss bg-moss" : "border-fog bg-paper"}`} onPress={() => void updateSet(exercise, setNumber, status === "done" ? "pending" : "done")} accessibilityLabel={`${status === "done" ? "Clear" : "Mark"} set ${setNumber} done`}><SetStatusIcon status={status === "done" ? "done" : "pending"} /></Pressable><Pressable className={`h-9 w-9 items-center justify-center rounded-md border ${status === "skipped" ? "border-signal bg-signal" : "border-fog bg-paper"}`} onPress={() => void updateSet(exercise, setNumber, status === "skipped" ? "pending" : "skipped")} accessibilityLabel={`${status === "skipped" ? "Clear" : "Mark"} set ${setNumber} skipped`}><SetStatusIcon status={status === "skipped" ? "skipped" : "pending"} /></Pressable></View>}</View>{!isCoach && needsActualWeight ? <TextInput className="min-h-10 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={actualWeight} onChangeText={(value) => setActualWeightDrafts((drafts) => ({ ...drafts, [weightKey]: value }))} keyboardType="decimal-pad" placeholder={`Actual weight in ${exercise.weightUnit}`} placeholderTextColor="#688078" accessibilityLabel={`Actual weight for set ${setNumber} of ${exercise.name}`} /> : null}<View className="flex-row items-center justify-between">{setLog?.instagramVideoUrl ? <Pressable className="flex-row items-center gap-1.5" onPress={() => Linking.openURL(setLog.instagramVideoUrl!)} accessibilityLabel={`Open Instagram video for set ${setNumber}`}><Instagram size={16} color="#D74F32" /><Text className="font-serif text-sm font-bold text-signal">Instagram linked</Text><ExternalLink size={14} color="#D74F32" /></Pressable> : <Text className="font-serif text-sm text-[#688078]">No video linked</Text>}{isCoach ? null : <Pressable className="flex-row items-center gap-1.5 rounded-md bg-canvas px-3 py-2" onPress={() => setInstagramTarget({ exerciseId: exercise.id, exerciseName: exercise.name, setNumber })} accessibilityLabel={`Add Instagram link for set ${setNumber}`}><Link2 size={15} color="#17212B" /><Text className="font-serif text-sm font-bold text-ink">Instagram</Text></Pressable>}</View></View>;
                }) : null}
              </View>;
            }) : <View className="items-center border border-fog bg-paper px-5 py-10"><Text className="font-serif text-base font-bold text-ink">No exercises prescribed</Text><Text className="mt-1 text-center font-serif text-sm text-[#52675F]">{isCoach ? "Add prescriptions from Programs before this training day begins." : "Your coach has not added exercises to this day yet."}</Text></View>}
            <View className="border border-fog bg-paper p-4"><View className="flex-row items-center gap-2"><MessageCircle size={18} color="#2E6F5E" /><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Day comments</Text><Text className="mt-1 font-serif text-lg font-bold text-ink">Notes for {selectedEntry.day.name}</Text></View></View><View className="mt-4 gap-3">{selectedDayComments.length ? selectedDayComments.map((comment) => <View key={comment.id} className={`border px-3 py-3 ${comment.authorRole === "coach" ? "border-[#2E6F5E55] bg-[#2E6F5E0D]" : "border-fog bg-canvas"}`}><View className="flex-row items-center justify-between gap-3"><Text className="font-serif text-sm font-bold text-ink">{comment.authorName}</Text><Text className="font-serif text-xs text-[#688078]">{comment.authorRole === "coach" ? "Coach" : "Athlete"}</Text></View><Text className="mt-2 font-serif text-sm leading-6 text-[#52675F]">{comment.body}</Text></View>) : <Text className="font-serif text-sm text-[#52675F]">No notes on this training day yet.</Text>}</View><View className="mt-4"><TextInput className="min-h-20 border border-fog bg-canvas p-3 font-serif text-base text-ink" value={commentDraft} onChangeText={(value) => setCommentDrafts((drafts) => ({ ...drafts, [selectedEntry.day.id]: value }))} placeholder={isCoach ? "Leave a coaching note for this day" : "Leave a note for your coach"} placeholderTextColor="#688078" multiline textAlignVertical="top" accessibilityLabel="Day comment" /><View className="mt-3 flex-row justify-end"><Pressable className="min-h-10 flex-row items-center gap-2 rounded-md bg-ink px-3 py-2 disabled:opacity-50" onPress={() => void submitComment()} disabled={!commentDraft.trim()} accessibilityLabel="Post day comment"><Send size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Post comment</Text></Pressable></View></View></View>
          </> : <View className="items-center border border-fog bg-paper px-5 py-12"><CalendarDays size={25} color="#688078" /><Text className="mt-3 font-serif text-base font-bold text-ink">No training days in this program</Text></View>}</> : null}
        {!isLoading && !athletePrograms.length ? <View className="items-center border border-fog bg-paper px-5 py-12"><CalendarDays size={25} color="#688078" /><Text className="mt-3 font-serif text-base font-bold text-ink">No training program available</Text><Text className="mt-1 text-center font-serif text-sm text-[#52675F]">{isCoach ? "Create a program for the selected athlete before opening logs." : "Your coach has not assigned a program yet."}</Text></View> : null}
      </ScrollView>
      <Modal transparent animationType="fade" visible={exercisePendingRemoval !== null} onRequestClose={() => setExercisePendingRemoval(null)}><View className="flex-1 items-center justify-center bg-black/60 px-5"><View className="w-full max-w-md border border-fog bg-paper p-5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-signal">Confirm removal</Text><Text className="mt-2 font-heading text-2xl uppercase text-ink">Remove exercise?</Text><Text className="mt-3 font-serif text-sm leading-6 text-muted">Remove {exercisePendingRemoval?.name ?? "this exercise"} and its set data from this workout? This action cannot be undone.</Text><View className="mt-5 flex-row justify-end gap-2"><Pressable className="min-h-11 border border-fog px-4 py-3" onPress={() => setExercisePendingRemoval(null)}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="min-h-11 bg-signal px-4 py-3" onPress={() => void confirmExerciseRemoval()}><Text className="font-serif text-sm font-bold text-white">Remove</Text></Pressable></View></View></View></Modal>
      {isChoosingAccessory ? <AccessoryExercisePicker
        value={accessoryDraft.name}
        openOnMount
        onClose={() => setIsChoosingAccessory(false)}
        onSelect={(name) => {
          setAccessoryDraft((draft) => ({ ...draft, name }));
          setIsAddingAccessory(true);
        }}
      /> : null}
      <InstagramLinkModal visible={instagramTarget !== null} exerciseName={instagramTarget ? `${instagramTarget.exerciseName} · set ${instagramTarget.setNumber}` : ""} onClose={() => setInstagramTarget(null)} onSave={saveInstagramLink} />
      <VideoAnalysisModal visible={isVideoAnalysisOpen} targets={analysisTargets} onClose={() => setIsVideoAnalysisOpen(false)} onSave={saveVideoAnalysis} />
    </AppShell>
  );
}