import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";

import { getCoachAthletes, getCurrentAccount, registerAccount, signIn, type AccountResponse, type PlatformRole } from "../lib/platformApi";

export type { PlatformRole } from "../lib/platformApi";

export interface PlatformProfile {
  id: string;
  userId: string;
  coachId?: string;
  role: PlatformRole;
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

export interface PlatformSession {
  userId: string;
  accessToken: string;
  role: PlatformRole;
  activeAthleteId: string;
}

interface AuthSessionContextValue {
  isLoading: boolean;
  session: PlatformSession | null;
  profiles: PlatformProfile[];
  currentProfile: PlatformProfile | null;
  activeAthlete: PlatformProfile | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { displayName: string; email: string; password: string; role: PlatformRole; invitationToken?: string }) => Promise<void>;
  logout: () => Promise<void>;
  selectAthlete: (athleteProfileId: string) => Promise<void>;
  updateCurrentProfile: (changes: Partial<PlatformProfile>) => Promise<void>;
}

const sessionStorageKey = "iron-forge/session";
const profileStorageKey = "iron-forge/profiles";
const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function getWebSessionStorage() {
  return Platform.OS === "web" && typeof globalThis.sessionStorage !== "undefined" ? globalThis.sessionStorage : null;
}

async function readStoredSession() {
  const webStorage = getWebSessionStorage();
  if (!webStorage) {
    return AsyncStorage.getItem(sessionStorageKey);
  }
  const currentSession = webStorage.getItem(sessionStorageKey);
  if (currentSession) {
    return currentSession;
  }
  const legacySession = await AsyncStorage.getItem(sessionStorageKey);
  if (legacySession) {
    webStorage.setItem(sessionStorageKey, legacySession);
    await AsyncStorage.removeItem(sessionStorageKey);
  }
  return legacySession;
}

async function writeStoredSession(session: PlatformSession) {
  const webStorage = getWebSessionStorage();
  if (webStorage) {
    webStorage.setItem(sessionStorageKey, JSON.stringify(session));
    await AsyncStorage.removeItem(sessionStorageKey);
    return;
  }
  await AsyncStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

async function removeStoredSession() {
  getWebSessionStorage()?.removeItem(sessionStorageKey);
  await AsyncStorage.removeItem(sessionStorageKey);
}

function initials(displayName: string) {
  return displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "IF";
}

function normalizeRole(role: string): PlatformRole {
  const normalizedRole = role.toUpperCase();
  if (normalizedRole === "COACH" || normalizedRole === "ATHLETE") {
    return normalizedRole;
  }
  throw new Error("The server returned an unsupported account role.");
}

function profileFromAccount(account: AccountResponse): PlatformProfile {
  const role = normalizeRole(account.role);
  const profileId = role === "ATHLETE" ? account.athleteProfileId ?? account.id : account.id;
  return {
    id: profileId,
    userId: account.id,
    coachId: account.coachId ?? undefined,
    role,
    displayName: account.displayName,
    initials: initials(account.displayName),
    email: account.email,
    competitionWeightClass: role === "ATHLETE" ? "Unspecified" : undefined,
    notificationsEnabled: true
  };
}

function isSession(value: unknown): value is PlatformSession {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<PlatformSession>;
  return typeof candidate.userId === "string" && typeof candidate.accessToken === "string" &&
    (candidate.role === "COACH" || candidate.role === "ATHLETE") && typeof candidate.activeAthleteId === "string";
}

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<PlatformSession | null>(null);
  const [profiles, setProfiles] = useState<PlatformProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function restore() {
      try {
        const storedSession = await readStoredSession();
        const storedProfiles = await AsyncStorage.getItem(profileStorageKey);
        if (!isMounted || !storedSession) {
          return;
        }
        const persistedSession = JSON.parse(storedSession) as unknown;
        if (!isSession(persistedSession)) {
          return;
        }
        const account = await getCurrentAccount(persistedSession.accessToken);
        const currentProfile = profileFromAccount(account);
        const role = normalizeRole(account.role);
        let roster: Awaited<ReturnType<typeof getCoachAthletes>> = [];
        if (role === "COACH") {
          try {
            roster = await getCoachAthletes(persistedSession.accessToken);
          }
          catch {
          }
        }
        const stored = storedProfiles ? JSON.parse(storedProfiles) as PlatformProfile[] : [];
        const nextProfiles = mergeProfiles(currentProfile, roster.map((athlete) => athleteProfile(athlete, account.id)), stored);
        if (isMounted) {
          const restoredCoachAthleteId = roster.some((athlete) => athlete.athleteProfileId === persistedSession.activeAthleteId)
            ? persistedSession.activeAthleteId
            : roster[0]?.athleteProfileId ?? "";
          setProfiles(nextProfiles);
          setSession({ ...persistedSession, userId: account.id, role, activeAthleteId: role === "ATHLETE" ? currentProfile.id : restoredCoachAthleteId });
        }
      }
      catch {
        await removeStoredSession();
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

  const currentProfile = session ? profiles.find((profile) => profile.userId === session.userId) ?? null : null;
  const activeAthlete = session ? profiles.find((profile) => profile.id === session.activeAthleteId && profile.role === "ATHLETE") ?? null : null;

  async function persist(nextSession: PlatformSession | null, nextProfiles = profiles) {
    if (nextSession) {
      await Promise.all([writeStoredSession(nextSession), AsyncStorage.setItem(profileStorageKey, JSON.stringify(nextProfiles))]);
    }
    else {
      await removeStoredSession();
    }
    setSession(nextSession);
    setProfiles(nextProfiles);
  }

  async function establish(account: AccountResponse, accessToken: string) {
    const current = profileFromAccount(account);
    const role = normalizeRole(account.role);
    const initialProfiles = mergeProfiles(current, [], profiles);
    const initialSession = { userId: account.id, accessToken, role, activeAthleteId: role === "ATHLETE" ? current.id : "" };
    await persist(initialSession, initialProfiles);
    if (role !== "COACH") {
      return;
    }

    try {
      const roster = await getCoachAthletes(accessToken);
      const nextProfiles = mergeProfiles(current, roster.map((athlete) => athleteProfile(athlete, account.id)), profiles);
      await persist({ ...initialSession, activeAthleteId: roster[0]?.athleteProfileId ?? "" }, nextProfiles);
    }
    catch {
    }
  }

  async function login(email: string, password: string) {
    const response = await signIn(email.trim(), password);
    await establish(response.account, response.accessToken);
  }

  async function register(input: { displayName: string; email: string; password: string; role: PlatformRole; invitationToken?: string }) {
    const response = await registerAccount(input);
    await establish(response.account, response.accessToken);
  }

  async function logout() {
    await persist(null, profiles);
  }

  async function selectAthlete(athleteProfileId: string) {
    if (session?.role !== "COACH" || !profiles.some((profile) => profile.id === athleteProfileId && profile.role === "ATHLETE" && profile.coachId === session.userId)) {
      return;
    }
    await persist({ ...session, activeAthleteId: athleteProfileId });
  }

  async function updateCurrentProfile(changes: Partial<PlatformProfile>) {
    if (!currentProfile || !session) {
      return;
    }
    const nextProfiles = profiles.map((profile) => profile.userId === session.userId ? { ...profile, ...changes, id: profile.id, userId: profile.userId, role: profile.role } : profile);
    await persist(session, nextProfiles);
  }

  return <AuthSessionContext.Provider value={{ isLoading, session, profiles, currentProfile, activeAthlete, login, register, logout, selectAthlete, updateCurrentProfile }}>{children}</AuthSessionContext.Provider>;
}

function athleteProfile(athlete: { athleteProfileId: string; userId: string; displayName: string; email: string }, coachId: string): PlatformProfile {
  return { id: athlete.athleteProfileId, userId: athlete.userId, coachId, role: "ATHLETE", displayName: athlete.displayName, initials: initials(athlete.displayName), email: athlete.email, competitionWeightClass: "Unspecified", notificationsEnabled: true };
}

function mergeProfiles(current: PlatformProfile, roster: PlatformProfile[], existing: PlatformProfile[]) {
  const retained = existing.filter((profile) => profile.userId === current.userId || roster.some((athlete) => athlete.userId === profile.userId));
  const incoming = [current, ...roster];
  return incoming.map((profile) => {
    const savedProfile = retained.find((candidate) => candidate.userId === profile.userId);
    const mergedProfile = { ...profile, ...savedProfile };
    return {
      ...mergedProfile,
      id: profile.id,
      userId: profile.userId,
      coachId: profile.coachId,
      role: profile.role,
      email: profile.email,
      initials: initials(mergedProfile.displayName)
    };
  });
}

export function useSession() {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useSession must be used within AuthSessionProvider.");
  }
  return context;
}