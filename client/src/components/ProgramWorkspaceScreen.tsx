import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { CalendarDays, CheckCircle2, CircleAlert, ClipboardList, Dumbbell, MessageCircle, Pencil, Plus, Save, Send, Trash2, X } from "lucide-react-native";
import { router } from "expo-router";

import { useProxySession } from "../auth/ProxySessionContext";
import { type ExerciseCategory, type ProgramExercise, type ProgramInput, type ProgramPhase, type ProgramStatus, type ProgramWeek, type PrescriptionMode, type TrainingProgram, type WeightUnit, useProgramWorkspaceStore } from "../data/programWorkspaceStore";
import { AppShell } from "./AppShell";

interface ProgramDraft {
  name: string;
  phase: ProgramPhase;
  goal: string;
  startDate: string;
  endDate: string;
  trainingDaysPerWeek: string;
  status: ProgramStatus;
}

interface DayDraft {
  name: string;
  focus: string;
}

interface ExerciseDraft {
  id: string;
  category: ExerciseCategory;
  name: string;
  sets: string;
  repetitions: string;
  prescriptionMode: PrescriptionMode;
  prescriptionValue: string;
  weightUnit: WeightUnit;
}

interface DayEditorTarget {
  weekId: string;
  dayId: string | null;
}

interface ExerciseEditorTarget {
  weekId: string;
  dayId: string;
  exerciseId: string;
}

const phases: ProgramPhase[] = ["Hypertrophy", "Strength", "Peak", "Recovery"];
const statuses: Array<{ value: ProgramStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" }
];
const exerciseCategories: Array<{ category: ExerciseCategory; label: string }> = [
  { category: "squat", label: "Squat" },
  { category: "bench", label: "Bench" },
  { category: "deadlift", label: "Deadlift" },
  { category: "accessory", label: "Accessory" }
];

function createProgramDraft(program?: TrainingProgram): ProgramDraft {
  return {
    name: program?.name ?? "",
    phase: program?.phase ?? "Strength",
    goal: program?.goal ?? "",
    startDate: program?.startDate ?? "2026-09-01",
    endDate: program?.endDate ?? "2026-09-28",
    trainingDaysPerWeek: program?.trainingDaysPerWeek.toString() ?? "4",
    status: program?.status ?? "draft"
  };
}

function createDayDraft(name = "", focus = ""): DayDraft {
  return { name, focus };
}

function createExerciseDraft(exercise: ProgramExercise): ExerciseDraft {
  return {
    id: exercise.id,
    category: exercise.category,
    name: exercise.name,
    sets: exercise.sets.toString(),
    repetitions: exercise.repetitions.toString(),
    prescriptionMode: exercise.prescriptionMode,
    prescriptionValue: exercise.prescriptionValue.toString(),
    weightUnit: exercise.weightUnit
  };
}

function statusClass(status: ProgramStatus) {
  if (status === "active") {
    return "bg-[#2E6F5E1A] text-moss";
  }
  if (status === "completed") {
    return "bg-fog text-[#52675F]";
  }
  return "bg-[#E9C46A33] text-[#8A5B00]";
}

function prescriptionLabel(exercise: ProgramExercise) {
  if (exercise.prescriptionMode === "exact") {
    return `${exercise.prescriptionValue} ${exercise.weightUnit}`;
  }
  return `${exercise.prescriptionMode.toUpperCase()} ${exercise.prescriptionValue}`;
}

function TextField({ label, value, onChangeText, placeholder, multiline = false, keyboardType = "default" }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
}) {
  return (
    <View className="flex-1 gap-1.5">
      <Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">{label}</Text>
      <TextInput
        className={`${multiline ? "min-h-24 pt-3" : "min-h-11"} border border-fog bg-canvas px-3 font-serif text-base text-ink`}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#688078"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        keyboardType={keyboardType}
        accessibilityLabel={label}
      />
    </View>
  );
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="mb-3 flex-row items-end justify-between gap-3">
      <View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{eyebrow}</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">{title}</Text></View>
      {action ? <Pressable className="min-h-10 flex-row items-center gap-2 rounded-md bg-ink px-3 py-2" onPress={action.onPress}><Plus size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">{action.label}</Text></Pressable> : null}
    </View>
  );
}

export function ProgramWorkspaceScreen() {
  const { session, currentProfile, activeAthlete } = useProxySession();
  const {
    programs,
    comments,
    isLoading,
    createProgram,
    updateProgram,
    deleteProgram,
    addWeek,
    updateWeek,
    deleteWeek,
    addDay,
    updateDay,
    deleteDay,
    addExercise,
    updateExercise,
    deleteExercise,
    addComment
  } = useProgramWorkspaceStore();
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [programEditorId, setProgramEditorId] = useState<string | null>(null);
  const [programDraft, setProgramDraft] = useState<ProgramDraft>(createProgramDraft());
  const [dayEditor, setDayEditor] = useState<DayEditorTarget | null>(null);
  const [dayDraft, setDayDraft] = useState<DayDraft>(createDayDraft());
  const [exerciseEditor, setExerciseEditor] = useState<ExerciseEditorTarget | null>(null);
  const [exerciseDraft, setExerciseDraft] = useState<ExerciseDraft | null>(null);
  const [weekEditorId, setWeekEditorId] = useState<string | null>(null);
  const [weekName, setWeekName] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<{ type: "program" | "week" | "day" | "exercise"; weekId?: string; dayId?: string; exerciseId?: string } | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const isCoach = session?.role === "coach";
  const athlete = isCoach ? activeAthlete : currentProfile;
  const athletePrograms = programs.filter((program) => program.athleteId === athlete?.id).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const selectedProgram = athletePrograms.find((program) => program.id === selectedProgramId) ?? athletePrograms.find((program) => program.status === "active") ?? athletePrograms[0] ?? null;

  if (!session || !currentProfile || !athlete) {
    return <AppShell title="Program"><View className="flex-1 items-center justify-center"><ActivityIndicator color="#2E6F5E" /></View></AppShell>;
  }

  function openProgramEditor(program?: TrainingProgram) {
    setProgramEditorId(program?.id ?? "new");
    setProgramDraft(createProgramDraft(program));
    setValidationMessage(null);
  }

  function closeProgramEditor() {
    setProgramEditorId(null);
    setValidationMessage(null);
  }

  function programInput(): ProgramInput | null {
    const trainingDaysPerWeek = Number(programDraft.trainingDaysPerWeek);
    const validDates = /^\d{4}-\d{2}-\d{2}$/.test(programDraft.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(programDraft.endDate) && programDraft.startDate <= programDraft.endDate;
    if (!programDraft.name.trim() || !programDraft.goal.trim()) {
      setValidationMessage("Program name and coaching goal are required.");
      return null;
    }
    if (!validDates) {
      setValidationMessage("Enter ISO dates and keep the end date on or after the start date.");
      return null;
    }
    if (!Number.isInteger(trainingDaysPerWeek) || trainingDaysPerWeek < 1 || trainingDaysPerWeek > 7) {
      setValidationMessage("Training days per week must be a whole number from 1 to 7.");
      return null;
    }
    return {
      name: programDraft.name.trim(),
      phase: programDraft.phase,
      goal: programDraft.goal.trim(),
      startDate: programDraft.startDate,
      endDate: programDraft.endDate,
      trainingDaysPerWeek,
      status: programDraft.status
    };
  }

  async function saveProgram() {
    const input = programInput();
    if (!input || !isCoach) {
      return;
    }
    if (programEditorId === "new") {
      await createProgram(athlete.id, input);
    }
    else if (programEditorId) {
      await updateProgram(programEditorId, input);
    }
    closeProgramEditor();
  }

  function openDayEditor(weekId: string, day?: { id: string; name: string; focus: string }) {
    setDayEditor({ weekId, dayId: day?.id ?? null });
    setDayDraft(createDayDraft(day?.name, day?.focus));
    setValidationMessage(null);
  }

  async function saveDay() {
    if (!selectedProgram || !dayEditor || !isCoach) {
      return;
    }
    if (!dayDraft.name.trim() || !dayDraft.focus.trim()) {
      setValidationMessage("Day name and workout focus are required.");
      return;
    }
    if (dayEditor.dayId) {
      await updateDay(selectedProgram.id, dayEditor.weekId, dayEditor.dayId, dayDraft);
    }
    else {
      await addDay(selectedProgram.id, dayEditor.weekId, dayDraft);
    }
    setDayEditor(null);
    setValidationMessage(null);
  }

  function openExerciseEditor(weekId: string, dayId: string, exercise: ProgramExercise) {
    setExerciseEditor({ weekId, dayId, exerciseId: exercise.id });
    setExerciseDraft(createExerciseDraft(exercise));
    setValidationMessage(null);
  }

  async function saveExercise() {
    if (!selectedProgram || !exerciseEditor || !exerciseDraft || !isCoach) {
      return;
    }
    const sets = Number(exerciseDraft.sets);
    const repetitions = Number(exerciseDraft.repetitions);
    const prescriptionValue = Number(exerciseDraft.prescriptionValue);
    if (!exerciseDraft.name.trim() || !Number.isInteger(sets) || sets < 1 || !Number.isInteger(repetitions) || repetitions < 1 || !Number.isFinite(prescriptionValue) || prescriptionValue < 0) {
      setValidationMessage("Exercise name, sets, reps, and prescription target must be valid positive values.");
      return;
    }
    await updateExercise(selectedProgram.id, exerciseEditor.weekId, exerciseEditor.dayId, {
      id: exerciseDraft.id,
      category: exerciseDraft.category,
      name: exerciseDraft.name.trim(),
      sets,
      repetitions,
      prescriptionMode: exerciseDraft.prescriptionMode,
      prescriptionValue,
      weightUnit: exerciseDraft.weightUnit
    });
    setExerciseEditor(null);
    setExerciseDraft(null);
    setValidationMessage(null);
  }

  async function submitComment(programId: string, dayId: string) {
    const body = commentDrafts[dayId]?.trim();
    if (!body) {
      return;
    }
    await addComment({
      programId,
      dayId,
      authorProfileId: currentProfile.id,
      authorName: currentProfile.displayName,
      authorRole: session.role,
      body
    });
    setCommentDrafts((drafts) => ({ ...drafts, [dayId]: "" }));
  }

  async function confirmDelete() {
    if (!selectedProgram || !pendingDelete || !isCoach) {
      return;
    }
    if (pendingDelete.type === "program") {
      await deleteProgram(selectedProgram.id);
      setSelectedProgramId(null);
    }
    if (pendingDelete.type === "week" && pendingDelete.weekId) {
      await deleteWeek(selectedProgram.id, pendingDelete.weekId);
    }
    if (pendingDelete.type === "day" && pendingDelete.weekId && pendingDelete.dayId) {
      await deleteDay(selectedProgram.id, pendingDelete.weekId, pendingDelete.dayId);
    }
    if (pendingDelete.type === "exercise" && pendingDelete.weekId && pendingDelete.dayId && pendingDelete.exerciseId) {
      await deleteExercise(selectedProgram.id, pendingDelete.weekId, pendingDelete.dayId, pendingDelete.exerciseId);
    }
    setPendingDelete(null);
  }

  function isPendingDelete(type: "program" | "week" | "day" | "exercise", identifier: string) {
    if (!pendingDelete || pendingDelete.type !== type) {
      return false;
    }
    return pendingDelete.weekId === identifier || pendingDelete.dayId === identifier || pendingDelete.exerciseId === identifier || (type === "program" && selectedProgram?.id === identifier);
  }

  function renderWeek(week: ProgramWeek) {
    const isEditingWeek = weekEditorId === week.id;
    return (
      <View key={week.id} className="border border-fog bg-paper">
        <View className="flex-col gap-3 border-b border-fog bg-canvas px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          {isEditingWeek ? <View className="flex-row items-center gap-2"><TextInput className="min-h-10 flex-1 border border-fog bg-paper px-3 font-serif text-base text-ink" value={weekName} onChangeText={setWeekName} accessibilityLabel={`Week ${week.weekNumber} name`} /><Pressable className="h-10 w-10 items-center justify-center rounded-md bg-ink" onPress={() => { void updateWeek(selectedProgram!.id, week.id, weekName); setWeekEditorId(null); }} accessibilityLabel="Save week name"><Save size={16} color="#FFFFFF" /></Pressable></View> : <View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Week {week.weekNumber}</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">{week.name}</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">{week.days.length} training day{week.days.length === 1 ? "" : "s"}</Text></View>}
          {isCoach && !isEditingWeek ? <View className="flex-row gap-2"><Pressable className="h-10 w-10 items-center justify-center rounded-md border border-fog bg-paper" onPress={() => { setWeekEditorId(week.id); setWeekName(week.name); }} accessibilityLabel={`Edit ${week.name}`}><Pencil size={16} color="#17212B" /></Pressable><Pressable className="h-10 w-10 items-center justify-center rounded-md border border-signal bg-paper" onPress={() => setPendingDelete({ type: "week", weekId: week.id })} accessibilityLabel={`Delete ${week.name}`}><Trash2 size={16} color="#D74F32" /></Pressable><Pressable className="min-h-10 flex-row items-center gap-2 rounded-md bg-ink px-3 py-2" onPress={() => openDayEditor(week.id)}><Plus size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Add day</Text></Pressable></View> : null}
        </View>
        {isPendingDelete("week", week.id) ? <View className="flex-col gap-3 border-b border-fog bg-[#D74F3212] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><Text className="font-serif text-sm text-signal">Delete this week and all of its workout days?</Text><View className="flex-row gap-2"><Pressable className="rounded-md border border-fog px-3 py-2" onPress={() => setPendingDelete(null)}><Text className="font-serif text-sm font-bold text-ink">Keep</Text></Pressable><Pressable className="rounded-md bg-signal px-3 py-2" onPress={() => void confirmDelete()}><Text className="font-serif text-sm font-bold text-white">Delete week</Text></Pressable></View></View> : null}
        {dayEditor?.weekId === week.id && !dayEditor.dayId ? <View className="border-b border-fog p-4"><Text className="font-serif text-sm font-bold text-ink">New training day</Text><View className="mt-3 flex-col gap-3 sm:flex-row"><TextField label="Day name" value={dayDraft.name} onChangeText={(value) => setDayDraft((draft) => ({ ...draft, name: value }))} placeholder="e.g. Day 3" /><TextField label="Workout focus" value={dayDraft.focus} onChangeText={(value) => setDayDraft((draft) => ({ ...draft, focus: value }))} placeholder="e.g. Bench and accessories" /></View><View className="mt-3 flex-row justify-end gap-2"><Pressable className="rounded-md border border-fog px-3 py-2" onPress={() => setDayEditor(null)}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="rounded-md bg-ink px-3 py-2" onPress={() => void saveDay()}><Text className="font-serif text-sm font-bold text-white">Add day</Text></Pressable></View></View> : null}
        {week.days.length ? week.days.map((day) => {
          const isEditingDay = dayEditor?.weekId === week.id && dayEditor.dayId === day.id;
          const dayComments = comments.filter((comment) => comment.programId === selectedProgram!.id && comment.dayId === day.id);
          const dayCommentDraft = commentDrafts[day.id] ?? "";
          return <View key={day.id} className="border-b border-fog last:border-b-0"><View className="flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"><View className="flex-1"><Text className="font-serif text-base font-bold text-ink">{day.name}</Text><Text className="mt-1 font-serif text-sm text-[#52675F]">{day.focus}</Text></View>{isCoach ? <View className="flex-row gap-2"><Pressable className="h-9 w-9 items-center justify-center rounded-md border border-fog" onPress={() => openDayEditor(week.id, day)} accessibilityLabel={`Edit ${day.name}`}><Pencil size={15} color="#17212B" /></Pressable><Pressable className="h-9 w-9 items-center justify-center rounded-md border border-signal" onPress={() => setPendingDelete({ type: "day", weekId: week.id, dayId: day.id })} accessibilityLabel={`Delete ${day.name}`}><Trash2 size={15} color="#D74F32" /></Pressable></View> : null}</View>{isPendingDelete("day", day.id) ? <View className="mx-4 mb-4 flex-col gap-3 border border-signal bg-[#D74F3212] p-3 sm:flex-row sm:items-center sm:justify-between"><Text className="font-serif text-sm text-signal">Delete this day and its prescriptions?</Text><View className="flex-row gap-2"><Pressable className="rounded-md border border-fog px-3 py-2" onPress={() => setPendingDelete(null)}><Text className="font-serif text-sm font-bold text-ink">Keep</Text></Pressable><Pressable className="rounded-md bg-signal px-3 py-2" onPress={() => void confirmDelete()}><Text className="font-serif text-sm font-bold text-white">Delete day</Text></Pressable></View></View> : null}{isEditingDay ? <View className="mx-4 mb-4 border border-fog bg-canvas p-3"><View className="flex-col gap-3 sm:flex-row"><TextField label="Day name" value={dayDraft.name} onChangeText={(value) => setDayDraft((draft) => ({ ...draft, name: value }))} /><TextField label="Workout focus" value={dayDraft.focus} onChangeText={(value) => setDayDraft((draft) => ({ ...draft, focus: value }))} /></View><View className="mt-3 flex-row justify-end gap-2"><Pressable className="rounded-md border border-fog px-3 py-2" onPress={() => setDayEditor(null)}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="rounded-md bg-ink px-3 py-2" onPress={() => void saveDay()}><Text className="font-serif text-sm font-bold text-white">Save day</Text></Pressable></View></View> : null}<View className="mx-4 mb-4 overflow-hidden border border-fog">{day.exercises.map((exercise) => <View key={exercise.id} className="border-b border-fog px-3 py-3 last:border-b-0"><View className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><View className="flex-row items-start gap-3"><View className={`mt-0.5 h-7 w-7 items-center justify-center rounded-md ${exercise.category === "accessory" ? "bg-[#E9C46A33]" : "bg-[#2E6F5E1A]"}`}><Text className="font-serif text-xs font-bold text-ink">{exercise.category === "squat" ? "S" : exercise.category === "bench" ? "B" : exercise.category === "deadlift" ? "D" : "A"}</Text></View><View><Text className="font-serif text-sm font-bold text-ink">{exercise.name}</Text><Text className="mt-0.5 font-serif text-xs text-[#52675F]">{exercise.sets} sets × {exercise.repetitions} reps · {prescriptionLabel(exercise)}</Text></View></View>{isCoach ? <View className="flex-row gap-2"><Pressable className="h-8 w-8 items-center justify-center rounded-md border border-fog" onPress={() => openExerciseEditor(week.id, day.id, exercise)} accessibilityLabel={`Edit ${exercise.name}`}><Pencil size={14} color="#17212B" /></Pressable><Pressable className="h-8 w-8 items-center justify-center rounded-md border border-signal" onPress={() => setPendingDelete({ type: "exercise", weekId: week.id, dayId: day.id, exerciseId: exercise.id })} accessibilityLabel={`Delete ${exercise.name}`}><Trash2 size={14} color="#D74F32" /></Pressable></View> : null}</View>{exerciseEditor?.exerciseId === exercise.id && exerciseDraft ? <View className="mt-3 border-t border-fog pt-3"><View className="flex-col gap-3 sm:flex-row"><TextField label="Exercise name" value={exerciseDraft.name} onChangeText={(value) => setExerciseDraft((draft) => draft ? { ...draft, name: value } : draft)} /><TextField label="Sets" value={exerciseDraft.sets} onChangeText={(value) => setExerciseDraft((draft) => draft ? { ...draft, sets: value } : draft)} keyboardType="number-pad" /><TextField label="Reps" value={exerciseDraft.repetitions} onChangeText={(value) => setExerciseDraft((draft) => draft ? { ...draft, repetitions: value } : draft)} keyboardType="number-pad" /></View><View className="mt-3"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Prescription</Text><View className="mt-2 flex-row flex-wrap gap-2">{(["rpe", "rir", "exact"] as PrescriptionMode[]).map((mode) => <Pressable key={mode} className={`rounded-md border px-3 py-2 ${exerciseDraft.prescriptionMode === mode ? "border-ink bg-ink" : "border-fog bg-canvas"}`} onPress={() => setExerciseDraft((draft) => draft ? { ...draft, prescriptionMode: mode } : draft)}><Text className={`font-serif text-sm font-bold ${exerciseDraft.prescriptionMode === mode ? "text-white" : "text-ink"}`}>{mode === "exact" ? "Exact load" : mode.toUpperCase()}</Text></Pressable>)}</View></View><View className="mt-3 flex-col gap-3 sm:flex-row"><TextField label={exerciseDraft.prescriptionMode === "exact" ? "Target load" : `Target ${exerciseDraft.prescriptionMode.toUpperCase()}`} value={exerciseDraft.prescriptionValue} onChangeText={(value) => setExerciseDraft((draft) => draft ? { ...draft, prescriptionValue: value } : draft)} keyboardType="decimal-pad" />{exerciseDraft.prescriptionMode === "exact" ? <View className="flex-1 gap-1.5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Unit</Text><View className="flex-row gap-2">{(["kg", "lb"] as WeightUnit[]).map((unit) => <Pressable key={unit} className={`min-h-11 flex-1 items-center justify-center rounded-md border ${exerciseDraft.weightUnit === unit ? "border-moss bg-moss" : "border-fog bg-canvas"}`} onPress={() => setExerciseDraft((draft) => draft ? { ...draft, weightUnit: unit } : draft)}><Text className={`font-serif text-sm font-bold ${exerciseDraft.weightUnit === unit ? "text-white" : "text-ink"}`}>{unit}</Text></Pressable>)}</View></View> : null}</View><View className="mt-3 flex-row justify-end gap-2"><Pressable className="rounded-md border border-fog px-3 py-2" onPress={() => { setExerciseEditor(null); setExerciseDraft(null); }}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="rounded-md bg-ink px-3 py-2" onPress={() => void saveExercise()}><Text className="font-serif text-sm font-bold text-white">Save prescription</Text></Pressable></View></View> : null}{isPendingDelete("exercise", exercise.id) ? <View className="mt-3 flex-col gap-3 border-t border-fog pt-3 sm:flex-row sm:items-center sm:justify-between"><Text className="font-serif text-sm text-signal">Remove this exercise?</Text><View className="flex-row gap-2"><Pressable className="rounded-md border border-fog px-3 py-2" onPress={() => setPendingDelete(null)}><Text className="font-serif text-sm font-bold text-ink">Keep</Text></Pressable><Pressable className="rounded-md bg-signal px-3 py-2" onPress={() => void confirmDelete()}><Text className="font-serif text-sm font-bold text-white">Remove</Text></Pressable></View></View> : null}</View>)}{!day.exercises.length ? <View className="px-3 py-4"><Text className="font-serif text-sm text-[#52675F]">No exercises have been prescribed for this day.</Text></View> : null}</View>{isCoach ? <View className="mx-4 mb-4"><Text className="mb-2 font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Add prescription</Text><View className="flex-row flex-wrap gap-2">{exerciseCategories.map(({ category, label }) => <Pressable key={category} className="min-h-9 flex-row items-center gap-1.5 rounded-md border border-fog bg-canvas px-3 py-2" onPress={() => void addExercise(selectedProgram!.id, week.id, day.id, category)}><Plus size={14} color="#17212B" /><Text className="font-serif text-xs font-bold text-ink">{label}</Text></Pressable>)}</View></View> : null}<View className="mx-4 mb-4 border-t border-fog pt-4"><View className="flex-row items-center gap-2"><MessageCircle size={16} color="#2E6F5E" /><Text className="font-serif text-sm font-bold text-ink">Day comments</Text></View>{dayComments.length ? <View className="mt-3 gap-3">{dayComments.map((comment) => <View key={comment.id} className={`border-l-2 pl-3 ${comment.authorRole === "coach" ? "border-signal" : "border-moss"}`}><Text className="font-serif text-xs font-bold text-ink">{comment.authorName} · {comment.authorRole === "coach" ? "Coach" : "Athlete"}</Text><Text className="mt-1 font-serif text-sm leading-5 text-[#52675F]">{comment.body}</Text></View>)}</View> : <Text className="mt-2 font-serif text-xs text-[#52675F]">No comments on this training day.</Text>}<View className="mt-3 flex-row gap-2"><TextInput className="min-h-10 flex-1 border border-fog bg-canvas px-3 font-serif text-sm text-ink" value={dayCommentDraft} onChangeText={(value) => setCommentDrafts((drafts) => ({ ...drafts, [day.id]: value }))} placeholder={isCoach ? "Leave a coaching comment" : "Add a comment for your coach"} placeholderTextColor="#688078" accessibilityLabel={`Comment on ${day.name}`} /><Pressable className="h-10 w-10 items-center justify-center rounded-md bg-ink disabled:opacity-50" onPress={() => void submitComment(selectedProgram!.id, day.id)} disabled={!dayCommentDraft.trim()} accessibilityLabel={`Post comment on ${day.name}`}><Send size={16} color="#FFFFFF" /></Pressable></View></View></View>;
        }) : <View className="items-center px-5 py-8"><Dumbbell size={23} color="#688078" /><Text className="mt-3 font-serif text-sm font-bold text-ink">No training days scheduled</Text><Text className="mt-1 text-center font-serif text-xs text-[#52675F]">{isCoach ? "Add a day, then prescribe S/B/D work or accessories." : "Your coach has not added a training day yet."}</Text></View>}
      </View>
    );
  }

  return (
    <AppShell title="Programs">
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
        <View className="flex-col gap-4 border-l-4 border-signal pl-4 sm:flex-row sm:items-end sm:justify-between"><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{isCoach ? "Coach programming" : "Your active plan"}</Text><Text className="mt-2 font-serif text-3xl font-bold text-ink">{isCoach ? `${athlete.displayName}'s program` : "Program and training days"}</Text><Text className="mt-2 font-serif text-base text-[#52675F]">{isCoach ? "Build weekly S/B/D prescriptions and accessories, then keep feedback under each day." : "Follow the coach-prescribed weeks and leave comments directly on each training day."}</Text></View>{isCoach ? <Pressable className="min-h-11 flex-row items-center justify-center gap-2 rounded-md bg-ink px-4 py-3" onPress={() => openProgramEditor()}><Plus size={18} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Create program</Text></Pressable> : null}</View>

        {validationMessage ? <View className="border border-signal bg-[#D74F3212] px-4 py-3"><Text className="font-serif text-sm text-signal">{validationMessage}</Text></View> : null}
        {isLoading ? <View className="items-center border border-fog bg-paper py-12"><ActivityIndicator color="#2E6F5E" /><Text className="mt-3 font-serif text-sm text-[#52675F]">Loading program workspace</Text></View> : null}

        {isCoach && programEditorId ? <View className="border border-fog bg-paper p-5"><View className="flex-row items-center justify-between"><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{programEditorId === "new" ? "New program" : "Edit program"}</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">Program details</Text></View><Pressable className="h-10 w-10 items-center justify-center rounded-md border border-fog" onPress={closeProgramEditor} accessibilityLabel="Close program details"><X size={18} color="#17212B" /></Pressable></View><View className="mt-5 gap-4"><TextField label="Program or meet name" value={programDraft.name} onChangeText={(value) => setProgramDraft((draft) => ({ ...draft, name: value }))} placeholder="e.g. Autumn Open Peak" /><View className="flex-col gap-4 sm:flex-row"><TextField label="Start date" value={programDraft.startDate} onChangeText={(value) => setProgramDraft((draft) => ({ ...draft, startDate: value }))} placeholder="YYYY-MM-DD" /><TextField label="End date" value={programDraft.endDate} onChangeText={(value) => setProgramDraft((draft) => ({ ...draft, endDate: value }))} placeholder="YYYY-MM-DD" /><TextField label="Training days / week" value={programDraft.trainingDaysPerWeek} onChangeText={(value) => setProgramDraft((draft) => ({ ...draft, trainingDaysPerWeek: value }))} keyboardType="number-pad" /></View><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Phase</Text><View className="mt-2 flex-row flex-wrap gap-2">{phases.map((phase) => <Pressable key={phase} className={`rounded-md border px-3 py-2 ${programDraft.phase === phase ? "border-ink bg-ink" : "border-fog bg-canvas"}`} onPress={() => setProgramDraft((draft) => ({ ...draft, phase }))}><Text className={`font-serif text-sm font-bold ${programDraft.phase === phase ? "text-white" : "text-ink"}`}>{phase}</Text></Pressable>)}</View></View><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Status</Text><View className="mt-2 flex-row flex-wrap gap-2">{statuses.map((status) => <Pressable key={status.value} className={`rounded-md border px-3 py-2 ${programDraft.status === status.value ? "border-moss bg-moss" : "border-fog bg-canvas"}`} onPress={() => setProgramDraft((draft) => ({ ...draft, status: status.value }))}><Text className={`font-serif text-sm font-bold ${programDraft.status === status.value ? "text-white" : "text-ink"}`}>{status.label}</Text></Pressable>)}</View></View><TextField label="Coaching goal" value={programDraft.goal} onChangeText={(value) => setProgramDraft((draft) => ({ ...draft, goal: value }))} multiline placeholder="What should this block accomplish?" /></View><View className="mt-5 flex-row justify-end gap-2"><Pressable className="rounded-md border border-fog px-3 py-2" onPress={closeProgramEditor}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="flex-row items-center gap-2 rounded-md bg-ink px-3 py-2" onPress={() => void saveProgram()}><Save size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Save program</Text></Pressable></View></View> : null}

        {!isLoading && athletePrograms.length ? <><View><SectionTitle eyebrow="Program library" title={isCoach ? "Plans for selected athlete" : "Available plans"} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">{athletePrograms.map((program) => <Pressable key={program.id} className={`w-56 border p-3 ${selectedProgram?.id === program.id ? "border-ink bg-ink" : "border-fog bg-paper"}`} onPress={() => setSelectedProgramId(program.id)}><Text className={`font-serif text-sm font-bold ${selectedProgram?.id === program.id ? "text-white" : "text-ink"}`}>{program.name}</Text><Text className={`mt-1 font-serif text-xs ${selectedProgram?.id === program.id ? "text-[#FFFFFFCC]" : "text-[#52675F]"}`}>{program.phase} · {program.status}</Text></Pressable>)}</ScrollView></View>{selectedProgram ? <View className="gap-5"><View className="border border-fog bg-paper p-5"><View className="flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><View className="flex-1"><View className="flex-row flex-wrap items-center gap-2"><Text className="font-serif text-2xl font-bold text-ink">{selectedProgram.name}</Text><Text className={`rounded-sm px-2 py-1 font-serif text-xs font-bold capitalize ${statusClass(selectedProgram.status)}`}>{selectedProgram.status}</Text></View><Text className="mt-2 font-serif text-sm leading-6 text-[#52675F]">{selectedProgram.goal}</Text></View>{isCoach ? <View className="flex-row gap-2"><Pressable className="h-10 w-10 items-center justify-center rounded-md border border-fog" onPress={() => openProgramEditor(selectedProgram)} accessibilityLabel={`Edit ${selectedProgram.name}`}><Pencil size={17} color="#17212B" /></Pressable><Pressable className="h-10 w-10 items-center justify-center rounded-md border border-signal" onPress={() => setPendingDelete({ type: "program" })} accessibilityLabel={`Delete ${selectedProgram.name}`}><Trash2 size={17} color="#D74F32" /></Pressable></View> : null}</View><View className="mt-5 flex-col gap-4 border-t border-fog pt-4 sm:flex-row"><View className="flex-1 flex-row items-center gap-2"><CalendarDays size={17} color="#2E6F5E" /><View><Text className="font-serif text-xs text-[#688078]">Schedule</Text><Text className="font-serif text-sm font-bold text-ink">{selectedProgram.startDate} to {selectedProgram.endDate}</Text></View></View><View className="flex-1 flex-row items-center gap-2"><ClipboardList size={17} color="#2E6F5E" /><View><Text className="font-serif text-xs text-[#688078]">Structure</Text><Text className="font-serif text-sm font-bold text-ink">{selectedProgram.weeks.length} weeks · {selectedProgram.trainingDaysPerWeek} days/week</Text></View></View></View>{isPendingDelete("program", selectedProgram.id) ? <View className="mt-5 flex-col gap-3 border-t border-fog pt-4 sm:flex-row sm:items-center sm:justify-between"><Text className="font-serif text-sm text-signal">Delete this program, all weeks, training days, and comments?</Text><View className="flex-row gap-2"><Pressable className="rounded-md border border-fog px-3 py-2" onPress={() => setPendingDelete(null)}><Text className="font-serif text-sm font-bold text-ink">Keep</Text></Pressable><Pressable className="rounded-md bg-signal px-3 py-2" onPress={() => void confirmDelete()}><Text className="font-serif text-sm font-bold text-white">Delete program</Text></Pressable></View></View> : null}</View><View><SectionTitle eyebrow="Program plan" title="Weeks and workout days" action={isCoach ? { label: "Add week", onPress: () => void addWeek(selectedProgram.id) } : undefined} /><View className="gap-4">{selectedProgram.weeks.sort((left, right) => left.weekNumber - right.weekNumber).map(renderWeek)}</View></View></View> : null}</> : !isLoading ? <View className="items-center border border-fog bg-paper px-5 py-12"><CheckCircle2 size={25} color="#2E6F5E" /><Text className="mt-3 font-serif text-base font-bold text-ink">No program assigned</Text><Text className="mt-1 text-center font-serif text-sm text-[#52675F]">{isCoach ? `Create the first program for ${athlete.displayName}.` : "Your coach has not published a program yet."}</Text>{isCoach ? <Pressable className="mt-5 flex-row items-center gap-2 rounded-md bg-ink px-4 py-3" onPress={() => openProgramEditor()}><Plus size={17} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Create program</Text></Pressable> : null}</View> : null}
      </ScrollView>
    </AppShell>
  );
}