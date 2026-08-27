import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthSessionProvider } from "../src/auth/AuthSessionContext";
import { ThemePreferenceProvider, useThemePreference } from "../src/theme/ThemePreferenceContext";

function ApplicationLayout() {
  const { theme } = useThemePreference();
  return (
    <>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
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
