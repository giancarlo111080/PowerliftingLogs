import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View, Alert, Platform } from "react-native";
import { ArrowRight, ClipboardList, Dumbbell, Layers3, Plus, Save, Users, X, Pencil, Trash2, Check } from "lucide-react-native";
import { router } from "expo-router";

import { useSession } from "../auth/AuthSessionContext";
import { 
  type ExerciseCategory, 
  type ProgramExercise, 
  type ProgramPhase, 
  type ProgramTemplate, 
  type ProgramTemplateInput, 
  useProgramWorkspaceStore 
} from "../data/programWorkspaceStore";
import { AppShell } from "./AppShell";
import { AccessoryExercisePicker } from "./AccessoryExercisePicker";

interface TemplateDraft extends ProgramTemplateInput {
  weeks: number;
}

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
  return { 
    name: template?.name ?? "", 
    phase: template?.phase ?? "Strength", 
    goal: template?.goal ?? "", 
    trainingDaysPerWeek: template?.trainingDaysPerWeek ?? 4,
    weeks: template?.weeks.length ?? 4
  };
}

function prescription(exercise: ProgramExercise) {
  if (exercise.prescriptionMode === "exact") return `${exercise.prescriptionValue} ${exercise.weightUnit}`;
  if (exercise.prescriptionMode === "percent") return `${exercise.prescriptionValue}% 1RM`;
  return `${exercise.prescriptionMode.toUpperCase()} ${exercise.prescriptionValue}`;
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: { 
  label: string; 
  value: string; 
  onChangeText: (text: string) => void; 
  placeholder?: string; 
  keyboardType?: "default" | "number-pad" 
}) {
  return (
    <View className="flex-col gap-1.5 w-full">
      <Text className="font-heading text-xs uppercase text-muted tracking-wider">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType ?? "default"}
        placeholderTextColor="#71717A"
        className="w-full min-h-11 border border-fog bg-canvas px-3 py-2 font-sans text-sm text-ink rounded"
      />
    </View>
  );
}

export function ProgramTemplatesScreen() {
  const { session, currentProfile, profiles, activeAthlete } = useSession();
  const { 
    programs, 
    templates, 
    isLoading, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate,
    addTemplateWeek, 
    updateTemplateWeek, 
    deleteTemplateWeek,
    addTemplateDay, 
    updateTemplateDay,
    deleteTemplateDay,
    addTemplateExercise, 
    updateTemplateExercise, 
    deleteTemplateExercise,
    ensureTemplateDays,
    assignTemplate 
  } = useProgramWorkspaceStore();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(defaultDraft());
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [dayDrafts, setDayDrafts] = useState<Record<string, { name: string; focus: string }>>({});
  const [exerciseEditor, setExerciseEditor] = useState<ExerciseEditor | null>(null);
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [isAssignmentConfirmationOpen, setIsAssignmentConfirmationOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [titleBuffer, setTitleBuffer] = useState<string>("");

  const isCoach = session?.role === "COACH";
  const coachTemplates = templates.filter((template) => template.coachId === currentProfile?.userId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const selectedTemplate = coachTemplates.find((template) => template.id === selectedTemplateId) ?? coachTemplates[0] ?? null;
  const athletes = profiles.filter((profile) => profile.role === "ATHLETE" && profile.coachId === currentProfile?.userId);
  
  const assignmentAthleteId = selectedAthleteId ?? (activeAthlete?.coachId === currentProfile?.userId ? activeAthlete?.id : athletes[0]?.id ?? null);

  if (!session || !currentProfile || !isCoach) {
    return (
      <AppShell title="Programs">
        <View className="flex-1 items-center justify-center bg-canvas px-6">
          <Dumbbell size={32} color="#D32F2F" />
          <Text className="mt-4 font-heading text-xl uppercase text-ink">Coach access required</Text>
          <Text className="mt-2 text-center font-sans text-sm text-muted">Only coaches can build or assign master program templates.</Text>
        </View>
      </AppShell>
    );
  }
  const coachUserId = currentProfile.userId;

  function openEditor(template?: ProgramTemplate) {
    setEditingTemplateId(template?.id ?? "new");
    setDraft(defaultDraft(template));
    setMessage(null);
  }

  async function saveTemplate() {
    if (!draft.name.trim() || !draft.goal.trim() || !Number.isInteger(draft.trainingDaysPerWeek) || draft.trainingDaysPerWeek < 1 || draft.trainingDaysPerWeek > 7 || !Number.isInteger(draft.weeks) || draft.weeks < 1 || draft.weeks > 52) {
      setMessage("Provide a template name, coaching goal, 1 to 7 training days, and 1 to 52 weeks.");
      return;
    }
    const templateInput: ProgramTemplateInput = { name: draft.name.trim(), phase: draft.phase, goal: draft.goal.trim(), trainingDaysPerWeek: draft.trainingDaysPerWeek };
    if (editingTemplateId === "new") {
      const created = await createTemplate(coachUserId, templateInput);
      for (let weekNumber = created.weeks.length + 1; weekNumber <= draft.weeks; weekNumber += 1) {
        await addTemplateWeek(created.id);
      }
      await ensureTemplateDays(created.id, draft.trainingDaysPerWeek);
      setSelectedTemplateId(created.id);
      setMessage(`Master template created with ${draft.weeks} weeks and ${draft.trainingDaysPerWeek} days per week. Add prescriptions before assigning it.`);
    } else if (editingTemplateId) {
      const currentTemplate = templates.find((template) => template.id === editingTemplateId);
      await updateTemplate(editingTemplateId, templateInput);
      if (currentTemplate) {
        for (let weekNumber = currentTemplate.weeks.length + 1; weekNumber <= draft.weeks; weekNumber += 1) {
          await addTemplateWeek(editingTemplateId);
        }
        const trailingWeeks = [...currentTemplate.weeks].sort((left, right) => right.weekNumber - left.weekNumber).slice(0, Math.max(0, currentTemplate.weeks.length - draft.weeks));
        for (const week of trailingWeeks) {
          await deleteTemplateWeek(editingTemplateId, week.id);
        }
        await ensureTemplateDays(editingTemplateId, draft.trainingDaysPerWeek);
      }
      setMessage(`Master template updated to ${draft.weeks} weeks. Existing athlete logs stay unchanged.`);
    }
    setEditingTemplateId(null);
  }

  function confirmDeletion(title: string, message: string, action: () => Promise<void>) {
    if (Platform.OS === "web") {
      if (globalThis.confirm(message)) void action();
      return;
    }
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void action() }
    ]);
  }

    // 1. Direct Template List Array Purge
    function handleDeleteTemplate(templateId: string, name: string) {
        confirmDeletion("Delete Template", `Are you sure you want to permanently delete "${name}"?`, async () => {
            await deleteTemplate(templateId);
            if (selectedTemplateId === templateId) setSelectedTemplateId(null);
            setMessage("Program template removed successfully.");
        });
    }


    // 2. Continuous Nested Week Filter Mutation
    function handleDeleteWeek(templateId: string, weekId: string, weekNumber: number) {
      confirmDeletion("Delete Week", `Delete Week ${weekNumber} and all its workouts?`, async () => {
        await deleteTemplateWeek(templateId, weekId);
        setMessage(`Week ${weekNumber} removed.`);
      });
    }

    // 3. Continuous Nested Day Filter Mutation
    function handleDeleteDay(templateId: string, weekId: string, dayId: string, dayName: string) {
      confirmDeletion("Delete Day", `Permanently remove "${dayName}" and all exercises inside it?`, async () => {
        await deleteTemplateDay(templateId, weekId, dayId);
        setMessage("Training day removed.");
      });
    }

    // 4. Continuous Nested Exercise/Accessory Filter Mutation
    function handleDeleteExercise(templateId: string, weekId: string, dayId: string, exerciseId: string, exerciseName: string) {
      confirmDeletion("Remove Exercise", `Remove "${exerciseName || "this exercise"}" from this training day?`, async () => {
        await deleteTemplateExercise(templateId, weekId, dayId, exerciseId);
        setMessage(`${exerciseName || "Exercise"} removed.`);
      });
    }


  async function saveDay(templateId: string, weekId: string) {
    const dayDraft = dayDrafts[weekId] ?? { name: "", focus: "" };
    const targetWeek = templates.find((template) => template.id === templateId)?.weeks.find((week) => week.id === weekId);
    if (targetWeek && targetWeek.days.length >= 7) {
      setMessage("A training week can contain no more than 7 days.");
      return;
    }
    if (!dayDraft.name.trim() || !dayDraft.focus.trim()) {
      setMessage("Add a day name and its training focus.");
      return;
    }
    try {
      await addTemplateDay(templateId, weekId, dayDraft);
      setDayDrafts((drafts) => ({ ...drafts, [weekId]: { name: "", focus: "" } }));
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not add this training day.");
    }
  }

async function triggerAddExercise(templateId: string, weekId: string, dayId: string, isPrimary: boolean) {
  const targetCategory: ExerciseCategory = isPrimary ? "squat" : "accessory";
  await addTemplateExercise(templateId, weekId, dayId, targetCategory);
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
    const athleteMatch = athletes.find((a) => a.id === assignmentAthleteId);
    const existingTrainingLog = programs.find((program) => program.athleteId === assignmentAthleteId && program.status === "active" && (
      program.templateId === selectedTemplate.id ||
      (program.coachId === selectedTemplate.coachId && program.name === selectedTemplate.name)
    ));
    if (existingTrainingLog) {
      setMessage(`${existingTrainingLog.name} is already assigned to ${athleteMatch?.displayName ?? "this athlete"}. Open Training Log to edit it.`);
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
      const athleteMatch = athletes.find((a) => a.id === assignmentAthleteId);
      setMessage(`${liveLog.name} is now a live training log for ${athleteMatch?.displayName ?? "this athlete"}.`);
      setIsAssignmentConfirmationOpen(false);
      router.push("/training");
    } catch (reason) {
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

  function startInlineTitleEditing(id: string, existingValue: string) {
    setInlineEditingId(id);
    setTitleBuffer(existingValue);
  }

  return (
    <AppShell title="Programs">
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
        
        <View className="flex-col gap-4 border-l-4 border-signal pl-4 sm:flex-row sm:items-end sm:justify-between">
          <View>
            <Text className="font-heading text-xs uppercase tracking-widest text-zinc">Coach programming</Text>
            <Text className="mt-2 font-heading text-3xl uppercase text-ink">Master programs</Text>
            <Text className="mt-2 font-sans text-base leading-6 text-muted">Templates are reusable. Assigning one creates a separate live log for the athlete.</Text>
          </View>
          <Pressable className="min-h-11 flex-row items-center justify-center gap-2 bg-signal px-4 py-3" onPress={() => openEditor()}>
            <Plus size={18} color="#F4F4ED" />
            <Text className="font-heading text-sm uppercase text-white">New template</Text>
          </Pressable>
        </View>

        {message ? (
          <View className="border border-zinc bg-zinc/10 px-4 py-3">
            <Text className="font-sans text-sm text-ink">{message}</Text>
          </View>
        ) : null}

        <Modal transparent animationType="fade" visible={isAssignmentConfirmationOpen} onRequestClose={() => setIsAssignmentConfirmationOpen(false)}>
          <View className="flex-1 items-center justify-center bg-black/60 px-5">
            <View className="w-full max-w-md border border-fog bg-paper p-5">
              <Text className="font-heading text-xs uppercase tracking-widest text-moss">Confirm assignment</Text>
              <Text className="mt-2 font-heading text-2xl uppercase text-ink">Assign this program?</Text>
              <Text className="mt-3 font-sans text-sm leading-6 text-muted">
                {selectedTemplate?.name ?? "This template"} will become the active live training log for {athletes.find((athlete) => athlete.id === assignmentAthleteId)?.displayName ?? "the selected athlete"}, starting {assignmentDate}.
              </Text>
              <View className="mt-5 flex-row justify-end gap-2">
                <Pressable className="min-h-11 border border-fog px-4 py-3" onPress={() => setIsAssignmentConfirmationOpen(false)}>
                  <Text className="font-heading text-sm uppercase text-ink">Cancel</Text>
                </Pressable>
                <Pressable className="min-h-11 bg-signal px-4 py-3" onPress={() => void confirmTemplateAssignment()}>
                  <Text className="font-heading text-sm uppercase text-white">Assign program</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {isLoading ? <View className="items-center py-14"><ActivityIndicator color="#CCFF00" /></View> : null}

        {editingTemplateId ? (
          <View className="border border-fog bg-paper p-5">
            <View className="flex-row items-center justify-between">
              <Text className="font-heading text-xl uppercase text-ink">{editingTemplateId === "new" ? "New master" : "Edit master"}</Text>
              <Pressable className="h-10 w-10 items-center justify-center border border-fog" onPress={() => setEditingTemplateId(null)}>
                <X size={18} color="#F4F4ED" />
              </Pressable>
            </View>
            <View className="mt-5 gap-4">
              <Field label="Template name" value={draft.name} onChangeText={(name) => setDraft((current) => ({ ...current, name }))} placeholder="12-week peaking block" />
              <Field label="Coaching goal" value={draft.goal} onChangeText={(goal) => setDraft((current) => ({ ...current, goal }))} placeholder="Build meet-day confidence" />
              <View className="flex-col gap-4 sm:flex-row">
                <View className="flex-1">
                  <Field label="Training days per week" value={draft.trainingDaysPerWeek.toString()} onChangeText={(value) => setDraft((current) => ({ ...current, trainingDaysPerWeek: Number(value) || 0 }))} placeholder="4" keyboardType="number-pad" />
                </View>
                <View className="flex-1">
                  <Field label="Weeks" value={draft.weeks.toString()} onChangeText={(value) => setDraft((current) => ({ ...current, weeks: Number(value) || 0 }))} placeholder="12" keyboardType="number-pad" />
                </View>
                <View className="flex-1">
                  <Text className="mb-1.5 font-heading text-xs uppercase text-muted">Phase</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {phases.map((phase) => (
                      <Pressable key={phase} className={`border px-3 py-2 ${draft.phase === phase ? "border-signal bg-signal/10" : "border-fog bg-canvas"}`} onPress={() => setDraft((current) => ({ ...current, phase }))}>
                        <Text className={`font-heading text-xs uppercase ${draft.phase === phase ? "text-ink" : "text-muted"}`}>{phase}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            </View>
            <Pressable className="mt-5 min-h-11 flex-row items-center justify-center gap-2 bg-signal px-4 py-3" onPress={() => void saveTemplate()}>
              <Save size={17} color="#F4F4ED" />
              <Text className="font-heading text-sm uppercase text-white">Save master</Text>
            </Pressable>
          </View>
        ) : null}

        {coachTemplates.length ? (
          <View className="gap-5">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {coachTemplates.map((template) => (
                <Pressable key={template.id} className={`w-60 border p-4 ${selectedTemplate?.id === template.id ? "border-signal bg-signal/10" : "border-fog bg-paper"}`} onPress={() => setSelectedTemplateId(template.id)}>
                  <Text className="font-heading text-base uppercase text-ink">{template.name}</Text>
                  <Text className="mt-2 font-mono text-xs text-muted">{template.weeks.length} WEEKS · {template.trainingDaysPerWeek} DAYS/WK</Text>
                </Pressable>
              ))}
            </ScrollView>

            {selectedTemplate ? (
              <>
                <View className="border border-fog bg-paper p-5">
                  <View className="flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <View className="flex-1">
                      <Text className="font-heading text-2xl uppercase text-ink">{selectedTemplate.name}</Text>
                      <Text className="mt-2 font-sans text-sm leading-6 text-muted">{selectedTemplate.goal}</Text>
                      <Text className="mt-3 font-mono text-xs text-zinc">{selectedTemplate.phase.toUpperCase()} · MASTER TEMPLATE · {selectedTemplate.weeks.length} WEEKS</Text>
                    </View>
                    <View className="flex-row gap-2 mt-2 sm:mt-0">
                      <Pressable className="min-h-10 flex-row items-center justify-center gap-2 border border-fog px-3 py-2" onPress={() => openEditor(selectedTemplate)}>
                        <ClipboardList size={16} color="#F4F4ED" />
                        <Text className="font-heading text-sm uppercase text-ink">Edit details</Text>
                      </Pressable>
                      <Pressable className="min-h-10 flex-row items-center justify-center gap-2 border border-red-900 bg-red-950/20 px-3 py-2" onPress={() => handleDeleteTemplate(selectedTemplate.id, selectedTemplate.name)}>
                        <Trash2 size={16} color="#EF4444" />
                        <Text className="font-heading text-sm uppercase text-red-400">Delete template</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <View className="border border-signal bg-signal/10 p-5">
                  <View className="flex-row items-center gap-3">
                    <Users size={20} color="#CCFF00" />
                    <View>
                      <Text className="font-heading text-lg uppercase text-ink">Assign to athlete</Text>
                      <Text className="mt-1 font-sans text-sm text-muted">Creates a separate live training log. Template edits never change active assignments.</Text>
                    </View>
                  </View>
                  <View className="mt-4 flex-col gap-3 lg:flex-row lg:items-end">
                    <View className="flex-1">
                      <Text className="mb-1.5 font-heading text-xs uppercase text-muted">Athlete</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                        {athletes.map((athlete) => (
                          <Pressable key={athlete.id} className={`border px-3 py-2 ${assignmentAthleteId === athlete.id ? "border-zinc bg-zinc/20" : "border-fog bg-paper"}`} onPress={() => setSelectedAthleteId(athlete.id)}>
                            <Text className="font-heading text-xs uppercase text-ink">{athlete.displayName}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                    <View className="w-full lg:w-48">
                      <Field label="Start date" value={assignmentDate} onChangeText={setAssignmentDate} placeholder="YYYY-MM-DD" />
                    </View>
                    <Pressable className="min-h-12 flex-row items-center justify-center gap-2 bg-signal px-4 py-3" onPress={() => void assignSelectedTemplate()}>
                      <ArrowRight size={18} color="#F4F4ED" />
                      <Text className="font-heading text-sm uppercase text-white">Assign</Text>
                    </Pressable>
                  </View>
                  {athletes.length ? null : <Text className="mt-4 font-sans text-sm text-muted">Generate an athlete invite from the coach dashboard to start your roster.</Text>}
                </View>

                <View className="gap-4">
                  {[...selectedTemplate.weeks].sort((left, right) => left.weekNumber - right.weekNumber).map((week) => { 
                    const dayDraft = dayDrafts[week.id] ?? { name: "", focus: "" }; 
                    return (
                      <View key={week.id} className="border border-fog bg-paper">
                        
                        <View className="flex-row items-center justify-between border-b border-fog bg-canvas px-4 py-4">
                          <View className="flex-1 pr-4">
                            <Text className="font-heading text-xs uppercase text-zinc">Week {week.weekNumber}</Text>
                            {inlineEditingId === week.id ? (
                              <View className="flex-row items-center gap-2 mt-1">
                                <TextInput 
                                  className="flex-1 font-heading text-xl uppercase text-yellow-400 bg-paper border border-signal px-2 py-0.5 rounded"
                                  value={titleBuffer} 
                                  onChangeText={setTitleBuffer}
                                  autoFocus
                                />
                                <Pressable 
                                  className="p-1.5 bg-signal rounded"
                                  onPress={async () => {
                                    if (titleBuffer.trim()) {
                                      await updateTemplateWeek(selectedTemplate.id, week.id, titleBuffer.trim());
                                    }
                                    setInlineEditingId(null);
                                  }}
                                >
                                  <Check size={14} color="#000" />
                                </Pressable>
                              </View>
                            ) : (
                              <Text className="mt-1 font-heading text-xl uppercase text-ink">{week.name || `Structure Week ${week.weekNumber}`}</Text>
                            )}
                          </View>
                          <View className="flex-row items-center gap-2">
                            <Pressable className="p-2 border border-fog bg-paper rounded active:bg-zinc/10" onPress={() => startInlineTitleEditing(week.id, week.name)}>
                              <Pencil size={14} color="#A1A1AA" />
                            </Pressable>
                            <Pressable className="p-2 border border-red-900 bg-red-950/20 rounded active:bg-red-950/30" onPress={() => handleDeleteWeek(selectedTemplate.id, week.id, week.weekNumber)}>
                              <Trash2 size={14} color="#EF4444" />
                            </Pressable>
                          </View>
                        </View>

                        <View className="p-4 gap-4">
                          {week.days?.map((day) => (
                            <View key={day.id} className="border border-fog bg-canvas p-3 rounded">
                              
                              <View className="flex-row justify-between items-center mb-3 pb-2 border-b border-fog">
                                <View className="flex-1 pr-3">
                                  {inlineEditingId === day.id ? (
                                    <View className="flex-row items-center gap-2">
                                      <TextInput
                                        className="flex-1 font-heading text-base uppercase text-yellow-400 bg-paper border border-signal px-2 py-0.5 rounded"
                                        value={titleBuffer}
                                        onChangeText={setTitleBuffer}
                                      />
                                      <Pressable
                                        className="p-1.5 bg-signal rounded"
                                        onPress={async () => {
                                          if (titleBuffer.trim()) {
                                            await updateTemplateDay(selectedTemplate.id, week.id, day.id, { name: titleBuffer.trim(), focus: day.focus });
                                          }
                                          setInlineEditingId(null);
                                        }}
                                      >
                                        <Check size={12} color="#000" />
                                      </Pressable>
                                    </View>
                                  ) : (
                                    <Text className="font-heading text-base uppercase text-ink">{day.name} <Text className="font-sans text-xs text-muted normal-case font-normal">({day.focus})</Text></Text>
                                  )}
                                </View>
                                <View className="flex-row items-center gap-1.5">
                                  <Pressable className="p-1.5 border border-fog bg-paper rounded" onPress={() => startInlineTitleEditing(day.id, day.name)}>
                                    <Pencil size={12} color="#A1A1AA" />
                                  </Pressable>
                                  <Pressable className="p-1.5 border border-red-900 bg-red-950/20 rounded" onPress={() => handleDeleteDay(selectedTemplate.id, week.id, day.id, day.name)}>
                                    <Trash2 size={12} color="#EF4444" />
                                  </Pressable>
                                </View>
                              </View>

                              <View className="gap-2 mb-3">
                                {day.exercises?.map((exercise) => (
                                  <View key={exercise.id} className="bg-paper p-2.5 border border-fog rounded">
                                    <View className="flex-row items-center justify-between">
                                      <View className="flex-1 pr-2">
                                        {inlineEditingId === exercise.id ? (
                                          <View className="flex-row items-center gap-2">
                                            <TextInput
                                              className="flex-1 font-heading text-sm text-yellow-400 bg-canvas border border-signal px-1.5 py-0.5 rounded"
                                              value={titleBuffer}
                                              onChangeText={setTitleBuffer}
                                            />
                                            <Pressable
                                              className="p-1 bg-signal rounded"
                                              onPress={async () => {
                                                if (titleBuffer.trim()) {
                                                  await updateTemplateExercise(selectedTemplate.id, week.id, day.id, { ...exercise, name: titleBuffer.trim() });
                                                }
                                                setInlineEditingId(null);
                                              }}
                                            >
                                              <Check size={10} color="#000" />
                                            </Pressable>
                                          </View>
                                        ) : (
                                          <>
                                            <Text className="font-heading text-sm text-ink">{exercise.name}</Text>
                                            <Text className="font-mono text-[11px] text-muted uppercase mt-0.5">
                                              {exercise.category} · {exercise.sets} Sets × {exercise.repetitions} Reps · {prescription(exercise)}
                                            </Text>
                                          </>
                                        )}
                                      </View>
                                      
                                      <View className="flex-row items-center gap-1">
                                        <Pressable className="p-1 border border-fog rounded bg-canvas" onPress={() => startInlineTitleEditing(exercise.id, exercise.name)}>
                                          <Pencil size={11} color="#A1A1AA" />
                                        </Pressable>
                                        <Pressable className="p-1 border border-fog rounded bg-canvas" onPress={() => setExerciseEditor({ templateId: selectedTemplate.id, weekId: week.id, dayId: day.id, exercise })}>
                                          <ClipboardList size={11} color="#A1A1AA" />
                                        </Pressable>
                                        <Pressable className="p-1 border border-red-900 bg-red-950/20 rounded" onPress={() => handleDeleteExercise(selectedTemplate.id, week.id, day.id, exercise.id, exercise.name)}>
                                          <Trash2 size={11} color="#EF4444" />
                                        </Pressable>
                                      </View>
                                    </View>
                                  </View>
                                ))}
                              </View>

                                                            {/* --- INDIVIDUAL SBD AND ACCESSORY BUTTON TRIGGERS --- */}
                              <View className="flex-row flex-wrap gap-2 mt-2">
                                <Pressable 
                                  className="flex-1 min-w-[70px] flex-row items-center justify-center gap-1 bg-signal/10 border border-signal/40 py-2 rounded active:bg-signal/20"
                                  onPress={() => void addTemplateExercise(selectedTemplate.id, week.id, day.id, "squat")}
                                >
                                  <Dumbbell size={11} color="#CCFF00" />
                                  <Text className="font-heading text-[10px] uppercase text-ink">Squat</Text>
                                </Pressable>
                                <Pressable 
                                  className="flex-1 min-w-[70px] flex-row items-center justify-center gap-1 bg-signal/10 border border-signal/40 py-2 rounded active:bg-signal/20"
                                  onPress={() => void addTemplateExercise(selectedTemplate.id, week.id, day.id, "bench")}
                                >
                                  <Dumbbell size={11} color="#CCFF00" />
                                  <Text className="font-heading text-[10px] uppercase text-ink">Bench</Text>
                                </Pressable>
                                <Pressable 
                                  className="flex-1 min-w-[70px] flex-row items-center justify-center gap-1 bg-signal/10 border border-signal/40 py-2 rounded active:bg-signal/20"
                                  onPress={() => void addTemplateExercise(selectedTemplate.id, week.id, day.id, "deadlift")}
                                >
                                  <Dumbbell size={11} color="#CCFF00" />
                                  <Text className="font-heading text-[10px] uppercase text-ink">Deadlift</Text>
                                </Pressable>
                                <Pressable 
                                  className="flex-1 min-w-[70px] flex-row items-center justify-center gap-1 bg-zinc/10 border border-zinc/40 py-2 rounded active:bg-zinc/20"
                                  onPress={() => void addTemplateExercise(selectedTemplate.id, week.id, day.id, "accessory")}
                                >
                                  <Plus size={11} color="#A1A1AA" />
                                  <Text className="font-heading text-[10px] uppercase text-muted">Accessory</Text>
                                </Pressable>
                              </View>

                            </View>
                          ))}

                          {week.days.length >= 7 ? <View className="border border-dashed border-fog p-3 rounded bg-canvas/40"><Text className="font-heading text-xs uppercase text-muted">Maximum 7 training days reached</Text></View> : <View className="border border-dashed border-fog p-3 rounded bg-canvas/40">
                            <Text className="font-heading text-xs uppercase text-muted mb-2">New Training Day</Text>
                            <View className="flex-col gap-2 sm:flex-row">
                              <TextInput 
                                className="flex-1 min-h-10 border border-fog bg-paper px-2 py-1 text-xs text-ink rounded" 
                                placeholder="Day title (e.g., Squat Intensity)" 
                                placeholderTextColor="#71717A"
                                value={dayDraft.name} 
                                onChangeText={(name) => setDayDrafts((curr) => ({ ...curr, [week.id]: { ...dayDraft, name } }))} 
                              />
                              <TextInput 
                                className="flex-1 min-h-10 border border-fog bg-paper px-2 py-1 text-xs text-ink rounded" 
                                placeholder="Focus (e.g., Heavy Compound)" 
                                placeholderTextColor="#71717A"
                                value={dayDraft.focus} 
                                onChangeText={(focus) => setDayDrafts((curr) => ({ ...curr, [week.id]: { ...dayDraft, focus } }))} 
                              />
                              <Pressable className="bg-signal px-3 justify-center items-center h-10 rounded" onPress={() => void saveDay(selectedTemplate.id, week.id)}>
                                <Text className="font-heading text-xs uppercase text-white">Add Day</Text>
                              </Pressable>
                            </View>
                          </View>}

                        </View>
                      </View>
                    ); 
                  })}
                </View>

            <Pressable 
              className="min-h-12 border border-dashed border-fog bg-paper flex-row justify-center items-center gap-2 rounded mt-2 active:bg-canvas" 
              onPress={() => void addTemplateWeek(selectedTemplate.id)}
            >
              <Plus size={16} color="#A1A1AA" />
              <Text className="font-heading text-sm uppercase text-ink">Add New Training Week</Text>
            </Pressable>

              </>
            ) : null}
          </View>
        ) : (
          <View className="border border-dashed border-fog p-10 items-center justify-center">
            <ClipboardList size={32} color="#71717A" />
            <Text className="mt-4 font-heading text-lg uppercase text-muted">No configuration templates active</Text>
            <Text className="mt-1 font-sans text-sm text-zinc text-center">Click "New Template" at the top to configure your first master blueprint block.</Text>
          </View>
        )}

        {exerciseEditor ? (
          <Modal transparent animationType="slide" visible={!!exerciseEditor} onRequestClose={() => setExerciseEditor(null)}>
            <View className="flex-1 justify-end bg-black/60">
              <View className="w-full bg-paper border-t border-fog p-5 max-w-2xl mx-auto rounded-t-2xl">
                <View className="flex-row items-center justify-between pb-3 border-b border-fog">
                  <Text className="font-heading text-lg uppercase text-ink">Configure Prescription</Text>
                  <Pressable className="p-1" onPress={() => setExerciseEditor(null)}><X size={20} color="#F4F4ED" /></Pressable>
                </View>
                <ScrollView className="max-h-[70vh] mt-4 gap-4" showsVerticalScrollIndicator={false}>
                  {exerciseEditor.exercise.category === "accessory" ? <AccessoryExercisePicker
                    label="Exercise movement"
                    value={exerciseEditor.exercise.name}
                    onSelect={(name) => setExerciseEditor((current) => current ? { ...current, exercise: { ...current.exercise, name } } : null)}
                  /> : <Field
                    label="Exercise Movement Name"
                    value={exerciseEditor.exercise.name}
                    onChangeText={(name) => setExerciseEditor((current) => current ? { ...current, exercise: { ...current.exercise, name } } : null)}
                  />}
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Field 
                        label="Sets" 
                        value={exerciseEditor.exercise.sets.toString()} 
                        keyboardType="number-pad" 
                        onChangeText={(val) => setExerciseEditor((curr) => curr ? { ...curr, exercise: { ...curr.exercise, sets: Number(val) || 0 } } : null)} 
                      />
                    </View>
                    <View className="flex-1">
                      <Field 
                        label="Repetitions" 
                        value={exerciseEditor.exercise.repetitions.toString()} 
                        keyboardType="number-pad" 
                        onChangeText={(val) => setExerciseEditor((curr) => curr ? { ...curr, exercise: { ...curr.exercise, repetitions: Number(val) || 0 } } : null)} 
                      />
                    </View>
                  </View>
                  
                  <View>
                    <Text className="font-heading text-xs uppercase text-muted">Movement Classification</Text>
                    <View className="flex-row flex-wrap gap-2 mt-1.5">
                      {exerciseCategories.map((cat) => (
                        <Pressable 
                          key={cat.value} 
                          className={`border px-3 py-1.5 rounded ${exerciseEditor.exercise.category === cat.value ? "border-signal bg-signal/10" : "border-fog bg-canvas"}`}
                          onPress={() => setExerciseEditor((curr) => curr ? { ...curr, exercise: { ...curr.exercise, category: cat.value } } : null)}
                        >
                          <Text className={`font-heading text-xs uppercase ${exerciseEditor.exercise.category === cat.value ? "text-ink" : "text-muted"}`}>{cat.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className="mb-1.5 font-heading text-xs uppercase text-muted">Target Metric Mode</Text>
                      <View className="flex-row gap-1">
                        {(["exact", "percent", "rpe", "rir"] as const).map((m) => (
                          <Pressable 
                            key={m} 
                            className={`flex-1 border py-1.5 items-center rounded ${exerciseEditor.exercise.prescriptionMode === m ? "border-signal bg-signal/10" : "border-fog bg-canvas"}`}
                            onPress={() => setExerciseEditor((curr) => curr ? { ...curr, exercise: { ...curr.exercise, prescriptionMode: m } } : null)}
                          >
                            <Text className="font-heading text-[10px] uppercase text-ink">{m}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    <View className="w-1/3">
                      <Field 
                        label="Target Value" 
                        value={exerciseEditor.exercise.prescriptionValue.toString()} 
                        keyboardType="number-pad" 
                        onChangeText={(val) => setExerciseEditor((curr) => curr ? { ...curr, exercise: { ...curr.exercise, prescriptionValue: Number(val) || 0 } } : null)} 
                      />
                    </View>
                  </View>

                </ScrollView>
                <Pressable className="mt-5 min-h-12 bg-signal flex-row justify-center items-center gap-2 rounded" onPress={() => void saveExercise()}>
                  <Save size={16} color="#F4F4ED" />
                  <Text className="font-heading text-sm uppercase text-white">Commit Prescription</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        ) : null}

      </ScrollView>
    </AppShell>
  );
}