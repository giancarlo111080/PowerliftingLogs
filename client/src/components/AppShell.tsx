import { type ReactNode, useState } from "react";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { BarChart3, CalendarDays, ChevronDown, ClipboardCheck, ClipboardList, Dumbbell, LayoutDashboard, LogOut, Menu, ShieldCheck, UserRound, Users, X, type LucideIcon } from "lucide-react-native";
import { Redirect, router, type Href, usePathname } from "expo-router";

import { type ProxyRole, useProxySession } from "../auth/ProxySessionContext";

interface NavigationItem {
  label: string;
  href: Href;
  Icon: LucideIcon;
  roles: ProxyRole[];
}

const navigationItems: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard, roles: ["lifter", "coach"] },
  { label: "Training Log", href: "/training", Icon: Dumbbell, roles: ["lifter", "coach"] },
  { label: "Program Schedule", href: "/schedule", Icon: CalendarDays, roles: ["lifter", "coach"] },
  { label: "Analytics", href: "/analytics", Icon: BarChart3, roles: ["lifter", "coach"] },
  { label: "Athletes", href: "/athletes", Icon: Users, roles: ["coach"] },
  { label: "Programs", href: "/programs", Icon: ClipboardList, roles: ["coach"] },
  { label: "Program Review", href: "/program-review", Icon: ClipboardCheck, roles: ["coach"] },
  { label: "Profile", href: "/profile", Icon: UserRound, roles: ["lifter", "coach"] }
];

interface AppShellProps {
  title: string;
  children: ReactNode;
}

interface SidebarProps {
  isDrawer?: boolean;
  onNavigate?: () => void;
}

function Sidebar({ isDrawer = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { session, currentProfile, activeAthlete, profiles, logout, selectAthlete } = useProxySession();
  const [isAthletePickerOpen, setIsAthletePickerOpen] = useState(false);

  if (!session || !currentProfile) {
    return null;
  }

  const coachAthletes = profiles.filter((profile) => profile.role === "lifter");

  async function navigate(href: Href) {
    onNavigate?.();
    router.push(href);
  }

  async function chooseAthlete(athleteId: string) {
    await selectAthlete(athleteId);
    setIsAthletePickerOpen(false);
  }

  async function signOut() {
    onNavigate?.();
    await logout();
    router.replace("/");
  }

  return (
    <View className={`${isDrawer ? "h-full w-80" : "h-full w-72"} border-r border-fog bg-paper px-4 py-5`}>
      <View className="mb-7 flex-row items-center gap-3 px-2">
        <View className="h-10 w-10 items-center justify-center rounded-md bg-ink"><Dumbbell size={20} color="#E9C46A" /></View>
        <View>
          <Text className="font-serif text-base font-bold text-ink">Powerlifting</Text>
          <Text className="font-serif text-xs text-[#52675F]">Program workspace</Text>
        </View>
      </View>

      <View className="mb-5 flex-row items-center gap-2 border-y border-fog px-2 py-3">
        <ShieldCheck size={15} color="#2E6F5E" />
        <Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Testing identity</Text>
      </View>

      {session.role === "coach" ? (
        <View className="mb-5">
          <Text className="mb-2 px-2 font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">Reviewing</Text>
          <Pressable
            className="flex-row items-center border border-fog bg-canvas px-3 py-3 active:bg-fog"
            onPress={() => setIsAthletePickerOpen((open) => !open)}
            accessibilityLabel="Choose athlete to review"
          >
            <View className="h-8 w-8 items-center justify-center rounded-md bg-moss"><Text className="font-serif text-xs font-bold text-white">{activeAthlete?.initials ?? "AM"}</Text></View>
            <View className="ml-2 flex-1"><Text className="font-serif text-sm font-bold text-ink">{activeAthlete?.displayName ?? "Athlete"}</Text><Text className="font-serif text-xs text-[#52675F]">Active athlete</Text></View>
            <ChevronDown size={16} color="#52675F" />
          </Pressable>
          {isAthletePickerOpen ? (
            <View className="border-x border-b border-fog bg-paper py-1">
              {coachAthletes.map((athlete) => (
                <Pressable key={athlete.id} className="px-3 py-2.5 active:bg-canvas" onPress={() => chooseAthlete(athlete.id)}>
                  <Text className="font-serif text-sm font-bold text-ink">{athlete.displayName}</Text>
                  <Text className="font-serif text-xs text-[#52675F]">{athlete.activeBlock ?? "Current training block"}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View className="flex-1 gap-1">
        {navigationItems.filter((item) => item.roles.includes(session.role)).map(({ label, href, Icon }) => {
          const isActive = pathname === href;
          return (
            <Pressable
              key={label}
              className={`min-h-11 flex-row items-center gap-3 px-3 py-2.5 ${isActive ? "bg-ink" : "active:bg-canvas"}`}
              onPress={() => navigate(href)}
              accessibilityLabel={`Open ${label}`}
            >
              <Icon size={18} color={isActive ? "#FFFFFF" : "#52675F"} />
              <Text className={`font-serif text-sm font-bold ${isActive ? "text-white" : "text-ink"}`}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View className="border-t border-fog pt-4">
        <View className="mb-3 flex-row items-center px-2">
          <View className="h-9 w-9 items-center justify-center rounded-md bg-signal"><Text className="font-serif text-xs font-bold text-white">{currentProfile.initials}</Text></View>
          <View className="ml-2 flex-1"><Text className="font-serif text-sm font-bold text-ink">{currentProfile.displayName}</Text><Text className="font-serif text-xs capitalize text-[#52675F]">{session.role}</Text></View>
        </View>
        <Pressable className="min-h-10 flex-row items-center gap-3 px-3 py-2 active:bg-canvas" onPress={signOut} accessibilityLabel="Log out of proxy session">
          <LogOut size={17} color="#D74F32" />
          <Text className="font-serif text-sm font-bold text-signal">Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function AppShell({ title, children }: AppShellProps) {
  const { width } = useWindowDimensions();
  const { session, currentProfile } = useProxySession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isDesktop = width >= 960;

  if (!session || !currentProfile) {
    return <Redirect href="/" />;
  }

  return (
    <View className="flex-1 flex-row bg-canvas">
      {isDesktop ? <Sidebar /> : null}
      <View className="flex-1">
        <View className="min-h-16 flex-row items-center justify-between border-b border-fog bg-paper px-4">
          <View className="flex-row items-center gap-3">
            {!isDesktop ? (
              <Pressable className="h-10 w-10 items-center justify-center rounded-md border border-fog" onPress={() => setIsMenuOpen(true)} accessibilityLabel="Open navigation menu">
                <Menu size={20} color="#17212B" />
              </Pressable>
            ) : null}
            <View><Text className="font-serif text-xl font-bold text-ink">{title}</Text><Text className="font-serif text-xs text-[#52675F]">{session.role === "coach" ? "Coach workspace" : "Lifter workspace"}</Text></View>
          </View>
          <View className="flex-row items-center gap-2"><View className="h-8 w-8 items-center justify-center rounded-md bg-moss"><Text className="font-serif text-xs font-bold text-white">{currentProfile.initials}</Text></View><Text className="hidden font-serif text-sm font-bold text-ink sm:flex">{currentProfile.displayName}</Text></View>
        </View>
        <View className="flex-1">{children}</View>
      </View>

      <Modal visible={isMenuOpen} transparent animationType="fade" onRequestClose={() => setIsMenuOpen(false)}>
        <View className="flex-1 flex-row bg-black/40">
          <Sidebar isDrawer onNavigate={() => setIsMenuOpen(false)} />
          <Pressable className="flex-1" onPress={() => setIsMenuOpen(false)} accessibilityLabel="Close navigation menu">
            <View className="items-end p-4"><View className="h-10 w-10 items-center justify-center rounded-md bg-paper"><X size={20} color="#17212B" /></View></View>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}