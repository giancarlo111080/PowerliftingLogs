import "../global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthSessionProvider } from "../src/auth/AuthSessionContext";
import { NotificationCenterProvider } from "../src/notifications/NotificationCenterContext";
import { ThemePreferenceProvider, useThemePreference } from "../src/theme/ThemePreferenceContext";

function ApplicationLayout() {
  const { theme } = useThemePreference();
  const canvasColor = theme === "dark" ? "#0B1020" : "#F3F5F9";
  return (
    <>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: canvasColor } }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthSessionProvider>
      <ThemePreferenceProvider>
        <NotificationCenterProvider>
          <ApplicationLayout />
        </NotificationCenterProvider>
      </ThemePreferenceProvider>
    </AuthSessionProvider>
  );
}
