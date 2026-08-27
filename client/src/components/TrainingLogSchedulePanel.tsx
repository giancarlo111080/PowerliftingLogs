import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { CalendarDays, RotateCcw, Save } from "lucide-react-native";

import { type DayScheduleAuthor, type ProgramDay, useProgramWorkspaceStore } from "../data/programWorkspaceStore";

interface TrainingLogSchedulePanelProps {
  programId: string;
  weekId: string;
  weekName: string;
  day: ProgramDay;
  actorRole: DayScheduleAuthor;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
}

export function TrainingLogSchedulePanel({ programId, weekId, weekName, day, actorRole }: TrainingLogSchedulePanelProps) {
  const { rescheduleDay, rescheduleWeek } = useProgramWorkspaceStore();
  const [scheduledDate, setScheduledDate] = useState(day.scheduledDate);
  const [weekStartDate, setWeekStartDate] = useState(day.scheduledDate);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setScheduledDate(day.scheduledDate);
    setWeekStartDate(day.scheduledDate);
  }, [day.id, day.scheduledDate]);

  async function saveDayDate() {
    if (!isIsoDate(scheduledDate)) {
      setMessage("Enter a real date as YYYY-MM-DD.");
      return;
    }
    await rescheduleDay(programId, weekId, day.id, scheduledDate, actorRole);
    setMessage("Training date updated.");
  }

  async function moveWeek() {
    if (!isIsoDate(weekStartDate)) {
      setMessage("Enter a real week start as YYYY-MM-DD.");
      return;
    }
    await rescheduleWeek(programId, weekId, weekStartDate, actorRole);
    setMessage(`${weekName} moved from ${weekStartDate}.`);
  }

  return (
    <View className="border border-fog bg-paper p-4">
      <View className="flex-row items-center gap-2"><CalendarDays size={18} color="#2E6F5E" /><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Schedule</Text><Text className="mt-1 font-serif text-lg font-bold text-ink">{day.name}</Text></View></View>
      <View className="mt-4 flex-col gap-3 lg:flex-row lg:items-end">
        <View className="flex-1 gap-1.5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Training date</Text><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={scheduledDate} onChangeText={setScheduledDate} placeholder="YYYY-MM-DD" placeholderTextColor="#688078" accessibilityLabel="Training date" /></View>
        <Pressable className="min-h-11 flex-row items-center justify-center gap-2 rounded-md border border-ink bg-paper px-3 py-2" onPress={() => void saveDayDate()} accessibilityLabel="Save training date"><Save size={16} color="#17212B" /><Text className="font-serif text-sm font-bold text-ink">Save date</Text></Pressable>
        <View className="flex-1 gap-1.5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Move {weekName} from</Text><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={weekStartDate} onChangeText={setWeekStartDate} placeholder="YYYY-MM-DD" placeholderTextColor="#688078" accessibilityLabel={`New start date for ${weekName}`} /></View>
        <Pressable className="min-h-11 flex-row items-center justify-center gap-2 rounded-md bg-ink px-3 py-2" onPress={() => void moveWeek()} accessibilityLabel={`Move every workout in ${weekName}`}><RotateCcw size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Move week</Text></Pressable>
      </View>
      <Text className="mt-3 font-serif text-xs text-[#52675F]">{day.scheduleUpdatedBy === "lifter" ? "Last moved by athlete." : "Last scheduled by coach."}</Text>
      {message ? <Text className="mt-2 font-serif text-sm text-moss">{message}</Text> : null}
    </View>
  );
}