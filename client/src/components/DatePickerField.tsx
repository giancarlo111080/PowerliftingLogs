import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react-native";

import { useThemePreference } from "../theme/ThemePreferenceContext";

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel?: string;
}

function dateFromIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function isoDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month, 1)));
}

export function DatePickerField({ label, value, onChangeText, accessibilityLabel }: DatePickerFieldProps) {
  const { theme } = useThemePreference();
  const [isOpen, setIsOpen] = useState(false);
  const surfaceIconColor = theme === "dark" ? "#F5F7FB" : "#111827";
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = dateFromIso(value) ?? new Date();
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
  });
  const selectedDate = dateFromIso(value);
  const selectedIsoDate = selectedDate ? value : null;
  const today = new Date();
  const todayIsoDate = isoDate(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const firstDayOfMonth = new Date(Date.UTC(visibleMonth.year, visibleMonth.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(visibleMonth.year, visibleMonth.month + 1, 0)).getUTCDate();
  const calendarSlots = Array.from({ length: firstDayOfMonth + daysInMonth });

  function openCalendar() {
    const date = selectedDate ?? new Date();
    setVisibleMonth({ year: date.getUTCFullYear(), month: date.getUTCMonth() });
    setIsOpen(true);
  }

  function shiftMonth(offset: number) {
    const date = new Date(Date.UTC(visibleMonth.year, visibleMonth.month + offset, 1));
    setVisibleMonth({ year: date.getUTCFullYear(), month: date.getUTCMonth() });
  }

  function selectDate(day: number) {
    onChangeText(isoDate(visibleMonth.year, visibleMonth.month, day));
    setIsOpen(false);
  }

  return (
    <View className="flex-1 gap-1.5">
      <Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#8996AC]">{label}</Text>
      <View className="flex-row gap-2">
        <TextInput
          className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-serif text-base text-ink"
          value={value}
          onChangeText={onChangeText}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#8996AC"
          autoCapitalize="none"
          accessibilityLabel={accessibilityLabel ?? label}
        />
        <Pressable className="h-11 w-11 items-center justify-center border border-fog bg-paper" onPress={openCalendar} accessibilityLabel={`Open calendar for ${label}`}>
          <CalendarDays size={18} color={surfaceIconColor} />
        </Pressable>
      </View>

      <Modal transparent animationType="fade" visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <View className="flex-1 items-center justify-center bg-black/60 px-5">
          <View className="w-full max-w-sm border border-fog bg-paper p-5">
            <View className="flex-row items-center justify-between">
              <Text className="font-heading text-xl uppercase text-ink">Choose date</Text>
              <Pressable className="h-9 w-9 items-center justify-center border border-fog bg-canvas" onPress={() => setIsOpen(false)} accessibilityLabel="Close calendar">
                <X size={17} color={surfaceIconColor} />
              </Pressable>
            </View>
            <View className="mt-5 flex-row items-center justify-between">
              <Pressable className="h-10 w-10 items-center justify-center border border-fog bg-canvas" onPress={() => shiftMonth(-1)} accessibilityLabel="Previous month">
                <ChevronLeft size={19} color={surfaceIconColor} />
              </Pressable>
              <Text className="font-serif text-base font-bold text-ink">{monthLabel(visibleMonth.year, visibleMonth.month)}</Text>
              <Pressable className="h-10 w-10 items-center justify-center border border-fog bg-canvas" onPress={() => shiftMonth(1)} accessibilityLabel="Next month">
                <ChevronRight size={19} color={surfaceIconColor} />
              </Pressable>
            </View>
            <View className="mt-4 flex-row flex-wrap">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <View key={day} className="h-8 w-[14.2857%] items-center justify-center"><Text className="font-mono text-[10px] text-muted">{day}</Text></View>)}
              {calendarSlots.map((_, slotIndex) => {
                if (slotIndex < firstDayOfMonth) {
                  return <View key={`empty-${slotIndex}`} className="h-10 w-[14.2857%]" />;
                }
                const day = slotIndex - firstDayOfMonth + 1;
                const dayIsoDate = isoDate(visibleMonth.year, visibleMonth.month, day);
                const isSelected = dayIsoDate === selectedIsoDate;
                const isToday = dayIsoDate === todayIsoDate;
                return <Pressable key={dayIsoDate} className={`h-10 w-[14.2857%] items-center justify-center ${isSelected ? "bg-signal" : isToday ? "border border-signal" : ""}`} onPress={() => selectDate(day)} accessibilityLabel={`Choose ${dayIsoDate}`} accessibilityState={{ selected: isSelected }}><Text className={`font-serif text-sm font-bold ${isSelected ? "text-white" : "text-ink"}`}>{day}</Text></Pressable>;
              })}
            </View>
            <Pressable className="mt-5 min-h-11 flex-row items-center justify-center gap-2 border border-fog bg-canvas px-4 py-3" onPress={() => { onChangeText(todayIsoDate); setIsOpen(false); }} accessibilityLabel="Choose today">
              <CalendarDays size={16} color={surfaceIconColor} />
              <Text className="font-serif text-sm font-bold text-ink">Today</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}