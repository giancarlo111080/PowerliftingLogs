import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";

import { AuthScreen } from "../src/components/AuthScreen";

export default function RegisterRoute() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const [invitationToken] = useState(() => Array.isArray(token) ? token[0] : token);

  useEffect(() => {
    if (invitationToken && typeof globalThis.history?.replaceState === "function" && typeof globalThis.location !== "undefined") {
      globalThis.history.replaceState(globalThis.history.state, "", globalThis.location.pathname);
    }
  }, [invitationToken]);

  return <AuthScreen initialMode="register" invitationToken={invitationToken} />;
}