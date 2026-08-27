import { ActivityIndicator, Text, View } from "react-native";
import { Redirect } from "expo-router";

import { useSession } from "../src/auth/AuthSessionContext";
import { AuthScreen } from "../src/components/AuthScreen";

export default function IndexRoute() {
  const { isLoading, session } = useSession();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color="#2E6F5E" />
        <Text className="mt-3 font-serif text-sm text-[#52675F]">Loading workspace</Text>
      </View>
    );
  }

  if (session) {
    return <Redirect href="/dashboard" />;
  }

  return <AuthScreen />;
}
