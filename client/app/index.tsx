import { ActivityIndicator, Text, View } from "react-native";
import { Redirect } from "expo-router";

import { useProxySession } from "../src/auth/ProxySessionContext";
import { ProxyLoginScreen } from "../src/components/ProxyLoginScreen";

export default function IndexRoute() {
  const { isLoading, session } = useProxySession();

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

  return <ProxyLoginScreen />;
}
