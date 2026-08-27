import { Redirect } from "expo-router";

import { useSession } from "../src/auth/AuthSessionContext";
import { ProgramTemplatesScreen } from "../src/components/ProgramTemplatesScreen";

export default function ProgramsRoute() {
  const { session } = useSession();

  if (session?.role === "ATHLETE") {
    return <Redirect href="/training" />;
  }

  return <ProgramTemplatesScreen />;
}