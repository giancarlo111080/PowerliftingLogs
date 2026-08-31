import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Bell, CalendarDays, CheckCheck, ChevronRight, Cloud, Dumbbell, HeartPulse, MessageSquare, RefreshCw, Trophy, X } from "lucide-react-native";

import { AppShell } from "./AppShell";
import { useNotificationCenter, type AppNotification, type NotificationCategory } from "../notifications/NotificationCenterContext";

const filters: Array<{ value: "all" | "unread" | NotificationCategory; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "training", label: "Training" },
  { value: "coaching", label: "Coaching" },
  { value: "meet", label: "Meet" },
  { value: "sync", label: "Sync" }
];

function iconFor(notification: AppNotification) {
  if (notification.category === "training") return Dumbbell;
  if (notification.category === "meet") return Trophy;
  if (notification.category === "sync") return Cloud;
  if (notification.category === "recovery") return HeartPulse;
  if (notification.category === "coaching") return MessageSquare;
  return CalendarDays;
}

export function NotificationCenterScreen() {
  const { notifications, unreadCount, isEnabled, markAllRead, dismiss, openNotification, retrySync } = useNotificationCenter();
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const visible = notifications.filter((notification) => filter === "all" || filter === "unread" ? filter === "all" || notification.unread : notification.category === filter);

  return (
    <AppShell title="Notifications">
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-4xl gap-6 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
        <View className="flex-col gap-4 border-l-4 border-signal pl-4 sm:flex-row sm:items-end sm:justify-between">
          <View><Text className="font-mono text-xs uppercase text-moss">Action center</Text><Text className="mt-1 font-heading text-3xl uppercase text-ink">What needs attention</Text><Text className="mt-2 font-sans text-sm text-muted">Training, coaching, meet, and synchronization alerts from your current workspace.</Text></View>
          {unreadCount ? <Pressable className="min-h-10 flex-row items-center justify-center gap-2 border border-fog bg-paper px-3 py-2" onPress={() => void markAllRead()} accessibilityLabel="Mark all notifications read"><CheckCheck size={17} color="#2E6F5E" /><Text className="font-sans text-sm font-bold text-ink">Mark all read</Text></Pressable> : null}
        </View>

        {!isEnabled ? <View className="border border-fog bg-paper p-4"><Text className="font-sans text-sm font-bold text-ink">Notifications are turned off</Text><Text className="mt-1 font-sans text-xs text-muted">Enable Review notifications from Profile to populate this center.</Text></View> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {filters.map((item) => <Pressable key={item.value} className={`min-h-9 items-center justify-center border px-3 ${filter === item.value ? "border-ink bg-ink" : "border-fog bg-paper"}`} onPress={() => setFilter(item.value)}><Text className={`font-mono text-[10px] uppercase ${filter === item.value ? "text-white" : "text-muted"}`}>{item.label}</Text></Pressable>)}
        </ScrollView>

        {notifications.some((notification) => notification.category === "sync") ? <Pressable className="min-h-11 flex-row items-center justify-center gap-2 border border-moss bg-paper px-4 py-3" onPress={() => void retrySync()} accessibilityLabel="Retry synchronization"><RefreshCw size={17} color="#2E6F5E" /><Text className="font-sans text-sm font-bold text-moss">Retry synchronization</Text></Pressable> : null}

        <View className="border border-fog bg-paper">
          {visible.length ? visible.map((notification, index) => {
            const Icon = iconFor(notification);
            const iconColor = notification.priority === "urgent" ? "#FF3B45" : notification.priority === "attention" ? "#D74F32" : "#2E6F5E";
            return <View key={notification.id} className={`flex-row gap-3 px-4 py-4 ${index ? "border-t border-fog" : ""} ${notification.unread ? "bg-canvas" : ""}`}><View className="h-10 w-10 items-center justify-center border border-fog bg-paper"><Icon size={18} color={iconColor} /></View><Pressable className="flex-1" onPress={() => void openNotification(notification)} accessibilityLabel={`${notification.title}. ${notification.actionLabel}`}><View className="flex-row items-start justify-between gap-2"><View className="flex-1"><View className="flex-row items-center gap-2">{notification.unread ? <View className="h-2 w-2 rounded-full bg-signal" /> : null}<Text className="flex-1 font-sans text-sm font-bold text-ink">{notification.title}</Text></View><Text className="mt-1 font-sans text-xs leading-5 text-muted">{notification.body}</Text><Text className="mt-2 font-mono text-[10px] uppercase text-moss">{notification.actionLabel}</Text></View><ChevronRight size={17} color="#688078" /></View></Pressable><Pressable className="h-8 w-8 items-center justify-center" onPress={() => void dismiss(notification.id)} accessibilityLabel={`Dismiss ${notification.title}`}><X size={15} color="#688078" /></Pressable></View>;
          }) : <View className="items-center px-5 py-12"><Bell size={25} color="#688078" /><Text className="mt-3 font-sans text-base font-bold text-ink">No notifications here</Text><Text className="mt-1 text-center font-sans text-sm text-muted">Your current filter has no active alerts.</Text></View>}
        </View>
      </ScrollView>
    </AppShell>
  );
}