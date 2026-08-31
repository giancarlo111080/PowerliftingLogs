import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { router, type Href } from "expo-router";

import { useSession } from "../auth/AuthSessionContext";
import { calculateRecoveryReadiness } from "../data/adaptiveEngine";
import { usePerformanceStore } from "../data/performanceStore";
import { useProgramWorkspaceStore, type ProgramDay, type ProgramWeek, type TrainingProgram } from "../data/programWorkspaceStore";
import { getProgramOffers, type ProgramOfferResponse } from "../lib/platformApi";

export type NotificationPriority = "urgent" | "attention" | "info";
export type NotificationCategory = "training" | "meet" | "coaching" | "recovery" | "sync" | "program";

export interface AppNotification {
  id: string;
  priority: NotificationPriority;
  category: NotificationCategory;
  title: string;
  body: string;
  createdAt: string;
  href: Href;
  actionLabel: string;
  athleteId?: string;
  unread: boolean;
}

interface NotificationState {
  readIds: string[];
  dismissedIds: string[];
}

interface NotificationCenterValue {
  notifications: AppNotification[];
  unreadCount: number;
  isEnabled: boolean;
  markAllRead: () => Promise<void>;
  dismiss: (notificationId: string) => Promise<void>;
  openNotification: (notification: AppNotification) => Promise<void>;
  retrySync: () => Promise<void>;
}

const emptyState: NotificationState = { readIds: [], dismissedIds: [] };
const NotificationCenterContext = createContext<NotificationCenterValue | null>(null);

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysFromToday(value: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const target = new Date(`${value}T00:00:00.000Z`).getTime();
  const start = new Date(`${today}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(target) || !Number.isFinite(start)) return null;
  return Math.round((target - start) / 86_400_000);
}

function relativeMeetLabel(days: number) {
  if (days === 0) return "today";
  if (days === 14) return "2 weeks out";
  if (days === 7) return "1 week out";
  if (days === 1) return "tomorrow";
  return `${days} days out`;
}

function dayCode(week: ProgramWeek, day: ProgramDay) {
  return `W${week.weekNumber}D${day.sequence}`;
}

function isDayComplete(program: TrainingProgram, day: ProgramDay, dayLogs: ReturnType<typeof useProgramWorkspaceStore>["dayLogs"]) {
  const plannedSets = day.exercises.reduce((total, exercise) => total + exercise.sets, 0);
  const handledSets = dayLogs.find((log) => log.programId === program.id && log.dayId === day.id)?.sets.filter((set) => set.completionStatus !== "pending").length ?? 0;
  return plannedSets > 0 && handledSets >= plannedSets;
}

function priorityRank(priority: NotificationPriority) {
  return priority === "urgent" ? 0 : priority === "attention" ? 1 : 2;
}

export function NotificationCenterProvider({ children }: PropsWithChildren) {
  const { session, currentProfile, profiles, selectAthlete } = useSession();
  const workspace = useProgramWorkspaceStore();
  const performance = usePerformanceStore();
  const [state, setState] = useState<NotificationState>(emptyState);
  const [programOffers, setProgramOffers] = useState<ProgramOfferResponse[]>([]);
  const [today, setToday] = useState(() => localIsoDate());
  const userId = session?.userId ?? "anonymous";
  const storageKey = `iron-forge/notification-state/${userId}`;

  useEffect(() => {
    const timer = setInterval(() => setToday((current) => {
      const next = localIsoDate();
      return next === current ? current : next;
    }), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setState(emptyState);
    if (!session) return () => { active = false; };
    void AsyncStorage.getItem(storageKey).then((value) => {
      if (!active || !value) return;
      try {
        const parsed = JSON.parse(value) as Partial<NotificationState>;
        setState({ readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [], dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [] });
      }
      catch {
        setState(emptyState);
      }
    });
    return () => { active = false; };
  }, [session?.userId, storageKey]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    if (!session || session.role !== "ATHLETE") {
      setProgramOffers([]);
      return () => { active = false; };
    }
    const loadOffers = () => void getProgramOffers(session.accessToken).then((offers) => {
      if (active) setProgramOffers(offers);
    }).catch(() => {
      if (active) setProgramOffers([]);
    });
    loadOffers();
    timer = setInterval(loadOffers, 60_000);
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [session?.accessToken, session?.role]);

  const derivedNotifications = useMemo(() => {
    if (!session || !currentProfile || !currentProfile.notificationsEnabled) return [];
    const now = Date.now();
    const items: Omit<AppNotification, "unread">[] = [];
    const athleteName = (athleteId: string) => profiles.find((profile) => profile.id === athleteId)?.displayName ?? "Athlete";
    const relevantPrograms = workspace.programs.filter((program) => program.status === "active" && (session.role === "COACH" || program.athleteId === currentProfile.id));

    for (const program of relevantPrograms) {
      const scheduledDays = program.weeks.flatMap((week) => week.days.map((day) => ({ week, day })));
      for (const { week, day } of scheduledDays) {
        const distance = daysFromToday(day.scheduledDate, today);
        if (distance === null || isDayComplete(program, day, workspace.dayLogs)) continue;
        const code = dayCode(week, day);
        if (session.role === "ATHLETE" && (distance === 0 || distance === 1)) {
          items.push({
            id: `training:${today}:${program.id}:${day.id}`,
            priority: distance === 0 ? "attention" : "info",
            category: "training",
            title: distance === 0 ? `${code} is ready today` : `${code} is tomorrow`,
            body: `${day.name}: ${day.focus || "Open your approved prescription and prepare for the session."}`,
            createdAt: `${today}T00:00:00.000Z`,
            href: "/training",
            actionLabel: "Open Training Log"
          });
        }
        if (distance !== null && distance < 0 && distance >= -3) {
          items.push({
            id: `missed:${today}:${program.id}:${day.id}`,
            priority: "attention",
            category: "training",
            title: session.role === "COACH" ? `${athleteName(program.athleteId)} has an incomplete ${code}` : `${code} is still incomplete`,
            body: `${day.name} was scheduled for ${day.scheduledDate}. Review, complete, or reschedule it.`,
            createdAt: `${today}T00:00:00.000Z`,
            href: session.role === "COACH" ? "/program-review" : "/training",
            actionLabel: session.role === "COACH" ? "Review athlete" : "Open Training Log",
            ...(session.role === "COACH" ? { athleteId: program.athleteId } : {})
          });
        }
        if (session.role === "ATHLETE" && day.scheduleUpdatedBy === "coach" && distance !== null && distance > 1 && distance <= 14 && now - new Date(day.scheduleUpdatedAt).getTime() <= 7 * 86_400_000) {
          items.push({
            id: `schedule:${day.id}:${day.scheduleUpdatedAt}`,
            priority: "info",
            category: "program",
            title: `${code} was rescheduled`,
            body: `${day.name} is now planned for ${day.scheduledDate}.`,
            createdAt: day.scheduleUpdatedAt,
            href: "/schedule",
            actionLabel: "View schedule"
          });
        }
      }
    }

    if (session.role === "ATHLETE") {
      const latestRecovery = performance.recovery.filter((item) => item.athleteId === currentProfile.id).sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))[0];
      if (!latestRecovery || localIsoDate(new Date(latestRecovery.recordedAt)) !== today) {
        items.push({ id: `recovery:${today}`, priority: "info", category: "recovery", title: "Daily recovery check-in", body: "Record sleep, soreness, stress, pain, and motivation before training.", createdAt: `${today}T00:00:00.000Z`, href: "/performance", actionLabel: "Check in" });
      }
      for (const offer of programOffers) {
        items.push({ id: `offer:${offer.id}`, priority: "attention", category: "program", title: "New program needs your approval", body: `${offer.coachName} sent ${offer.name}. Review it before it becomes active.`, createdAt: offer.offeredAt, href: "/dashboard", actionLabel: "Review program" });
      }
    }

    const relevantMeetPlans = performance.meetPlans.filter((plan) => session.role === "COACH" || plan.athleteId === currentProfile.id);
    const plannedMeetAthleteIds = new Set(relevantMeetPlans.map((plan) => plan.athleteId));
    for (const plan of relevantMeetPlans) {
      const days = daysFromToday(plan.meetDate, today);
      if (days === null || days < 0 || days > 14) continue;
      const owner = session.role === "COACH" ? `${athleteName(plan.athleteId)}'s ` : "";
      items.push({
        id: `meet:${today}:${plan.athleteId}:${plan.meetDate}`,
        priority: days <= 1 ? "urgent" : days <= 7 ? "attention" : "info",
        category: "meet",
        title: `${owner}meet is ${relativeMeetLabel(days)}`,
        body: `Competition date: ${plan.meetDate}. Review attempts, weigh-in, equipment, and session timing.`,
        createdAt: `${today}T00:00:00.000Z`,
        href: session.role === "COACH" ? "/intelligence" : "/performance",
        actionLabel: "Open meet plan",
        ...(session.role === "COACH" ? { athleteId: plan.athleteId } : {})
      });
      for (const [kind, timestamp] of [["Weigh-in", plan.weighInAt], ["Session start", plan.sessionStartAt]] as const) {
        if (!timestamp) continue;
        const hours = (new Date(timestamp).getTime() - now) / 3_600_000;
        if (hours < 0 || hours > 24) continue;
        items.push({ id: `meet-time:${kind}:${plan.athleteId}:${timestamp}`, priority: hours <= 2 ? "urgent" : "attention", category: "meet", title: `${kind} is ${hours <= 2 ? "within 2 hours" : "within 24 hours"}`, body: `${session.role === "COACH" ? `${athleteName(plan.athleteId)}: ` : ""}${new Date(timestamp).toLocaleString()}. Confirm timing with meet staff.`, createdAt: `${today}T00:00:00.000Z`, href: session.role === "COACH" ? "/intelligence" : "/performance", actionLabel: "Open meet plan", ...(session.role === "COACH" ? { athleteId: plan.athleteId } : {}) });
      }
    }

    const profileMeetCandidates = session.role === "ATHLETE" ? [currentProfile] : profiles.filter((profile) => profile.role === "ATHLETE");
    for (const profile of profileMeetCandidates) {
      if (!profile.upcomingMeet || plannedMeetAthleteIds.has(profile.id)) continue;
      const days = daysFromToday(profile.upcomingMeet, today);
      if (days === null || days < 0 || days > 14) continue;
      items.push({ id: `profile-meet:${today}:${profile.id}:${profile.upcomingMeet}`, priority: days <= 1 ? "urgent" : days <= 7 ? "attention" : "info", category: "meet", title: `${session.role === "COACH" ? `${profile.displayName}'s ` : ""}meet is ${relativeMeetLabel(days)}`, body: `Competition date: ${profile.upcomingMeet}. Add the full meet plan to track weigh-in, attempts, and equipment.`, createdAt: `${today}T00:00:00.000Z`, href: session.role === "COACH" ? "/intelligence" : "/performance", actionLabel: "Open meet planning", ...(session.role === "COACH" ? { athleteId: profile.id } : {}) });
    }

    const incomingRole = session.role === "COACH" ? "lifter" : "coach";
    workspace.comments.filter((comment) => comment.authorRole === incomingRole && now - new Date(comment.createdAt).getTime() <= 14 * 86_400_000).slice(-20).forEach((comment) => {
      const program = workspace.programs.find((candidate) => candidate.id === comment.programId);
      if (!program || (session.role === "ATHLETE" && program.athleteId !== currentProfile.id)) return;
      items.push({ id: `comment:${comment.id}`, priority: "attention", category: "coaching", title: session.role === "COACH" ? `${athleteName(program.athleteId)} left a training comment` : `${comment.authorName} left a coaching comment`, body: comment.body, createdAt: comment.createdAt, href: session.role === "COACH" ? "/program-review" : "/training", actionLabel: "Open conversation", ...(session.role === "COACH" ? { athleteId: program.athleteId } : {}) });
    });

    if (session.role === "COACH") {
      for (const recovery of performance.recovery) {
        if (now - new Date(recovery.recordedAt).getTime() > 7 * 86_400_000) continue;
        const readiness = calculateRecoveryReadiness(recovery);
        if (recovery.pain >= 4 || readiness <= 60) {
          items.push({ id: `recovery-alert:${recovery.id}`, priority: recovery.pain >= 4 ? "urgent" : "attention", category: "recovery", title: recovery.pain >= 4 ? `${athleteName(recovery.athleteId)} reported pain ${recovery.pain}/10` : `${athleteName(recovery.athleteId)} readiness is ${readiness}`, body: recovery.pain >= 4 ? "Human review is required. Do not generate loading advice for urgent or worsening symptoms." : "Review the athlete's latest recovery signals before changing training.", createdAt: recovery.recordedAt, href: "/intelligence", actionLabel: "Review signals", athleteId: recovery.athleteId });
        }
      }
      for (const log of workspace.dayLogs) {
        const program = workspace.programs.find((candidate) => candidate.id === log.programId);
        if (!program) continue;
        const painCount = log.sets.filter((set) => set.outcomeReason === "pain-limited").length;
        if (painCount) items.push({ id: `pain-log:${program.id}:${log.dayId}:${log.updatedAt}`, priority: "urgent", category: "coaching", title: `${athleteName(program.athleteId)} logged pain-limited work`, body: `${painCount} set${painCount === 1 ? " was" : "s were"} limited by pain. Review before approving changes.`, createdAt: log.updatedAt, href: "/intelligence", actionLabel: "Review exception", athleteId: program.athleteId });
        const latestAnalysis = log.sets.map((set) => set.videoAnalysis).filter(Boolean).sort((left, right) => right!.analyzedAt.localeCompare(left!.analyzedAt))[0];
        if (latestAnalysis && now - new Date(latestAnalysis.analyzedAt).getTime() <= 14 * 86_400_000) items.push({ id: `video:${program.id}:${log.dayId}:${latestAnalysis.analyzedAt}`, priority: "attention", category: "coaching", title: `${athleteName(program.athleteId)} submitted lift analysis`, body: `${latestAnalysis.liftType ?? "Lift"} video is ready for human review (${latestAnalysis.confidence} confidence).`, createdAt: latestAnalysis.analyzedAt, href: "/program-review", actionLabel: "Review footage", athleteId: program.athleteId });
      }
      performance.decisions.filter((decision) => decision.reviewDate && decision.reviewDate <= today && !decision.reviewedAt && decision.status !== "rejected").forEach((decision) => {
        items.push({ id: `outcome:${decision.id}:${decision.reviewDate}`, priority: "attention", category: "coaching", title: `Outcome review due for ${athleteName(decision.athleteId)}`, body: `Review the result of ${decision.action} and record confounders or observed changes.`, createdAt: `${decision.reviewDate}T00:00:00.000Z`, href: "/intelligence", actionLabel: "Review outcome", athleteId: decision.athleteId });
      });
    }

    const pendingSyncCount = performance.pendingEvents.length + performance.pendingDeletions.length + workspace.pendingTrainingSyncCount;
    const syncError = workspace.trainingSyncError ?? performance.lastSyncError;
    if (syncError) items.push({ id: `sync-error:${syncError}`, priority: "urgent", category: "sync", title: "Synchronization failed", body: `${syncError} Your records remain saved on this device.`, createdAt: `${today}T00:00:00.000Z`, href: session.role === "ATHLETE" ? "/performance" : "/dashboard", actionLabel: "Review sync status" });
    else if (pendingSyncCount) items.push({ id: `sync-pending:${pendingSyncCount}`, priority: "attention", category: "sync", title: `${pendingSyncCount} record${pendingSyncCount === 1 ? " is" : "s are"} waiting to sync`, body: "The records are saved on this device and will upload when synchronization succeeds.", createdAt: `${today}T00:00:00.000Z`, href: session.role === "ATHLETE" ? "/performance" : "/dashboard", actionLabel: "Review sync status" });
    performance.meetPlanConflicts.filter((conflict) => session.role === "COACH" || conflict.athleteId === currentProfile.id).forEach((conflict) => items.push({ id: `meet-conflict:${conflict.athleteId}:${conflict.detectedAt}`, priority: "urgent", category: "sync", title: "Meet plan conflict needs resolution", body: "Two devices changed the same meet-plan revision. Choose which copy to retain.", createdAt: conflict.detectedAt, href: session.role === "ATHLETE" ? "/performance" : "/intelligence", actionLabel: "Resolve conflict", ...(session.role === "COACH" ? { athleteId: conflict.athleteId } : {}) }));

    return items.sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority) || right.createdAt.localeCompare(left.createdAt));
  }, [currentProfile, performance, profiles, programOffers, session, today, workspace]);

  const notifications = derivedNotifications.filter((item) => !state.dismissedIds.includes(item.id)).map((item) => ({ ...item, unread: !state.readIds.includes(item.id) }));
  const unreadCount = notifications.filter((item) => item.unread).length;

  async function persistState(next: NotificationState) {
    setState(next);
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
  }

  async function markAllRead() {
    await persistState({ ...state, readIds: [...new Set([...state.readIds, ...notifications.map((item) => item.id)])] });
  }

  async function dismiss(notificationId: string) {
    await persistState({ ...state, dismissedIds: [...new Set([...state.dismissedIds, notificationId])] });
  }

  async function openNotification(notification: AppNotification) {
    if (notification.unread) await persistState({ ...state, readIds: [...new Set([...state.readIds, notification.id])] });
    if (session?.role === "COACH" && notification.athleteId) await selectAthlete(notification.athleteId);
    router.push(notification.href);
  }

  async function retrySync() {
    await Promise.all([workspace.retryTrainingSync(), performance.syncNow()]);
  }

  return <NotificationCenterContext.Provider value={{ notifications, unreadCount, isEnabled: currentProfile?.notificationsEnabled ?? false, markAllRead, dismiss, openNotification, retrySync }}>{children}</NotificationCenterContext.Provider>;
}

export function useNotificationCenter() {
  const context = useContext(NotificationCenterContext);
  if (!context) throw new Error("useNotificationCenter must be used within NotificationCenterProvider.");
  return context;
}