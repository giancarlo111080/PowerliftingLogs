import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";
import type { CompetitionSex, PowerliftingEquipment, PowerliftingExperience } from "../data/competitionClassification";

import { acceptCoachInvitation, getCoachAthletes, getCurrentAccount, leaveCurrentCoach, PlatformApiError, registerAccount, signIn, updateCurrentAccount, type AccountResponse, type PlatformRole } from "../lib/platformApi";

export type { PlatformRole } from "../lib/platformApi";

export interface PlatformProfile {
  id: string;
  userId: string;
  coachId?: string;
  coachName?: string;
  role: PlatformRole;
  displayName: string;
  initials: string;
  email: string;
  countryCode?: string;
  sex?: "Male" | "Female";
  bodyWeightKg?: number;
  competitionWeightClass?: string;
  dateOfBirth?: string;
  competitionAgeDivision?: string;
  experience?: PowerliftingExperience;
  equipment?: PowerliftingEquipment;
  federationCode?: string;
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
  canCoach: boolean;
  canTrain: boolean;
  activeAthleteId: string;
}

interface AuthSessionContextValue {
  isLoading: boolean;
  session: PlatformSession | null;
  profiles: PlatformProfile[];
  currentProfile: PlatformProfile | null;
  activeAthlete: PlatformProfile | null;
  login: (email: string, password: string, invitationToken?: string) => Promise<void>;
  register: (input: { displayName: string; email: string; password: string; countryCode: string; role: PlatformRole; invitationToken?: string; dateOfBirth?: string; sex?: CompetitionSex; bodyWeightKg?: number; experience?: PowerliftingExperience; equipment?: PowerliftingEquipment; federationCode?: string }) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (role: PlatformRole) => Promise<void>;
  selectAthlete: (athleteProfileId: string) => Promise<void>;
  refreshAthletes: () => Promise<void>;
  updateCurrentProfile: (changes: Partial<PlatformProfile>) => Promise<void>;
  leaveCoach: () => Promise<void>;
  acceptInvitation: (token: string) => Promise<void>;
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
  const profileId = account.athleteProfileId ?? account.id;
  return {
    id: profileId,
    userId: account.id,
    coachId: account.coachId ?? undefined,
    coachName: account.coachName ?? undefined,
    role,
    displayName: account.displayName,
    initials: initials(account.displayName),
    email: account.email,
    countryCode: account.countryCode ?? undefined,
    sex: account.sex === "Female" || account.sex === "Male" ? account.sex : undefined,
    bodyWeightKg: account.bodyWeightKg ?? undefined,
    competitionWeightClass: account.competitionWeightClass ?? "Unspecified",
    dateOfBirth: account.dateOfBirth ?? undefined,
    competitionAgeDivision: account.competitionAgeDivision ?? undefined,
    experience: account.experience ?? undefined,
    equipment: account.equipment ?? undefined,
    federationCode: account.federationCode ?? undefined,
    squatOneRepMaxKg: account.squatOneRepMaxKg ?? undefined,
    benchOneRepMaxKg: account.benchOneRepMaxKg ?? undefined,
    deadliftOneRepMaxKg: account.deadliftOneRepMaxKg ?? undefined,
    upcomingMeet: account.upcomingMeet ?? undefined,
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
        const [storedSession, storedProfiles] = await Promise.all([
          readStoredSession(),
          AsyncStorage.getItem(profileStorageKey)
        ]);
        if (!isMounted || !storedSession) {
          return;
        }
        const persistedSession = JSON.parse(storedSession) as unknown;
        if (!isSession(persistedSession)) {
          return;
        }
        const stored = storedProfiles ? JSON.parse(storedProfiles) as PlatformProfile[] : [];
        const account = await getCurrentAccount(persistedSession.accessToken);
        const currentProfile = profileFromAccount(account);
        const preferredRole = normalizeRole(account.role);
        const canCoach = account.canCoach ?? preferredRole === "COACH";
        const canTrain = account.canTrain ?? preferredRole === "ATHLETE";
        const role = persistedSession.role === "ATHLETE" && canTrain
          ? "ATHLETE"
          : persistedSession.role === "COACH" && canCoach ? "COACH" : preferredRole === "COACH" && canCoach ? "COACH" : "ATHLETE";
        let roster: Awaited<ReturnType<typeof getCoachAthletes>> = [];
        if (canCoach) {
          try {
            roster = await getCoachAthletes(persistedSession.accessToken);
          }
          catch {
          }
        }
        const nextProfiles = mergeProfiles(currentProfile, roster.map((athlete) => athleteProfile(athlete, account.id)), stored);
        if (isMounted) {
          const restoredCoachAthleteId = roster.some((athlete) => athlete.athleteProfileId === persistedSession.activeAthleteId)
            ? persistedSession.activeAthleteId
            : roster[0]?.athleteProfileId ?? "";
          setProfiles(nextProfiles);
          setSession({ ...persistedSession, userId: account.id, role, canCoach, canTrain, activeAthleteId: role === "ATHLETE" ? currentProfile.id : restoredCoachAthleteId });
        }
      }
      catch {
        await removeStoredSession();
        if (isMounted) {
          setSession(null);
          setProfiles([]);
        }
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
  const activeAthlete = session ? profiles.find((profile) => profile.id === session.activeAthleteId &&
    (profile.role === "ATHLETE" || profile.userId === session.userId)) ?? null : null;

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
    const canCoach = account.canCoach ?? role === "COACH";
    const canTrain = account.canTrain ?? role === "ATHLETE";
    const initialProfiles = mergeProfiles(current, [], profiles);
    const initialRole: PlatformRole = role === "COACH" && canCoach ? "COACH" : "ATHLETE";
    const initialSession = { userId: account.id, accessToken, role: initialRole, canCoach, canTrain, activeAthleteId: initialRole === "ATHLETE" ? current.id : "" };
    await persist(initialSession, initialProfiles);
    if (!canCoach) {
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

  async function login(email: string, password: string, invitationToken?: string) {
    const response = await signIn(email.trim(), password, invitationToken);
    await establish(response.account, response.accessToken);
  }

  async function register(input: { displayName: string; email: string; password: string; countryCode: string; role: PlatformRole; invitationToken?: string; dateOfBirth?: string; sex?: CompetitionSex; bodyWeightKg?: number; experience?: PowerliftingExperience; equipment?: PowerliftingEquipment; federationCode?: string }) {
    const response = await registerAccount(input);
    await establish(response.account, response.accessToken);
  }

  async function logout() {
    await persist(null, profiles);
  }

  async function switchWorkspace(role: PlatformRole) {
    if (!session || (role === "COACH" && !session.canCoach) || (role === "ATHLETE" && !session.canTrain) || !currentProfile) return;
    const activeAthleteId = role === "ATHLETE"
      ? currentProfile.id
      : profiles.find((profile) => profile.coachId === session.userId)?.id ?? "";
    await persist({ ...session, role, activeAthleteId });
  }

  async function selectAthlete(athleteProfileId: string) {
    if (!session?.canCoach || session.role !== "COACH" || !profiles.some((profile) => profile.id === athleteProfileId && profile.coachId === session.userId)) {
      return;
    }
    await persist({ ...session, activeAthleteId: athleteProfileId });
  }

  async function refreshAthletes() {
    if (!session || !session.canCoach) {
      return;
    }
    const roster = await getCoachAthletes(session.accessToken);
    const current = profiles.find((profile) => profile.userId === session.userId);
    if (!current) {
      return;
    }
    const nextProfiles = mergeProfiles(current, roster.map((athlete) => athleteProfile(athlete, session.userId)), profiles);
    const activeAthleteId = roster.some((athlete) => athlete.athleteProfileId === session.activeAthleteId)
      ? session.activeAthleteId
      : roster[0]?.athleteProfileId ?? "";
    await persist({ ...session, activeAthleteId }, nextProfiles);
  }

  async function updateCurrentProfile(changes: Partial<PlatformProfile>) {
    if (!currentProfile || !session) {
      return;
    }
    const optimisticProfile = {
      ...currentProfile,
      ...changes,
      initials: initials(changes.displayName ?? currentProfile.displayName),
      notificationsEnabled: changes.notificationsEnabled ?? currentProfile.notificationsEnabled
    };
    const optimisticProfiles = profiles.map((profile) => profile.userId === session.userId ? optimisticProfile : profile);
    await persist(session, optimisticProfiles);
    try {
      const account = await updateCurrentAccount(session.accessToken, optimisticProfile);
      const persistedProfile = { ...optimisticProfile, ...profileFromAccount(account), ...changes, notificationsEnabled: optimisticProfile.notificationsEnabled };
      const nextProfiles = optimisticProfiles.map((profile) => profile.userId === session.userId ? persistedProfile : profile);
      await persist(session, nextProfiles);
    }
    catch (reason) {
      if (reason instanceof PlatformApiError && reason.status === 0) {
        return;
      }
      await persist(session, profiles);
      throw reason;
    }
  }

  async function leaveCoach() {
    if (!session || !currentProfile?.coachId) {
      return;
    }
    const account = await leaveCurrentCoach(session.accessToken);
    const updatedCurrent = { ...currentProfile, ...profileFromAccount(account) };
    const nextProfiles = profiles.map((profile) => profile.userId === session.userId ? updatedCurrent : profile);
    const canTrain = account.canTrain ?? account.role.toUpperCase() === "ATHLETE";
    const role = session.role === "ATHLETE" && !canTrain && session.canCoach ? "COACH" : session.role;
    await persist({ ...session, role, canTrain, activeAthleteId: role === "ATHLETE" ? updatedCurrent.id : "" }, nextProfiles);
  }

  async function acceptInvitation(token: string) {
    if (!session || !currentProfile) {
      throw new Error("Sign in to accept this coaching invitation.");
    }
    const account = await acceptCoachInvitation(session.accessToken, token);
    const updatedCurrent = { ...currentProfile, ...profileFromAccount(account) };
    const nextProfiles = profiles.map((profile) => profile.userId === session.userId ? updatedCurrent : profile);
    await persist({ ...session, role: "ATHLETE", canCoach: account.canCoach, canTrain: true, activeAthleteId: updatedCurrent.id }, nextProfiles);
  }

  return <AuthSessionContext.Provider value={{ isLoading, session, profiles, currentProfile, activeAthlete, login, register, logout, switchWorkspace, selectAthlete, refreshAthletes, updateCurrentProfile, leaveCoach, acceptInvitation }}>{children}</AuthSessionContext.Provider>;
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