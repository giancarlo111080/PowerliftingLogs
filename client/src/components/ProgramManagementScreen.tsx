import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { CalendarDays, CheckCircle2, CircleAlert, ClipboardList, Pencil, Plus, Save, Trash2, X } from "lucide-react-native";
import { router } from "expo-router";

import { useProxySession } from "../auth/ProxySessionContext";
import { type ProgramInput, type ProgramPhase, type ProgramStatus, type TrainingProgram, useProgramStore } from "../data/programStore";
import { AppShell } from "./AppShell";

interface ProgramDraft {
  name: string;
  phase: ProgramPhase;
  goal: string;
  startDate: string;
  endDate: string;
  trainingDaysPerWeek: string;
  exercises: string;
  status: ProgramStatus;
}

const phases: ProgramPhase[] = ["Hypertrophy", "Strength", "Peak", "Recovery"];
const statuses: Array<{ value: ProgramStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" }
];

function createDraft(program?: TrainingProgram): ProgramDraft {
  return {
    name: program?.name ?? "",
    phase: program?.phase ?? "Strength",
    goal: program?.goal ?? "",
    startDate: program?.startDate ?? "2026-09-01",
    endDate: program?.endDate ?? "2026-09-28",
    trainingDaysPerWeek: program?.trainingDaysPerWeek.toString() ?? "4",
    exercises: program?.exercises.join("\n") ?? "Competition Squat\nBench Press\nCompetition Deadlift",
    status: program?.status ?? "draft"
  };
}

function dateRange(program: TrainingProgram) {
  return `${program.startDate} to ${program.endDate}`;
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

function Field({ label, value, onChangeText, placeholder, multiline = false, keyboardType = "default" }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View className="flex-1 gap-1.5">
      <Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">{label}</Text>
      <TextInput
        className={`${multiline ? "min-h-28 pt-3" : "min-h-11"} border border-fog bg-canvas px-3 font-serif text-base text-ink`}
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

export function ProgramManagementScreen() {
  const { session, activeAthlete } = useProxySession();
  const { programs, isLoading, createProgram, updateProgram, deleteProgram } = useProgramStore();
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProgramDraft>(createDraft());
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [programPendingDelete, setProgramPendingDelete] = useState<string | null>(null);

  if (session?.role !== "coach") {
    return (
      <AppShell title="Programs">
        <View className="flex-1 items-center justify-center px-6"><CircleAlert size={28} color="#D74F32" /><Text className="mt-4 font-serif text-xl font-bold text-ink">Coach access required</Text><Text className="mt-2 text-center font-serif text-sm text-[#52675F]">Only coaches can create and manage athlete programs.</Text><Pressable className="mt-5 rounded-md bg-ink px-4 py-3" onPress={() => router.replace("/dashboard")}><Text className="font-serif text-sm font-bold text-white">Return to dashboard</Text></Pressable></View>
      </AppShell>
    );
  }

  const athletePrograms = programs.filter((program) => program.athleteId === activeAthlete?.id).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const isEditorOpen = editingProgramId !== null;

  function updateDraft(field: keyof ProgramDraft, value: string | ProgramPhase | ProgramStatus) {
    setDraft((current) => ({ ...current, [field]: value } as ProgramDraft));
  }

  function beginCreate() {
    setEditingProgramId("new");
    setDraft(createDraft());
    setValidationMessage(null);
    setProgramPendingDelete(null);
  }

  function beginEdit(program: TrainingProgram) {
    setEditingProgramId(program.id);
    setDraft(createDraft(program));
    setValidationMessage(null);
    setProgramPendingDelete(null);
  }

  function closeEditor() {
    setEditingProgramId(null);
    setValidationMessage(null);
  }

  function draftToInput(): ProgramInput | null {
    const trainingDaysPerWeek = Number(draft.trainingDaysPerWeek);
    const exercises = draft.exercises.split("\n").map((exercise) => exercise.trim()).filter(Boolean);
    const hasValidDates = /^\d{4}-\d{2}-\d{2}$/.test(draft.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(draft.endDate) && draft.startDate <= draft.endDate;

    if (!draft.name.trim() || !draft.goal.trim()) {
      setValidationMessage("Program name and coaching goal are required.");
      return null;
    }
    if (!hasValidDates) {
      setValidationMessage("Use valid ISO dates and keep the end date on or after the start date.");
      return null;
    }
    if (!Number.isInteger(trainingDaysPerWeek) || trainingDaysPerWeek < 1 || trainingDaysPerWeek > 7) {
      setValidationMessage("Training days per week must be a whole number from 1 to 7.");
      return null;
    }
    if (!exercises.length) {
      setValidationMessage("Add at least one focus exercise.");
      return null;
    }

    return {
      name: draft.name.trim(),
      phase: draft.phase,
      goal: draft.goal.trim(),
      startDate: draft.startDate,
      endDate: draft.endDate,
      trainingDaysPerWeek,
      exercises,
      status: draft.status
    };
  }

  async function saveProgram() {
    const input = draftToInput();
    if (!input || !activeAthlete) {
      return;
    }

    if (editingProgramId === "new") {
      await createProgram(activeAthlete.id, input);
    }
    else if (editingProgramId) {
      await updateProgram(editingProgramId, input);
    }
    closeEditor();
  }

  async function confirmDelete() {
    if (!programPendingDelete) {
      return;
    }
    await deleteProgram(programPendingDelete);
    if (editingProgramId === programPendingDelete) {
      closeEditor();
    }
    setProgramPendingDelete(null);
  }

  return (
    <AppShell title="Programs">
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
        <View className="flex-col gap-4 border-l-4 border-signal pl-4 sm:flex-row sm:items-end sm:justify-between">
          <View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Coach programming</Text><Text className="mt-2 font-serif text-3xl font-bold text-ink">{activeAthlete?.displayName}&apos;s programs</Text><Text className="mt-2 font-serif text-base text-[#52675F]">Create and maintain plans locally while program APIs are not yet connected.</Text></View>
          {!isEditorOpen ? <Pressable className="min-h-11 flex-row items-center justify-center gap-2 rounded-md bg-ink px-4 py-3" onPress={beginCreate} accessibilityLabel="Create a training program"><Plus size={18} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Create program</Text></Pressable> : null}
        </View>

        {isEditorOpen ? (
          <View className="border border-fog bg-paper p-5">
            <View className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{editingProgramId === "new" ? "New program" : "Edit program"}</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">{editingProgramId === "new" ? "Build the next training block" : "Update the current training block"}</Text></View><Pressable className="h-10 w-10 items-center justify-center rounded-md border border-fog" onPress={closeEditor} accessibilityLabel="Close program editor"><X size={18} color="#17212B" /></Pressable></View>
            {validationMessage ? <View className="mt-5 border border-signal bg-[#D74F3212] px-4 py-3"><Text className="font-serif text-sm text-signal">{validationMessage}</Text></View> : null}
            <View className="mt-5 gap-4"><Field label="Program name" value={draft.name} onChangeText={(value) => updateDraft("name", value)} placeholder="e.g. Autumn Open Peak" /><View className="flex-col gap-4 sm:flex-row"><Field label="Start date" value={draft.startDate} onChangeText={(value) => updateDraft("startDate", value)} placeholder="YYYY-MM-DD" /><Field label="End date" value={draft.endDate} onChangeText={(value) => updateDraft("endDate", value)} placeholder="YYYY-MM-DD" /><Field label="Training days / week" value={draft.trainingDaysPerWeek} onChangeText={(value) => updateDraft("trainingDaysPerWeek", value)} keyboardType="number-pad" /></View><View><Text className="mb-1.5 font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Training phase</Text><View className="flex-row flex-wrap gap-2">{phases.map((phase) => <Pressable key={phase} className={`min-h-10 justify-center rounded-md border px-3 py-2 ${draft.phase === phase ? "border-ink bg-ink" : "border-fog bg-canvas"}`} onPress={() => updateDraft("phase", phase)} accessibilityLabel={`Set program phase to ${phase}`}><Text className={`font-serif text-sm font-bold ${draft.phase === phase ? "text-white" : "text-ink"}`}>{phase}</Text></Pressable>)}</View></View><View><Text className="mb-1.5 font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Program status</Text><View className="flex-row flex-wrap gap-2">{statuses.map((status) => <Pressable key={status.value} className={`min-h-10 justify-center rounded-md border px-3 py-2 ${draft.status === status.value ? "border-moss bg-moss" : "border-fog bg-canvas"}`} onPress={() => updateDraft("status", status.value)} accessibilityLabel={`Set program status to ${status.label}`}><Text className={`font-serif text-sm font-bold ${draft.status === status.value ? "text-white" : "text-ink"}`}>{status.label}</Text></Pressable>)}</View>{draft.status === "active" ? <Text className="mt-2 font-serif text-xs text-[#52675F]">Saving this program as active will move the athlete&apos;s other active program to draft.</Text> : null}</View><Field label="Coaching goal" value={draft.goal} onChangeText={(value) => updateDraft("goal", value)} multiline placeholder="What should this block accomplish?" /><Field label="Focus exercises" value={draft.exercises} onChangeText={(value) => updateDraft("exercises", value)} multiline placeholder="One exercise per line" /></View>
            <View className="mt-5 flex-row justify-end gap-2"><Pressable className="min-h-11 flex-row items-center gap-2 rounded-md border border-fog px-4 py-3" onPress={closeEditor}><X size={16} color="#17212B" /><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="min-h-11 flex-row items-center gap-2 rounded-md bg-ink px-4 py-3" onPress={() => void saveProgram()}><Save size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Save program</Text></Pressable></View>
          </View>
        ) : null}

        <View><View className="mb-3 flex-row items-end justify-between"><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Program library</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">Training blocks</Text></View><Text className="font-serif text-sm text-[#52675F]">{athletePrograms.length} total</Text></View>
          {isLoading ? <View className="items-center border border-fog bg-paper py-12"><ActivityIndicator color="#2E6F5E" /><Text className="mt-3 font-serif text-sm text-[#52675F]">Loading programs</Text></View> : athletePrograms.length ? <View className="gap-3">{athletePrograms.map((program) => <View key={program.id} className="border border-fog bg-paper p-5"><View className="flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><View className="flex-1"><View className="flex-row flex-wrap items-center gap-2"><Text className="font-serif text-xl font-bold text-ink">{program.name}</Text><Text className={`rounded-sm px-2 py-1 font-serif text-xs font-bold capitalize ${statusClass(program.status)}`}>{program.status}</Text></View><Text className="mt-2 font-serif text-sm leading-6 text-[#52675F]">{program.goal}</Text></View><View className="flex-row gap-2"><Pressable className="h-10 w-10 items-center justify-center rounded-md border border-fog" onPress={() => beginEdit(program)} accessibilityLabel={`Edit ${program.name}`}><Pencil size={17} color="#17212B" /></Pressable><Pressable className="h-10 w-10 items-center justify-center rounded-md border border-signal" onPress={() => setProgramPendingDelete(program.id)} accessibilityLabel={`Delete ${program.name}`}><Trash2 size={17} color="#D74F32" /></Pressable></View></View><View className="mt-5 flex-col gap-4 border-y border-fog py-4 sm:flex-row"><View className="flex-1 flex-row items-center gap-2"><CalendarDays size={17} color="#2E6F5E" /><View><Text className="font-serif text-xs text-[#688078]">Schedule</Text><Text className="font-serif text-sm font-bold text-ink">{dateRange(program)}</Text></View></View><View className="flex-1 flex-row items-center gap-2"><ClipboardList size={17} color="#2E6F5E" /><View><Text className="font-serif text-xs text-[#688078]">Structure</Text><Text className="font-serif text-sm font-bold text-ink">{program.phase} · {program.trainingDaysPerWeek} days/week</Text></View></View></View><View className="mt-4"><Text className="mb-2 font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Focus exercises</Text><View className="flex-row flex-wrap gap-2">{program.exercises.map((exercise) => <View key={exercise} className="rounded-sm bg-canvas px-2.5 py-1.5"><Text className="font-serif text-xs font-bold text-ink">{exercise}</Text></View>)}</View></View>{programPendingDelete === program.id ? <View className="mt-5 flex-col gap-3 border-t border-fog pt-4 sm:flex-row sm:items-center sm:justify-between"><Text className="font-serif text-sm text-signal">Delete this program? This local action cannot be undone.</Text><View className="flex-row gap-2"><Pressable className="min-h-10 rounded-md border border-fog px-3 py-2" onPress={() => setProgramPendingDelete(null)}><Text className="font-serif text-sm font-bold text-ink">Keep</Text></Pressable><Pressable className="min-h-10 rounded-md bg-signal px-3 py-2" onPress={() => void confirmDelete()}><Text className="font-serif text-sm font-bold text-white">Delete</Text></Pressable></View></View> : null}</View>)}</View> : <View className="items-center border border-fog bg-paper px-5 py-12"><CheckCircle2 size={25} color="#2E6F5E" /><Text className="mt-3 font-serif text-base font-bold text-ink">No programs yet</Text><Text className="mt-1 text-center font-serif text-sm text-[#52675F]">Create a draft or active block for {activeAthlete?.displayName}.</Text><Pressable className="mt-5 min-h-11 flex-row items-center gap-2 rounded-md bg-ink px-4 py-3" onPress={beginCreate}><Plus size={17} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Create program</Text></Pressable></View>}
        </View>
      </ScrollView>
    </AppShell>
  );
}