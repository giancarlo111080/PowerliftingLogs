import "../global.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthSessionProvider } from "../src/auth/AuthSessionContext";
import { ThemePreferenceProvider, useThemePreference } from "../src/theme/ThemePreferenceContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false }
  }
});

function ApplicationLayout() {
  const { theme } = useThemePreference();
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthSessionProvider>
      <ThemePreferenceProvider>
        <ApplicationLayout />
      </ThemePreferenceProvider>
    </AuthSessionProvider>
  );
}
