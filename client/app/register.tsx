import { useLocalSearchParams } from "expo-router";

import { AuthScreen } from "../src/components/AuthScreen";

export default function RegisterRoute() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const invitationToken = Array.isArray(token) ? token[0] : token;
  return <AuthScreen initialMode="register" invitationToken={invitationToken} />;
}