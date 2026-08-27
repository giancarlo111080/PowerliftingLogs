import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Bell, CalendarDays, ClipboardCheck, Pencil, Save, Trophy, Users, X } from "lucide-react-native";

import { useProxySession } from "../auth/ProxySessionContext";
import { achievements } from "../data/dashboardData";
import { AppShell } from "./AppShell";

interface ProfileDraft {
  displayName: string;
  bodyWeightKg: string;
  competitionWeightClass: string;
  squatOneRepMaxKg: string;
  benchOneRepMaxKg: string;
  deadliftOneRepMaxKg: string;
  activeBlock: string;
  upcomingMeet: string;
}

function createDraft(profile: NonNullable<ReturnType<typeof useProxySession>["currentProfile"]>): ProfileDraft {
  return {
    displayName: profile.displayName,
    bodyWeightKg: profile.bodyWeightKg?.toString() ?? "",
    competitionWeightClass: profile.competitionWeightClass ?? "",
    squatOneRepMaxKg: profile.squatOneRepMaxKg?.toString() ?? "",
    benchOneRepMaxKg: profile.benchOneRepMaxKg?.toString() ?? "",
    deadliftOneRepMaxKg: profile.deadliftOneRepMaxKg?.toString() ?? "",
    activeBlock: profile.activeBlock ?? "",
    upcomingMeet: profile.upcomingMeet ?? ""
  };
}

function EditableField({ label, value, onChangeText, keyboardType = "default" }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: "default" | "decimal-pad" }) {
  return <View className="mb-4"><Text className="mb-1.5 font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">{label}</Text><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={value} onChangeText={onChangeText} keyboardType={keyboardType} accessibilityLabel={label} /></View>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View className="flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">{label}</Text><Text className="mt-1 font-serif text-base font-bold text-ink">{value}</Text></View>;
}

export function ProfileScreen() {
  const { currentProfile, session, updateCurrentProfile } = useProxySession();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentProfile) {
      setDraft(createDraft(currentProfile));
    }
  }, [currentProfile]);

  if (!currentProfile || !session || !draft) {
    return null;
  }

  const isLifter = session.role === "lifter";

  function updateDraft(field: keyof ProfileDraft, value: string) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  }

  function readPositiveNumber(value: string, fallback: number | undefined) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  async function saveProfile() {
    const currentDraft = draft;
    const profile = currentProfile;
    if (!currentDraft || !profile) {
      return;
    }

    if (!currentDraft.displayName.trim()) {
      setValidationMessage("Display name is required.");
      return;
    }

    if (isLifter && (!readPositiveNumber(currentDraft.bodyWeightKg, undefined) || !readPositiveNumber(currentDraft.squatOneRepMaxKg, undefined) || !readPositiveNumber(currentDraft.benchOneRepMaxKg, undefined) || !readPositiveNumber(currentDraft.deadliftOneRepMaxKg, undefined))) {
      setValidationMessage("Body weight and each 1RM must be positive numbers.");
      return;
    }

    await updateCurrentProfile({
      displayName: currentDraft.displayName.trim(),
      bodyWeightKg: readPositiveNumber(currentDraft.bodyWeightKg, profile.bodyWeightKg),
      competitionWeightClass: currentDraft.competitionWeightClass.trim(),
      squatOneRepMaxKg: readPositiveNumber(currentDraft.squatOneRepMaxKg, profile.squatOneRepMaxKg),
      benchOneRepMaxKg: readPositiveNumber(currentDraft.benchOneRepMaxKg, profile.benchOneRepMaxKg),
      deadliftOneRepMaxKg: readPositiveNumber(currentDraft.deadliftOneRepMaxKg, profile.deadliftOneRepMaxKg),
      activeBlock: currentDraft.activeBlock.trim(),
      upcomingMeet: currentDraft.upcomingMeet.trim()
    });
    setValidationMessage(null);
    setIsEditing(false);
  }

  function cancelEdit() {
    if (!currentProfile) {
      return;
    }
    setDraft(createDraft(currentProfile));
    setValidationMessage(null);
    setIsEditing(false);
  }

  return (
    <AppShell title="Profile">
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-5xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
        <View className="flex-col gap-4 border-l-4 border-signal pl-4 sm:flex-row sm:items-end sm:justify-between">
          <View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{isLifter ? "Lifter profile" : "Coach profile"}</Text><Text className="mt-2 font-serif text-3xl font-bold text-ink">{currentProfile.displayName}</Text><Text className="mt-2 font-serif text-base text-[#52675F]">{currentProfile.email}</Text></View>
          {isEditing ? <View className="flex-row gap-2"><Pressable className="min-h-10 flex-row items-center gap-2 rounded-md border border-fog px-3 py-2" onPress={cancelEdit}><X size={16} color="#17212B" /><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="min-h-10 flex-row items-center gap-2 rounded-md bg-ink px-3 py-2" onPress={() => void saveProfile()}><Save size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Save changes</Text></Pressable></View> : <Pressable className="min-h-10 flex-row items-center gap-2 rounded-md bg-ink px-3 py-2" onPress={() => setIsEditing(true)}><Pencil size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Edit profile</Text></Pressable>}
        </View>

        {validationMessage ? <View className="border border-signal bg-[#D74F3212] px-4 py-3"><Text className="font-serif text-sm text-signal">{validationMessage}</Text></View> : null}

        {isEditing ? (
          <View className="border border-fog bg-paper p-5">
            <Text className="mb-5 font-serif text-xl font-bold text-ink">Editable details</Text>
            <EditableField label="Display name" value={draft.displayName} onChangeText={(value) => updateDraft("displayName", value)} />
            {isLifter ? <><View className="flex-col gap-0 sm:flex-row sm:gap-4"><View className="flex-1"><EditableField label="Body weight (kg)" value={draft.bodyWeightKg} onChangeText={(value) => updateDraft("bodyWeightKg", value)} keyboardType="decimal-pad" /></View><View className="flex-1"><EditableField label="Weight class" value={draft.competitionWeightClass} onChangeText={(value) => updateDraft("competitionWeightClass", value)} /></View></View><View className="flex-col gap-0 sm:flex-row sm:gap-4"><View className="flex-1"><EditableField label="Squat 1RM (kg)" value={draft.squatOneRepMaxKg} onChangeText={(value) => updateDraft("squatOneRepMaxKg", value)} keyboardType="decimal-pad" /></View><View className="flex-1"><EditableField label="Bench 1RM (kg)" value={draft.benchOneRepMaxKg} onChangeText={(value) => updateDraft("benchOneRepMaxKg", value)} keyboardType="decimal-pad" /></View><View className="flex-1"><EditableField label="Deadlift 1RM (kg)" value={draft.deadliftOneRepMaxKg} onChangeText={(value) => updateDraft("deadliftOneRepMaxKg", value)} keyboardType="decimal-pad" /></View></View><EditableField label="Active block" value={draft.activeBlock} onChangeText={(value) => updateDraft("activeBlock", value)} /><EditableField label="Upcoming meet" value={draft.upcomingMeet} onChangeText={(value) => updateDraft("upcomingMeet", value)} /></> : <Text className="font-serif text-sm leading-6 text-[#52675F]">Coach assignment totals are managed by the coaching workspace. You can update your display identity and notification preference below.</Text>}
          </View>
        ) : isLifter ? (
          <View className="gap-5"><View className="border border-fog bg-paper p-5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Competition profile</Text><View className="mt-5 flex-col gap-5 lg:flex-row"><Detail label="Body weight" value={`${currentProfile.bodyWeightKg} kg`} /><Detail label="Sex" value={currentProfile.sex ?? "Not set"} /><Detail label="Weight class" value={currentProfile.competitionWeightClass ?? "Not set"} /><Detail label="Current block" value={currentProfile.activeBlock ?? "Not set"} /><Detail label="Upcoming meet" value={currentProfile.upcomingMeet ?? "Not set"} /></View></View><View className="border border-fog bg-paper p-5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Main lift baselines</Text><View className="mt-5 flex-col gap-5 sm:flex-row"><Detail label="Squat" value={`${currentProfile.squatOneRepMaxKg} kg`} /><Detail label="Bench press" value={`${currentProfile.benchOneRepMaxKg} kg`} /><Detail label="Deadlift" value={`${currentProfile.deadliftOneRepMaxKg} kg`} /></View></View><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Progress record</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">Achievements</Text><View className="mt-3 border border-fog bg-paper">{achievements.map((achievement, index) => <View key={achievement.code} className={`flex-row items-center gap-3 px-4 py-4 ${index ? "border-t border-fog" : ""}`}><Trophy size={18} color="#A36F05" /><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{achievement.title}</Text><Text className="mt-0.5 font-serif text-xs text-[#52675F]">{achievement.detail}</Text></View></View>)}</View></View></View>
        ) : (
          <View className="gap-5"><View className="border border-fog bg-paper p-5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Coaching workload</Text><View className="mt-5 flex-col gap-5 sm:flex-row"><View className="flex-1"><Users size={21} color="#2E6F5E" /><Text className="mt-2 font-serif text-3xl font-bold text-ink">{currentProfile.assignedAthleteCount}</Text><Text className="font-serif text-sm text-[#52675F]">assigned athletes</Text></View><View className="flex-1"><ClipboardCheck size={21} color="#D74F32" /><Text className="mt-2 font-serif text-3xl font-bold text-ink">{currentProfile.reviewWorkload}</Text><Text className="font-serif text-sm text-[#52675F]">reviews waiting</Text></View><View className="flex-1"><CalendarDays size={21} color="#17212B" /><Text className="mt-2 font-serif text-3xl font-bold text-ink">This week</Text><Text className="font-serif text-sm text-[#52675F]">program check-in window</Text></View></View></View></View>
        )}

        <View className="border border-fog bg-paper p-5"><View className="flex-row items-center justify-between"><View className="flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center rounded-md bg-[#2E6F5E1A]"><Bell size={19} color="#2E6F5E" /></View><View><Text className="font-serif text-base font-bold text-ink">Review notifications</Text><Text className="mt-0.5 font-serif text-xs text-[#52675F]">New messages, form flags, and submitted footage</Text></View></View><Switch value={currentProfile.notificationsEnabled} onValueChange={(value) => void updateCurrentProfile({ notificationsEnabled: value })} trackColor={{ false: "#DDE5E1", true: "#2E6F5E" }} accessibilityLabel="Toggle review notifications" /></View></View>
      </ScrollView>
    </AppShell>
  );
}