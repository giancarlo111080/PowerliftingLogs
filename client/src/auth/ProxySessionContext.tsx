import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

export type ProxyRole = "lifter" | "coach";

export interface ProxyProfile {
  id: string;
  role: ProxyRole;
  displayName: string;
  initials: string;
  email: string;
  sex?: "Male" | "Female" | "Other";
  bodyWeightKg?: number;
  competitionWeightClass?: string;
  squatOneRepMaxKg?: number;
  benchOneRepMaxKg?: number;
  deadliftOneRepMaxKg?: number;
  activeBlock?: string;
  upcomingMeet?: string;
  assignedAthleteCount?: number;
  reviewWorkload?: number;
  notificationsEnabled: boolean;
}

export interface ProxySession {
  proxyUserId: string;
  role: ProxyRole;
  activeAthleteId: string;
}

interface ProxySessionContextValue {
  isLoading: boolean;
  session: ProxySession | null;
  profiles: ProxyProfile[];
  currentProfile: ProxyProfile | null;
  activeAthlete: ProxyProfile | null;
  login: (role: ProxyRole) => Promise<void>;
  logout: () => Promise<void>;
  selectAthlete: (athleteId: string) => Promise<void>;
  updateCurrentProfile: (changes: Partial<ProxyProfile>) => Promise<void>;
}

const sessionStorageKey = "powerlifting-program/proxy-session";
const profileStorageKey = "powerlifting-program/proxy-profiles";

const alexMorganId = "a9b07d17-ef82-4b73-a79c-ae00ca5ea6d9";
const coachTaylorId = "c2f9e76a-bc73-43e1-bd0c-0d761cc2bc20";

const initialProfiles: ProxyProfile[] = [
  {
    id: alexMorganId,
    role: "lifter",
    displayName: "Alex Morgan",
    initials: "AM",
    email: "alex.morgan@example.test",
    sex: "Male",
    bodyWeightKg: 82.5,
    competitionWeightClass: "83 kg",
    squatOneRepMaxKg: 215,
    benchOneRepMaxKg: 147.5,
    deadliftOneRepMaxKg: 250,
    activeBlock: "Peak / Week 4",
    upcomingMeet: "Autumn Open - 18 days",
    notificationsEnabled: true
  },
  {
    id: "4ef9844a-37de-42f6-bd31-ad587265ee90",
    role: "lifter",
    displayName: "Jordan Lee",
    initials: "JL",
    email: "jordan.lee@example.test",
    sex: "Female",
    bodyWeightKg: 62.8,
    competitionWeightClass: "63 kg",
    squatOneRepMaxKg: 160,
    benchOneRepMaxKg: 90,
    deadliftOneRepMaxKg: 185,
    activeBlock: "Strength / Week 2",
    upcomingMeet: "Regional Qualifier - 42 days",
    notificationsEnabled: true
  },
  {
    id: "270e0142-a437-44bc-9dcd-dd43676fd4b0",
    role: "lifter",
    displayName: "Mina Patel",
    initials: "MP",
    email: "mina.patel@example.test",
    sex: "Female",
    bodyWeightKg: 72.4,
    competitionWeightClass: "76 kg",
    squatOneRepMaxKg: 177.5,
    benchOneRepMaxKg: 102.5,
    deadliftOneRepMaxKg: 205,
    activeBlock: "Hypertrophy / Week 5",
    upcomingMeet: "No meet scheduled",
    notificationsEnabled: false
  },
  {
    id: "f0be3194-989f-4a36-9c8f-9c27eaf7e3da",
    role: "lifter",
    displayName: "Sam Rivera",
    initials: "SR",
    email: "sam.rivera@example.test",
    sex: "Male",
    bodyWeightKg: 91.7,
    competitionWeightClass: "93 kg",
    squatOneRepMaxKg: 225,
    benchOneRepMaxKg: 150,
    deadliftOneRepMaxKg: 260,
    activeBlock: "Peak / Week 3",
    upcomingMeet: "City Open - 25 days",
    notificationsEnabled: true
  },
  {
    id: coachTaylorId,
    role: "coach",
    displayName: "Coach Taylor",
    initials: "CT",
    email: "taylor@example.test",
    assignedAthleteCount: 12,
    reviewWorkload: 4,
    notificationsEnabled: true
  }
];

const ProxySessionContext = createContext<ProxySessionContextValue | null>(null);

function isProxySession(value: unknown): value is ProxySession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ProxySession>;
  return typeof candidate.proxyUserId === "string" &&
    (candidate.role === "lifter" || candidate.role === "coach") &&
    typeof candidate.activeAthleteId === "string";
}

export function ProxySessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<ProxySession | null>(null);
  const [profiles, setProfiles] = useState<ProxyProfile[]>(initialProfiles);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restore() {
      try {
        const [storedSession, storedProfiles] = await Promise.all([
          AsyncStorage.getItem(sessionStorageKey),
          AsyncStorage.getItem(profileStorageKey)
        ]);
        if (!isMounted) {
          return;
        }

        if (storedProfiles) {
          const parsedProfiles = JSON.parse(storedProfiles) as ProxyProfile[];
          if (Array.isArray(parsedProfiles) && parsedProfiles.length) {
            setProfiles(parsedProfiles);
          }
        }

        if (storedSession) {
          const parsedSession = JSON.parse(storedSession) as unknown;
          if (isProxySession(parsedSession)) {
            setSession(parsedSession);
          }
        }
      }
      catch {
      }
      finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void restore();
    return () => {
      isMounted = false;
    };
  }, []);

  const currentProfile = session ? profiles.find((profile) => profile.id === session.proxyUserId) ?? null : null;
  const activeAthlete = session ? profiles.find((profile) => profile.id === session.activeAthleteId) ?? null : null;

  async function persistSession(nextSession: ProxySession | null) {
    setSession(nextSession);
    try {
      if (nextSession) {
        await AsyncStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
      }
      else {
        await AsyncStorage.removeItem(sessionStorageKey);
      }
    }
    catch {
    }
  }

  async function login(role: ProxyRole) {
    const nextSession: ProxySession = role === "lifter"
      ? { proxyUserId: alexMorganId, role, activeAthleteId: alexMorganId }
      : { proxyUserId: coachTaylorId, role, activeAthleteId: alexMorganId };
    await persistSession(nextSession);
  }

  async function logout() {
    await persistSession(null);
  }

  async function selectAthlete(athleteId: string) {
    if (!session || session.role !== "coach" || !profiles.some((profile) => profile.id === athleteId && profile.role === "lifter")) {
      return;
    }

    await persistSession({ ...session, activeAthleteId: athleteId });
  }

  async function updateCurrentProfile(changes: Partial<ProxyProfile>) {
    if (!currentProfile) {
      return;
    }

    const nextProfiles = profiles.map((profile) => profile.id === currentProfile.id ? { ...profile, ...changes, id: profile.id, role: profile.role } : profile);
    setProfiles(nextProfiles);
    try {
      await AsyncStorage.setItem(profileStorageKey, JSON.stringify(nextProfiles));
    }
    catch {
    }
  }

  return (
    <ProxySessionContext.Provider value={{
      isLoading,
      session,
      profiles,
      currentProfile,
      activeAthlete,
      login,
      logout,
      selectAthlete,
      updateCurrentProfile
    }}>
      {children}
    </ProxySessionContext.Provider>
  );
}

export function useProxySession() {
  const context = useContext(ProxySessionContext);
  if (!context) {
    throw new Error("useProxySession must be used within ProxySessionProvider.");
  }

  return context;
}