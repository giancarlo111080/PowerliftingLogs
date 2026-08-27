import { useState } from "react";
import { ImageBackground, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Check, Circle, ExternalLink, Flame, Gauge, Instagram, Link2, Minus, RefreshCcw, Trophy } from "lucide-react-native";

import { useSyncWorkout } from "../hooks/useSyncWorkout";
import type { PrescribedExercise, TrainingSet } from "../types/training";
import { InstagramLinkModal } from "./InstagramLinkModal";

const headerImage = "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1200&q=85";

function statusIcon(status: TrainingSet["completionStatus"]) {
  if (status === "done") {
    return <Check size={17} color="#FFFFFF" strokeWidth={3} />;
  }
  if (status === "skipped") {
    return <Minus size={17} color="#FFFFFF" strokeWidth={3} />;
  }
  return <Circle size={17} color="#688078" strokeWidth={2} />;
}

function SetRow({
  trainingSet,
  exercise,
  onDone,
  onSkip,
  onInstagram
}: {
  trainingSet: TrainingSet;
  exercise: PrescribedExercise;
  onDone: () => void;
  onSkip: () => void;
  onInstagram: () => void;
}) {
  const done = trainingSet.completionStatus === "done";
  const skipped = trainingSet.completionStatus === "skipped";

  return (
    <View className="border-t border-fog py-3">
      <View className="flex-row items-center">
        <Text className="w-8 font-serif text-sm font-bold text-ink">{trainingSet.setNumber}</Text>
        <View className="flex-1">
          <Text className="font-serif text-base font-bold text-ink">
            {trainingSet.targetRepetitions} reps <Text className="font-normal text-[#52675F]">at</Text> {trainingSet.targetLoadKg} kg
          </Text>
          <Text className="mt-0.5 font-serif text-sm text-[#52675F]">Target RPE {trainingSet.targetRpe.toFixed(1)} · e1RM {trainingSet.targetEstimatedOneRepMaxKg} kg</Text>
        </View>
        <View className="ml-3 flex-row gap-2">
          <Pressable
            className={`h-10 w-10 items-center justify-center rounded-md border ${done ? "border-moss bg-moss" : "border-fog bg-paper"}`}
            onPress={onDone}
            accessibilityLabel={`Mark set ${trainingSet.setNumber} of ${exercise.name} done`}
          >
            {statusIcon(done ? "done" : "pending")}
          </Pressable>
          <Pressable
            className={`h-10 w-10 items-center justify-center rounded-md border ${skipped ? "border-signal bg-signal" : "border-fog bg-paper"}`}
            onPress={onSkip}
            accessibilityLabel={`Mark set ${trainingSet.setNumber} of ${exercise.name} skipped`}
          >
            {statusIcon(skipped ? "skipped" : "pending")}
          </Pressable>
        </View>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        {trainingSet.instagramVideoUrl ? (
          <Pressable
            className="flex-row items-center gap-1.5"
            onPress={() => Linking.openURL(trainingSet.instagramVideoUrl!)}
            accessibilityLabel={`Open Instagram video for set ${trainingSet.setNumber}`}
          >
            <Instagram size={16} color="#D74F32" />
            <Text className="font-serif text-sm font-bold text-signal">Instagram linked</Text>
            <ExternalLink size={14} color="#D74F32" />
          </Pressable>
        ) : (
          <Text className="font-serif text-sm text-[#688078]">No video link</Text>
        )}
        <Pressable
          className="flex-row items-center gap-1.5 rounded-md bg-canvas px-3 py-2"
          onPress={onInstagram}
          accessibilityLabel={`Add Instagram video link for set ${trainingSet.setNumber}`}
        >
          <Link2 size={15} color="#17212B" />
          <Text className="font-serif text-sm font-bold text-ink">Instagram</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function WorkoutScreen() {
  const { workout, isLoading, error, queueCount, isSyncing, logSet, attachInstagramLink, flush, reload } = useSyncWorkout();
  const [selected, setSelected] = useState<{ set: TrainingSet; exercise: PrescribedExercise } | null>(null);

  if (isLoading) {
    return <View className="flex-1 items-center justify-center bg-canvas"><Text className="font-serif text-base text-ink">Loading training log</Text></View>;
  }

  if (!workout) {
    const message = error instanceof Error ? error.message : "Training data could not be loaded.";
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-6">
        <Text className="font-serif text-xl font-bold text-ink">Training unavailable</Text>
        <Text className="mt-2 text-center font-serif text-sm text-[#52675F]">{message}</Text>
        <Pressable className="mt-5 flex-row items-center gap-2 rounded-md bg-ink px-4 py-3" onPress={() => reload()} accessibilityLabel="Retry loading training">
          <RefreshCcw size={17} color="#FFFFFF" />
          <Text className="font-serif text-sm font-bold text-white">Retry</Text>
        </Pressable>
      </View>
    );
  }

  const completedSets = workout.day.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completionStatus === "done").length;
  const totalSets = workout.day.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const completion = Math.round((completedSets / totalSets) * 100);

  return (
    <View className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="pb-12" showsVerticalScrollIndicator={false}>
        <ImageBackground source={{ uri: headerImage }} imageStyle={{ borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }} className="h-48 justify-end overflow-hidden">
          <View className="bg-black/55 px-5 pb-5 pt-12">
            <Text className="font-serif text-xs font-bold uppercase tracking-widest text-straw">{workout.athlete.activeBlockTag}</Text>
            <Text className="mt-1 font-serif text-3xl font-bold text-white">{workout.day.name}</Text>
            <Text className="mt-1 font-serif text-base text-white">{workout.day.focus}</Text>
          </View>
        </ImageBackground>

        <View className="px-4 pt-5">
          <View className="flex-row gap-3">
            <View className="flex-1 rounded-md bg-paper p-4">
              <View className="flex-row items-center gap-2"><Gauge size={18} color="#2E6F5E" /><Text className="font-serif text-sm font-bold text-ink">Readiness</Text></View>
              <Text className="mt-3 font-serif text-3xl font-bold text-moss">{workout.athlete.readinessScore}</Text>
              <Text className="font-serif text-xs text-[#52675F]">Acute {workout.athlete.acuteLoad} / chronic {workout.athlete.chronicLoad}</Text>
            </View>
            <View className="flex-1 rounded-md bg-paper p-4">
              <View className="flex-row items-center gap-2"><Trophy size={18} color="#D74F32" /><Text className="font-serif text-sm font-bold text-ink">Progress</Text></View>
              <Text className="mt-3 font-serif text-3xl font-bold text-signal">{completion}%</Text>
              <Text className="font-serif text-xs text-[#52675F]">{completedSets} of {totalSets} prescribed sets</Text>
            </View>
          </View>

          <View className="mt-4 flex-row items-center justify-between rounded-md border border-fog bg-paper px-4 py-3">
            <View className="flex-row items-center gap-2"><Flame size={18} color="#D74F32" /><Text className="font-serif text-base font-bold text-ink">{workout.athlete.workoutStreak} day streak</Text></View>
            <Text className="font-serif text-sm text-[#52675F]">{workout.athlete.experiencePoints.toLocaleString()} XP</Text>
          </View>

          <View className="mt-6 flex-row items-end justify-between">
            <View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Today</Text><Text className="mt-1 font-serif text-2xl font-bold text-ink">Training log</Text></View>
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-md bg-ink disabled:opacity-50"
              onPress={() => flush()}
              disabled={queueCount === 0 || isSyncing}
              accessibilityLabel="Synchronize offline workout changes"
            >
              <RefreshCcw size={18} color="#FFFFFF" />
            </Pressable>
          </View>
          <Text className="mt-1 font-serif text-sm text-[#52675F]">{queueCount ? `${queueCount} local change${queueCount === 1 ? "" : "s"} waiting to sync` : "All training changes synchronized"}</Text>

          <View className="mt-4 gap-4">
            {workout.day.exercises.map((exercise) => (
              <View key={exercise.id} className="rounded-md bg-paper px-4 py-1">
                <View className="py-4"><Text className="font-serif text-lg font-bold text-ink">{exercise.name}</Text><Text className="mt-0.5 font-serif text-sm text-[#52675F]">e1RM target {exercise.targetEstimatedOneRepMaxKg} kg</Text></View>
                {exercise.sets.map((trainingSet) => (
                  <SetRow
                    key={trainingSet.id}
                    trainingSet={trainingSet}
                    exercise={exercise}
                    onDone={() => logSet({ setId: trainingSet.id, completionStatus: "done" })}
                    onSkip={() => logSet({ setId: trainingSet.id, completionStatus: "skipped" })}
                    onInstagram={() => setSelected({ set: trainingSet, exercise })}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <InstagramLinkModal
        visible={selected !== null}
        exerciseName={selected?.exercise.name ?? ""}
        onClose={() => setSelected(null)}
        onSave={async (instagramVideoUrl) => {
          if (selected) {
            await attachInstagramLink({ setId: selected.set.id, instagramVideoUrl });
          }
        }}
      />
    </View>
  );
}
