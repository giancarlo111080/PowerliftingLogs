import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowRight, ClipboardList, Dumbbell, Layers3, Plus, Save, Users, X } from "lucide-react-native";
import { router } from "expo-router";

import { useSession } from "../auth/AuthSessionContext";
import { type ExerciseCategory, type ProgramExercise, type ProgramPhase, type ProgramTemplate, type ProgramTemplateInput, useProgramWorkspaceStore } from "../data/programWorkspaceStore";
import { AppShell } from "./AppShell";
import { DatePickerField } from "./DatePickerField";

interface TemplateDraft extends ProgramTemplateInput {}

interface ExerciseEditor {
  templateId: string;
  weekId: string;
  dayId: string;
  exercise: ProgramExercise;
}

const phases: ProgramPhase[] = ["Hypertrophy", "Strength", "Peak", "Recovery"];
const exerciseCategories: Array<{ value: ExerciseCategory; label: string }> = [
  { value: "squat", label: "Squat" },
  { value: "bench", label: "Bench" },
  { value: "deadlift", label: "Deadlift" },
  { value: "accessory", label: "Accessory" }
];

function defaultDraft(template?: ProgramTemplate): TemplateDraft {
  return { name: template?.name ?? "", phase: template?.phase ?? "Strength", goal: template?.goal ?? "", trainingDaysPerWeek: template?.trainingDaysPerWeek ?? 4 };
}

function prescription(exercise: ProgramExercise) {
  if (exercise.prescriptionMode === "exact") return `${exercise.prescriptionValue} ${exercise.weightUnit}`;
  if (exercise.prescriptionMode === "percent") return `${exercise.prescriptionValue}% 1RM`;
  return `${exercise.prescriptionMode.toUpperCase()} ${exercise.prescriptionValue}`;
}

export function ProgramTemplatesScreen() {
  const { session, currentProfile, profiles, activeAthlete } = useSession();
  const { programs, templates, isLoading, createTemplate, updateTemplate, addTemplateWeek, updateTemplateWeek, addTemplateDay, addTemplateExercise, updateTemplateExercise, assignTemplate } = useProgramWorkspaceStore();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(defaultDraft());
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [dayDrafts, setDayDrafts] = useState<Record<string, { name: string; focus: string }>>({});
  const [exerciseEditor, setExerciseEditor] = useState<ExerciseEditor | null>(null);
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [isAssignmentConfirmationOpen, setIsAssignmentConfirmationOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isCoach = session?.role === "COACH";
  const coachTemplates = templates.filter((template) => template.coachId === currentProfile?.userId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const selectedTemplate = coachTemplates.find((template) => template.id === selectedTemplateId) ?? coachTemplates[0] ?? null;
  const athletes = profiles.filter((profile) => profile.role === "ATHLETE" && profile.coachId === currentProfile?.userId);
  const assignmentAthleteId = selectedAthleteId ?? (activeAthlete?.coachId === currentProfile?.userId ? activeAthlete?.id : athletes[0]?.id ?? null);

  if (!session || !currentProfile || !isCoach) {
    return <AppShell title="Programs"><View className="flex-1 items-center justify-center bg-canvas px-6"><Dumbbell size={32} color="#D32F2F" /><Text className="mt-4 font-heading text-xl uppercase text-ink">Coach access required</Text><Text className="mt-2 text-center font-sans text-sm text-muted">Only coaches can build or assign master program templates.</Text></View></AppShell>;
  }
  const coachUserId = currentProfile.userId;

  function openEditor(template?: ProgramTemplate) {
    setEditingTemplateId(template?.id ?? "new");
    setDraft(defaultDraft(template));
    setMessage(null);
  }

  async function saveTemplate() {
    if (!draft.name.trim() || !draft.goal.trim() || draft.trainingDaysPerWeek < 1 || draft.trainingDaysPerWeek > 7) {
      setMessage("Provide a template name, coaching goal, and 1 to 7 training days per week.");
      return;
    }
    if (editingTemplateId === "new") {
      const created = await createTemplate(coachUserId, { ...draft, name: draft.name.trim(), goal: draft.goal.trim() });
      setSelectedTemplateId(created.id);
      setMessage("Master template created. Add weeks, days, and prescriptions before assigning it.");
    }
    else if (editingTemplateId) {
      await updateTemplate(editingTemplateId, { ...draft, name: draft.name.trim(), goal: draft.goal.trim() });
      setMessage("Master template updated. Existing athlete logs stay unchanged.");
    }
    setEditingTemplateId(null);
  }

  async function saveDay(templateId: string, weekId: string) {
    const dayDraft = dayDrafts[weekId] ?? { name: "", focus: "" };
    if (!dayDraft.name.trim() || !dayDraft.focus.trim()) {
      setMessage("Add a day name and its training focus.");
      return;
    }
    await addTemplateDay(templateId, weekId, dayDraft);
    setDayDrafts((drafts) => ({ ...drafts, [weekId]: { name: "", focus: "" } }));
  }

  function assignSelectedTemplate() {
    if (!selectedTemplate || !assignmentAthleteId) {
      setMessage("Invite or select an athlete before assigning this template.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(assignmentDate)) {
      setMessage("Use YYYY-MM-DD for the athlete start date.");
      return;
    }
    const existingTrainingLog = programs.find((program) => program.athleteId === assignmentAthleteId && program.status === "active" && (
      program.templateId === selectedTemplate.id ||
      (program.coachId === selectedTemplate.coachId && program.name === selectedTemplate.name)
    ));
    if (existingTrainingLog) {
      setMessage(`${existingTrainingLog.name} is already assigned to ${athletes.find((athlete) => athlete.id === assignmentAthleteId)?.displayName ?? "this athlete"}. Open Training Log to edit it.`);
      return;
    }
    setIsAssignmentConfirmationOpen(true);
  }

  async function confirmTemplateAssignment() {
    if (!selectedTemplate || !assignmentAthleteId) {
      setIsAssignmentConfirmationOpen(false);
      return;
    }
    try {
      const liveLog = await assignTemplate(selectedTemplate.id, assignmentAthleteId, assignmentDate);
      setMessage(`${liveLog.name} is now a live training log for ${athletes.find((athlete) => athlete.id === assignmentAthleteId)?.displayName ?? "this athlete"}.`);
      setIsAssignmentConfirmationOpen(false);
      router.push("/training");
    }
    catch (reason) {
      setIsAssignmentConfirmationOpen(false);
      setMessage(reason instanceof Error ? reason.message : "Could not assign this template.");
    }
  }

  async function saveExercise() {
    if (!exerciseEditor) return;
    const exercise = exerciseEditor.exercise;
    if (!exercise.name.trim() || exercise.sets < 1 || exercise.repetitions < 1 || exercise.prescriptionValue < 0) {
      setMessage("Every exercise needs a name, positive sets and reps, and a valid target.");
      return;
    }
    await updateTemplateExercise(exerciseEditor.templateId, exerciseEditor.weekId, exerciseEditor.dayId, { ...exercise, name: exercise.name.trim() });
    setExerciseEditor(null);
  }

  return (
    <AppShell title="Programs">
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
        <View className="flex-col gap-4 border-l-4 border-signal pl-4 sm:flex-row sm:items-end sm:justify-between"><View><Text className="font-heading text-xs uppercase tracking-widest text-zinc">Coach programming</Text><Text className="mt-2 font-heading text-3xl uppercase text-ink">Master programs</Text><Text className="mt-2 font-sans text-base leading-6 text-muted">Templates are reusable. Assigning one creates a separate live log for the athlete.</Text></View><Pressable className="min-h-11 flex-row items-center justify-center gap-2 bg-signal px-4 py-3" onPress={() => openEditor()}><Plus size={18} color="#F4F4ED" /><Text className="font-heading text-sm uppercase text-white">New template</Text></Pressable></View>
        {message ? <View className="border border-zinc bg-zinc/10 px-4 py-3"><Text className="font-sans text-sm text-ink">{message}</Text></View> : null}
        <Modal transparent animationType="fade" visible={isAssignmentConfirmationOpen} onRequestClose={() => setIsAssignmentConfirmationOpen(false)}>
          <View className="flex-1 items-center justify-center bg-black/60 px-5">
            <View className="w-full max-w-md border border-fog bg-paper p-5">
              <Text className="font-heading text-xs uppercase tracking-widest text-moss">Confirm assignment</Text>
              <Text className="mt-2 font-heading text-2xl uppercase text-ink">Assign this program?</Text>
              <Text className="mt-3 font-sans text-sm leading-6 text-muted">{selectedTemplate?.name ?? "This template"} will become the active live training log for {athletes.find((athlete) => athlete.id === assignmentAthleteId)?.displayName ?? "the selected athlete"}, starting {assignmentDate}.</Text>
              <View className="mt-5 flex-row justify-end gap-2"><Pressable className="min-h-11 border border-fog px-4 py-3" onPress={() => setIsAssignmentConfirmationOpen(false)}><Text className="font-heading text-sm uppercase text-ink">Cancel</Text></Pressable><Pressable className="min-h-11 bg-signal px-4 py-3" onPress={() => void confirmTemplateAssignment()}><Text className="font-heading text-sm uppercase text-white">Assign program</Text></Pressable></View>
            </View>
          </View>
        </Modal>
        {isLoading ? <View className="items-center py-14"><ActivityIndicator color="#CCFF00" /></View> : null}

        {editingTemplateId ? <View className="border border-fog bg-paper p-5"><View className="flex-row items-center justify-between"><Text className="font-heading text-xl uppercase text-ink">{editingTemplateId === "new" ? "New master" : "Edit master"}</Text><Pressable className="h-10 w-10 items-center justify-center border border-fog" onPress={() => setEditingTemplateId(null)} accessibilityLabel="Close template editor"><X size={18} color="#F4F4ED" /></Pressable></View><View className="mt-5 gap-4"><Field label="Template name" value={draft.name} onChangeText={(name) => setDraft((current) => ({ ...current, name }))} placeholder="12-week peaking block" /><Field label="Coaching goal" value={draft.goal} onChangeText={(goal) => setDraft((current) => ({ ...current, goal }))} placeholder="Build meet-day confidence" /><View className="flex-col gap-4 sm:flex-row"><View className="flex-1"><Field label="Training days per week" value={draft.trainingDaysPerWeek.toString()} onChangeText={(value) => setDraft((current) => ({ ...current, trainingDaysPerWeek: Number(value) || 0 }))} placeholder="4" keyboardType="number-pad" /></View><View className="flex-1"><Text className="mb-1.5 font-heading text-xs uppercase text-muted">Phase</Text><View className="flex-row flex-wrap gap-2">{phases.map((phase) => <Pressable key={phase} className={`border px-3 py-2 ${draft.phase === phase ? "border-signal bg-signal/10" : "border-fog bg-canvas"}`} onPress={() => setDraft((current) => ({ ...current, phase }))}><Text className={`font-heading text-xs uppercase ${draft.phase === phase ? "text-ink" : "text-muted"}`}>{phase}</Text></Pressable>)}</View></View></View></View><Pressable className="mt-5 min-h-11 flex-row items-center justify-center gap-2 bg-signal px-4 py-3" onPress={() => void saveTemplate()}><Save size={17} color="#F4F4ED" /><Text className="font-heading text-sm uppercase text-white">Save master</Text></Pressable></View> : null}

        {coachTemplates.length ? <View className="gap-5"><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">{coachTemplates.map((template) => <Pressable key={template.id} className={`w-60 border p-4 ${selectedTemplate?.id === template.id ? "border-signal bg-signal/10" : "border-fog bg-paper"}`} onPress={() => setSelectedTemplateId(template.id)}><Text className="font-heading text-base uppercase text-ink">{template.name}</Text><Text className="mt-2 font-mono text-xs text-muted">{template.weeks.length} WEEKS · {template.trainingDaysPerWeek} DAYS/WK</Text></Pressable>)}</ScrollView>
          {selectedTemplate ? <><View className="border border-fog bg-paper p-5"><View className="flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><View className="flex-1"><Text className="font-heading text-2xl uppercase text-ink">{selectedTemplate.name}</Text><Text className="mt-2 font-sans text-sm leading-6 text-muted">{selectedTemplate.goal}</Text><Text className="mt-3 font-mono text-xs text-zinc">{selectedTemplate.phase.toUpperCase()} · MASTER TEMPLATE · {selectedTemplate.weeks.length} WEEKS</Text></View><Pressable className="min-h-10 flex-row items-center justify-center gap-2 border border-fog px-3 py-2" onPress={() => openEditor(selectedTemplate)}><ClipboardList size={16} color="#F4F4ED" /><Text className="font-heading text-sm uppercase text-ink">Edit details</Text></Pressable></View></View>
            <View className="border border-signal bg-signal/10 p-5"><View className="flex-row items-center gap-3"><Users size={20} color="#CCFF00" /><View><Text className="font-heading text-lg uppercase text-ink">Assign to athlete</Text><Text className="mt-1 font-sans text-sm text-muted">Creates a separate live training log. Template edits never change active assignments.</Text></View></View><View className="mt-4 flex-col gap-3 lg:flex-row lg:items-end"><View className="flex-1"><Text className="mb-1.5 font-heading text-xs uppercase text-muted">Athlete</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">{athletes.map((athlete) => <Pressable key={athlete.id} className={`border px-3 py-2 ${assignmentAthleteId === athlete.id ? "border-zinc bg-zinc/20" : "border-fog bg-paper"}`} onPress={() => setSelectedAthleteId(athlete.id)}><Text className="font-heading text-xs uppercase text-ink">{athlete.displayName}</Text></Pressable>)}</ScrollView></View><View className="w-full lg:w-48"><Field label="Start date" value={assignmentDate} onChangeText={setAssignmentDate} placeholder="YYYY-MM-DD" /></View><Pressable className="min-h-12 flex-row items-center justify-center gap-2 bg-signal px-4 py-3" onPress={() => void assignSelectedTemplate()}><ArrowRight size={18} color="#F4F4ED" /><Text className="font-heading text-sm uppercase text-white">Assign</Text></Pressable></View>{athletes.length ? null : <Text className="mt-4 font-sans text-sm text-muted">Generate an athlete invite from the coach dashboard to start your roster.</Text>}</View>
            <View className="gap-4">{[...selectedTemplate.weeks].sort((left, right) => left.weekNumber - right.weekNumber).map((week) => { const dayDraft = dayDrafts[week.id] ?? { name: "", focus: "" }; return <View key={week.id} className="border border-fog bg-paper"><View className="flex-row items-center justify-between border-b border-fog bg-canvas px-4 py-4"><View className="flex-1"><Text className="font-heading text-xs uppercase text-zinc">Week {week.weekNumber}</Text><TextInput className="mt-1 font-heading text-xl uppercase text-ink" value={week.name} onChangeText={(name) => void updateTemplateWeek(selectedTemplate.id, week.id, name)} accessibilityLabel={`Week ${week.weekNumber} name`} /></View><Layers3 size={20} color="#CCFF00" /></View><View className="gap-3 p-4">{[...week.days].sort((left, right) => left.sequence - right.sequence).map((day) => <View key={day.id} className="border border-fog bg-paper p-4"><Text className="font-heading text-base uppercase text-ink">D{day.sequence} · {day.name}</Text><Text className="mt-1 font-sans text-sm text-muted">{day.focus}</Text>{day.exercises.length ? <View className="mt-4 border-t border-fog">{day.exercises.map((exercise) => <Pressable key={exercise.id} className="flex-row items-center justify-between border-b border-fog py-3" onPress={() => setExerciseEditor({ templateId: selectedTemplate.id, weekId: week.id, dayId: day.id, exercise })}><View><Text className="font-heading text-sm uppercase text-ink">{exercise.name}</Text><Text className="mt-1 font-mono text-xs text-muted">{exercise.sets} x {exercise.repetitions} @ {prescription(exercise)}</Text></View><Text className="font-mono text-xs text-zinc">EDIT</Text></Pressable>)}</View> : <Text className="mt-4 font-sans text-sm text-muted">No prescriptions yet.</Text>}<View className="mt-4 flex-row flex-wrap gap-2">{exerciseCategories.map((category) => <Pressable key={category.value} className="flex-row items-center gap-1 border border-fog bg-canvas px-2.5 py-2" onPress={() => void addTemplateExercise(selectedTemplate.id, week.id, day.id, category.value)}><Plus size={13} color="#F4F4ED" /><Text className="font-heading text-xs uppercase text-ink">{category.label}</Text></Pressable>)}</View></View>)}<View className="border border-dashed border-fog p-3"><Text className="font-heading text-sm uppercase text-ink">Add training day</Text><View className="mt-3 flex-col gap-3 sm:flex-row"><View className="flex-1"><Field label="Day" value={dayDraft.name} onChangeText={(name) => setDayDrafts((drafts) => ({ ...drafts, [week.id]: { ...dayDraft, name } }))} placeholder={`Day ${week.days.length + 1}`} /></View><View className="flex-1"><Field label="Focus" value={dayDraft.focus} onChangeText={(focus) => setDayDrafts((drafts) => ({ ...drafts, [week.id]: { ...dayDraft, focus } }))} placeholder="Primary lifts" /></View><Pressable className="min-h-12 flex-row items-center justify-center gap-2 border border-fog px-3 py-2" onPress={() => void saveDay(selectedTemplate.id, week.id)}><Plus size={16} color="#F4F4ED" /><Text className="font-heading text-sm uppercase text-ink">Add day</Text></Pressable></View></View></View></View>; })}<Pressable className="min-h-12 flex-row items-center justify-center gap-2 border border-fog bg-paper px-4 py-3" onPress={() => void addTemplateWeek(selectedTemplate.id)}><Plus size={18} color="#F4F4ED" /><Text className="font-heading text-sm uppercase text-ink">Add week</Text></Pressable></View>
          </> : null}
        </View> : !isLoading ? <View className="items-center border border-fog bg-paper px-5 py-14"><Dumbbell size={32} color="#CCFF00" /><Text className="mt-4 font-heading text-xl uppercase text-ink">No master templates</Text><Text className="mt-2 text-center font-sans text-sm text-muted">Build a reusable block before assigning live training to your roster.</Text></View> : null}
        {exerciseEditor ? <ExerciseModal editor={exerciseEditor} onChange={(exercise) => setExerciseEditor((current) => current ? { ...current, exercise } : current)} onClose={() => setExerciseEditor(null)} onSave={() => void saveExercise()} /> : null}
      </ScrollView>
    </AppShell>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = "default" }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "default" | "number-pad" }) {
  if (label.toLowerCase().includes("date")) {
    return <DatePickerField label={label} value={value} onChangeText={onChangeText} />;
  }
  return <View><Text className="mb-1.5 font-heading text-xs uppercase text-muted">{label}</Text><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-sans text-base text-ink" value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9B9B95" keyboardType={keyboardType} accessibilityLabel={label} /></View>;
}

function ExerciseModal({ editor, onChange, onClose, onSave }: { editor: ExerciseEditor; onChange: (exercise: ProgramExercise) => void; onClose: () => void; onSave: () => void }) {
  const exercise = editor.exercise;
  return <View className="border border-zinc bg-paper p-4"><View className="flex-row items-center justify-between"><Text className="font-heading text-lg uppercase text-ink">Prescription</Text><Pressable className="h-9 w-9 items-center justify-center border border-fog" onPress={onClose}><X size={16} color="#F4F4ED" /></Pressable></View><View className="mt-4 gap-3"><Field label="Exercise" value={exercise.name} onChangeText={(name) => onChange({ ...exercise, name })} placeholder="Exercise" /><View className="flex-row gap-3"><View className="flex-1"><Field label="Sets" value={exercise.sets.toString()} onChangeText={(value) => onChange({ ...exercise, sets: Number(value) || 0 })} placeholder="3" keyboardType="number-pad" /></View><View className="flex-1"><Field label="Reps" value={exercise.repetitions.toString()} onChangeText={(value) => onChange({ ...exercise, repetitions: Number(value) || 0 })} placeholder="5" keyboardType="number-pad" /></View><View className="flex-1"><Field label="Target" value={exercise.prescriptionValue.toString()} onChangeText={(value) => onChange({ ...exercise, prescriptionValue: Number(value) || 0 })} placeholder="7" keyboardType="number-pad" /></View></View><View className="flex-row flex-wrap gap-2">{(["rpe", "percent", "exact"] as const).map((mode) => <Pressable key={mode} className={`border px-3 py-2 ${exercise.prescriptionMode === mode ? "border-signal bg-signal/10" : "border-fog bg-canvas"}`} onPress={() => onChange({ ...exercise, prescriptionMode: mode })}><Text className={`font-heading text-xs uppercase ${exercise.prescriptionMode === mode ? "text-ink" : "text-muted"}`}>{mode === "percent" ? "% 1RM" : mode}</Text></Pressable>)}</View></View><Pressable className="mt-5 min-h-11 flex-row items-center justify-center gap-2 bg-signal px-4 py-3" onPress={onSave}><Save size={17} color="#F4F4ED" /><Text className="font-heading text-sm uppercase text-white">Save prescription</Text></Pressable></View>;
}