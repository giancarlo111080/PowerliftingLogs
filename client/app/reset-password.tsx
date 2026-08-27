import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";

import { AuthScreen } from "../src/components/AuthScreen";

export default function ResetPasswordRoute() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const [resetToken] = useState(() => Array.isArray(token) ? token[0] : token);

  useEffect(() => {
    if (resetToken && typeof globalThis.history?.replaceState === "function" && typeof globalThis.location !== "undefined") {
      globalThis.history.replaceState(globalThis.history.state, "", globalThis.location.pathname);
    }
  }, [resetToken]);

  return <AuthScreen initialMode="reset-password" resetToken={resetToken} />;
}