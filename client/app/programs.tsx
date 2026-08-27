import { Redirect } from "expo-router";

import { useProxySession } from "../src/auth/ProxySessionContext";
import { ProgramWorkspaceScreen } from "../src/components/ProgramWorkspaceScreen";

export default function ProgramsRoute() {
  const { session } = useProxySession();

  if (session?.role === "lifter") {
    return <Redirect href="/training" />;
  }

  return <ProgramWorkspaceScreen />;
}