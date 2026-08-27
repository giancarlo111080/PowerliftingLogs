import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowRight, Dumbbell, ShieldCheck, Users } from "lucide-react-native";
import { router } from "expo-router";

import { type ProxyRole, useProxySession } from "../auth/ProxySessionContext";

const personas: Array<{
  role: ProxyRole;
  name: string;
  detail: string;
  Icon: typeof Dumbbell;
  accent: string;
}> = [
  { role: "lifter", name: "Alex Morgan", detail: "Lifter workspace", Icon: Dumbbell, accent: "#2E6F5E" },
  { role: "coach", name: "Coach Taylor", detail: "Coach workspace", Icon: Users, accent: "#D74F32" }
];

export function ProxyLoginScreen() {
  const { login } = useProxySession();
  const [pendingRole, setPendingRole] = useState<ProxyRole | null>(null);

  async function signIn(role: ProxyRole) {
    setPendingRole(role);
    await login(role);
    router.replace("/dashboard");
  }

  return (
    <View className="flex-1 bg-canvas px-5 py-8 sm:items-center sm:justify-center">
      <View className="w-full sm:max-w-xl">
        <View className="mb-9 border-l-4 border-signal pl-4">
          <Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Powerlifting Program</Text>
          <Text className="mt-2 font-serif text-4xl font-bold text-ink">Choose a workspace</Text>
          <Text className="mt-3 font-serif text-base leading-6 text-[#52675F]">Use a development identity to inspect the lifter and coach workflows.</Text>
        </View>

        <View className="gap-3">
          {personas.map(({ role, name, detail, Icon, accent }) => (
            <Pressable
              key={role}
              className="min-h-28 flex-row items-center border border-fog bg-paper p-5 active:bg-canvas disabled:opacity-60"
              onPress={() => signIn(role)}
              disabled={pendingRole !== null}
              accessibilityLabel={`Sign in as ${name}`}
            >
              <View className="h-12 w-12 items-center justify-center rounded-md" style={{ backgroundColor: `${accent}1A` }}>
                <Icon size={23} color={accent} />
              </View>
              <View className="ml-4 flex-1">
                <Text className="font-serif text-xl font-bold text-ink">{name}</Text>
                <Text className="mt-1 font-serif text-sm text-[#52675F]">{pendingRole === role ? "Opening workspace..." : detail}</Text>
              </View>
              <ArrowRight size={20} color="#17212B" />
            </Pressable>
          ))}
        </View>

        <View className="mt-7 flex-row items-center gap-2">
          <ShieldCheck size={16} color="#688078" />
          <Text className="font-serif text-xs leading-5 text-[#52675F]">Development proxy access only. No production credentials are used.</Text>
        </View>
      </View>
    </View>
  );
}