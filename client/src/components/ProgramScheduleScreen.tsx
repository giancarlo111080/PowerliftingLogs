import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { CalendarDays, ChevronRight, RotateCcw, Save } from "lucide-react-native";

import { useSession } from "../auth/AuthSessionContext";
import { type TrainingProgram, useProgramWorkspaceStore } from "../data/programWorkspaceStore";
import { AppShell } from "./AppShell";
import { DatePickerField } from "./DatePickerField";

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00.000Z`));
}

function DateField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return <DatePickerField label={label} value={value} onChangeText={onChangeText} />;
}

export function ProgramScheduleScreen() {
  const { session, currentProfile, activeAthlete } = useSession();
  const { programs, isLoading, rescheduleDay, rescheduleWeek } = useProgramWorkspaceStore();
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [dayDates, setDayDates] = useState<Record<string, string>>({});
  const [weekStartDates, setWeekStartDates] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const isCoach = session?.role === "COACH";
  const athlete = isCoach ? activeAthlete : currentProfile;
  const athletePrograms = programs
    .filter((program) => program.athleteId === athlete?.id)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const selectedProgram = athletePrograms.find((program) => program.id === selectedProgramId)
    ?? athletePrograms.find((program) => program.status === "active")
    ?? athletePrograms[0]
    ?? null;

  if (!session || !currentProfile) {
    return <AppShell title="Program Schedule"><View className="flex-1 items-center justify-center"><ActivityIndicator color="#2E6F5E" /></View></AppShell>;
  }
  if (isCoach && !activeAthlete) {
    return <AppShell title="Program Schedule"><View className="flex-1 items-center justify-center px-5"><Text className="font-serif text-lg font-bold text-ink">No athlete selected</Text><Text className="mt-2 max-w-md text-center font-serif text-sm leading-6 text-muted">Link an athlete to this coach account, or select an available athlete from the sidebar.</Text></View></AppShell>;
  }
  if (!athlete) {
    return null;
  }
  const actorRole = session.role === "COACH" ? "coach" : "lifter";

  async function saveDayDate(program: TrainingProgram, weekId: string, dayId: string, existingDate: string) {
    const scheduledDate = dayDates[dayId] ?? existingDate;
    if (!isValidIsoDate(scheduledDate)) {
      setMessage("Enter a real date as YYYY-MM-DD.");
      return;
    }
    await rescheduleDay(program.id, weekId, dayId, scheduledDate, actorRole);
    setDayDates((dates) => ({ ...dates, [dayId]: scheduledDate }));
    setMessage(`Workout moved to ${formatDate(scheduledDate)}.`);
  }

  async function shiftWeek(program: TrainingProgram, weekId: string, firstDayDate: string) {
    const startDate = weekStartDates[weekId] ?? firstDayDate;
    if (!isValidIsoDate(startDate)) {
      setMessage("Enter a real week start as YYYY-MM-DD.");
      return;
    }
    await rescheduleWeek(program.id, weekId, startDate, actorRole);
    const scheduledDayIds = program.weeks.find((week) => week.id === weekId)?.days.map((day) => day.id) ?? [];
    setDayDates((dates) => Object.fromEntries(Object.entries(dates).filter(([dayId]) => !scheduledDayIds.includes(dayId))));
    setWeekStartDates((dates) => ({ ...dates, [weekId]: startDate }));
    setMessage("Week schedule updated.");
  }

  return (
    <AppShell title="Program Schedule">
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-6xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
        <View className="border-l-4 border-signal pl-4">
          <Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{isCoach ? "Coach scheduling" : "Your training calendar"}</Text>
          <Text className="mt-2 font-serif text-3xl font-bold text-ink">{isCoach ? `${athlete.displayName}'s dates` : "Adjust your training dates"}</Text>
          <Text className="mt-2 font-serif text-base text-[#52675F]">{isCoach ? "Set a planned date for every workout in the program." : "Move a workout or shift the rest of a week when training needs to change."}</Text>
        </View>

        {message ? <View className="border border-moss bg-[#2E6F5E12] px-4 py-3"><Text className="font-serif text-sm text-moss">{message}</Text></View> : null}
        {isLoading ? <View className="items-center border border-fog bg-paper py-12"><ActivityIndicator color="#2E6F5E" /><Text className="mt-3 font-serif text-sm text-[#52675F]">Loading program schedule</Text></View> : null}

        {!isLoading && athletePrograms.length ? <>
          <View>
            <Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Program</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="mt-2 gap-2">
              {athletePrograms.map((program) => <Pressable key={program.id} className={`w-56 border p-3 ${selectedProgram?.id === program.id ? "border-ink bg-ink" : "border-fog bg-paper"}`} onPress={() => setSelectedProgramId(program.id)}><Text className={`font-serif text-sm font-bold ${selectedProgram?.id === program.id ? "text-white" : "text-ink"}`}>{program.name}</Text><Text className={`mt-1 font-serif text-xs ${selectedProgram?.id === program.id ? "text-[#FFFFFFCC]" : "text-[#52675F]"}`}>{program.status}</Text></Pressable>)}
            </ScrollView>
          </View>

          {selectedProgram ? <View className="gap-4">
            {[...selectedProgram.weeks].sort((left, right) => left.weekNumber - right.weekNumber).map((week) => {
              const sortedDays = [...week.days].sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate));
              const firstDate = sortedDays[0]?.scheduledDate ?? selectedProgram.startDate;
              const weekStartDate = weekStartDates[week.id] ?? firstDate;
              return <View key={week.id} className="border border-fog bg-paper">
                <View className="flex-col gap-3 border-b border-fog bg-canvas px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Week {week.weekNumber}</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">{week.name}</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">{sortedDays.length} planned workout{sortedDays.length === 1 ? "" : "s"}</Text></View>
                  {sortedDays.length ? <View className="flex-col gap-2 sm:flex-row sm:items-end"><DateField label="Move week from" value={weekStartDate} onChangeText={(value) => setWeekStartDates((dates) => ({ ...dates, [week.id]: value }))} /><Pressable className="min-h-11 flex-row items-center justify-center gap-2 rounded-md bg-ink px-3 py-2" onPress={() => void shiftWeek(selectedProgram, week.id, firstDate)} accessibilityLabel={`Move all workouts in ${week.name}`}><RotateCcw size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Move week</Text></Pressable></View> : null}
                </View>
                {sortedDays.length ? sortedDays.map((day) => {
                  const scheduledDate = dayDates[day.id] ?? day.scheduledDate;
                  return <View key={day.id} className="flex-col gap-3 border-b border-fog px-4 py-4 last:border-b-0 sm:flex-row sm:items-end"><View className="flex-1"><View className="flex-row items-center gap-2"><CalendarDays size={17} color="#2E6F5E" /><Text className="font-serif text-base font-bold text-ink">{day.name}</Text></View><Text className="mt-1 font-serif text-sm text-[#52675F]">{day.focus}</Text><Text className="mt-2 font-serif text-xs text-[#688078]">Currently {formatDate(day.scheduledDate)}{day.scheduleUpdatedBy === "lifter" ? " · adjusted by athlete" : ""}</Text></View><View className="flex-1"><DateField label={isCoach ? "Planned date" : "New training date"} value={scheduledDate} onChangeText={(value) => setDayDates((dates) => ({ ...dates, [day.id]: value }))} /></View><Pressable className="min-h-11 flex-row items-center justify-center gap-2 rounded-md border border-ink bg-paper px-3 py-2" onPress={() => void saveDayDate(selectedProgram, week.id, day.id, day.scheduledDate)} accessibilityLabel={`Save date for ${day.name}`}><Save size={16} color="#17212B" /><Text className="font-serif text-sm font-bold text-ink">{isCoach ? "Save date" : "Move workout"}</Text></Pressable></View>;
                }) : <View className="items-center px-5 py-8"><CalendarDays size={23} color="#688078" /><Text className="mt-3 font-serif text-sm font-bold text-ink">No workouts in this week</Text></View>}
              </View>;
            })}
          </View> : null}
        </> : null}

        {!isLoading && !athletePrograms.length ? <View className="items-center border border-fog bg-paper px-5 py-12"><CalendarDays size={25} color="#688078" /><Text className="mt-3 font-serif text-base font-bold text-ink">No program scheduled</Text><Text className="mt-1 text-center font-serif text-sm text-[#52675F]">{isCoach ? "Create a program and add workout days before scheduling dates." : "Your coach has not assigned a program yet."}</Text></View> : null}
      </ScrollView>
    </AppShell>
  );
}
