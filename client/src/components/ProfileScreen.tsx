import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Bell, CalendarDays, Check, ChevronDown, ClipboardCheck, Globe2, Link, Pencil, Save, Trophy, UserMinus, Users, X } from "lucide-react-native";

import { useSession } from "../auth/AuthSessionContext";
import { formatTonnage, getCoachReviewItems } from "../data/dashboardData";
import { getProgramAnalytics } from "../data/programAnalytics";
import { useProgramWorkspaceStore } from "../data/programWorkspaceStore";
import { countryName } from "../data/countries";
import { addAthleteFederationMembership, getAthleteCareer, getCoachingAssignments, linkAthleteExternalIdentity, revokeCoachingAssignment, type AthleteCareerResponse, type CoachingAssignmentResponse } from "../lib/platformApi";
import { AppShell } from "./AppShell";
import { DatePickerField } from "./DatePickerField";
import { ipfClassification, ipfEligibleAgeDivisions, ipfWeightClasses, type CompetitionSex, type PowerliftingEquipment, type PowerliftingExperience } from "../data/competitionClassification";

interface ProfileDraft {
  displayName: string;
  countryCode: string;
  dateOfBirth: string;
  sex: CompetitionSex;
  competitionAgeDivision: string;
  experience: PowerliftingExperience;
  equipment: PowerliftingEquipment;
  federationCode: string;
  bodyWeightKg: string;
  competitionWeightClass: string;
  squatOneRepMaxKg: string;
  benchOneRepMaxKg: string;
  deadliftOneRepMaxKg: string;
  upcomingMeet: string;
}

function createDraft(profile: NonNullable<ReturnType<typeof useSession>["currentProfile"]>): ProfileDraft {
  return {
    displayName: profile.displayName,
    countryCode: profile.countryCode ?? "",
    dateOfBirth: profile.dateOfBirth ?? "",
    sex: profile.sex ?? "Female",
    competitionAgeDivision: profile.competitionAgeDivision ?? "Open",
    experience: profile.experience ?? "Novice",
    equipment: profile.equipment ?? "Classic",
    federationCode: profile.federationCode ?? "IPF",
    bodyWeightKg: profile.bodyWeightKg?.toString() ?? "",
    competitionWeightClass: profile.competitionWeightClass ?? "",
    squatOneRepMaxKg: profile.squatOneRepMaxKg?.toString() ?? "",
    benchOneRepMaxKg: profile.benchOneRepMaxKg?.toString() ?? "",
    deadliftOneRepMaxKg: profile.deadliftOneRepMaxKg?.toString() ?? "",
    upcomingMeet: profile.upcomingMeet ?? ""
  };
}

function EditableField({ label, value, onChangeText, keyboardType = "default", isDate = false }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: "default" | "decimal-pad"; isDate?: boolean }) {
  if (isDate) {
    return <DatePickerField label={label} value={value} onChangeText={onChangeText} placeholder="YYYY-MM-DD" containerClassName="mb-4" inputClassName="font-serif text-base" labelClassName="font-serif font-bold tracking-widest text-[#688078]" accessibilityLabel={label} />;
  }
  return <View className="mb-4"><Text className="mb-1.5 font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">{label}</Text><TextInput className="min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={value} onChangeText={onChangeText} keyboardType={keyboardType} accessibilityLabel={label} /></View>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View className="flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">{label}</Text><Text className="mt-1 font-serif text-base font-bold text-ink">{value}</Text></View>;
}

function DropdownField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  return <View className="mb-4"><Text className="mb-1.5 font-serif text-xs font-bold uppercase tracking-widest text-[#688078]">{label}</Text><Pressable className="min-h-11 flex-row items-center border border-fog bg-canvas px-3" onPress={() => setIsOpen(true)} accessibilityLabel={`Choose ${label}`}><Text className="flex-1 font-serif text-base text-ink">{value}{label === "Weight class" ? " kg" : ""}</Text><ChevronDown size={17} color="#688078" /></Pressable><Modal transparent animationType="fade" visible={isOpen} onRequestClose={() => setIsOpen(false)}><View className="flex-1 items-center justify-center bg-black/60 px-5"><View className="w-full max-w-sm border border-fog bg-paper p-5"><View className="flex-row items-center justify-between"><Text className="font-serif text-xl font-bold text-ink">{label}</Text><Pressable className="h-9 w-9 items-center justify-center border border-fog" onPress={() => setIsOpen(false)} accessibilityLabel={`Close ${label}`}><X size={17} color="#688078" /></Pressable></View><View className="mt-4">{options.map((option) => <Pressable key={option} className={`min-h-11 flex-row items-center border-t border-fog px-3 py-3 ${option === value ? "bg-moss/10" : ""}`} onPress={() => { onChange(option); setIsOpen(false); }} accessibilityRole="radio" accessibilityState={{ selected: option === value }}><Text className="flex-1 font-serif text-base text-ink">{option}{label === "Weight class" ? " kg" : ""}</Text>{option === value ? <Check size={16} color="#2E6F5E" /> : null}</Pressable>)}</View></View></View></Modal></View>;
}

function kilograms(value: number | undefined) {
  return value === undefined ? "Not set" : `${value} kg`;
}

export function ProfileScreen() {
  const { currentProfile, session, profiles, updateCurrentProfile, leaveCoach } = useSession();
  const { programs, dayLogs, comments, activateProgram } = useProgramWorkspaceStore();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(() => currentProfile ? createDraft(currentProfile) : null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [confirmLeaveCoach, setConfirmLeaveCoach] = useState(false);
  const [isLeavingCoach, setIsLeavingCoach] = useState(false);
  const [coachingAssignments, setCoachingAssignments] = useState<CoachingAssignmentResponse[]>([]);
  const [career, setCareer] = useState<AthleteCareerResponse | null>(null);
  const [switchingProgramId, setSwitchingProgramId] = useState<string | null>(null);
  const [federationMembershipNumbers, setFederationMembershipNumbers] = useState<Record<string, string>>({});
  const [openPowerliftingId, setOpenPowerliftingId] = useState("");

  useEffect(() => {
    if (currentProfile) {
      setDraft(createDraft(currentProfile));
    }
  }, [currentProfile]);

  useEffect(() => {
    if (!session || session.role !== "ATHLETE") {
      setCoachingAssignments([]);
      return;
    }
    let active = true;
    void getCoachingAssignments(session.accessToken).then((assignments) => {
      if (active) setCoachingAssignments(assignments.filter((assignment) => assignment.athleteUserId === session.userId));
    }).catch(() => {
      if (active) setCoachingAssignments([]);
    });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (!session?.activeAthleteId) {
      setCareer(null);
      return;
    }
    let active = true;
    void getAthleteCareer(session.accessToken, session.activeAthleteId).then((response) => {
      if (!active) return;
      setCareer(response);
      setDraft((current) => current ? { ...current, countryCode: response.countryCode ?? "" } : current);
    }).catch(() => {
      if (active) setCareer(null);
    });
    return () => { active = false; };
  }, [session?.accessToken, session?.activeAthleteId]);

  if (!currentProfile || !session || !draft) {
    return <AppShell title="Profile"><View className="flex-1 items-center justify-center bg-canvas"><ActivityIndicator color="#2E6F5E" /><Text className="mt-3 font-serif text-sm text-muted">Loading profile</Text></View></AppShell>;
  }

  const isLifter = session.role === "ATHLETE";
  const athletePrograms = isLifter ? programs.filter((program) => program.athleteId === currentProfile.id).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)) : [];
  const activeProgram = athletePrograms.find((program) => program.status === "active") ?? athletePrograms[0] ?? null;
  const analytics = getProgramAnalytics(activeProgram, dayLogs);
  const achievements: Array<{ code: string; title: string; detail: string }> = [];
  if (analytics.completedSets > 0) {
    achievements.push({ code: "logged-sets", title: `${analytics.completedSets} sets logged`, detail: `${formatTonnage(analytics.completedTonnageKg)} completed in ${activeProgram?.name ?? "the current program"}` });
  }
  if (analytics.plannedSets > 0 && analytics.remainingSets === 0) {
    achievements.push({ code: "program-complete", title: "Program complete", detail: "Every prescribed set has been handled" });
  }
  const assignedAthleteCount = profiles.filter((profile) => profile.role === "ATHLETE").length;
  const reviewWorkload = getCoachReviewItems(profiles, programs, dayLogs, comments).length;
  const eligibleAgeDivisions = ipfEligibleAgeDivisions(draft.dateOfBirth);
  const weightClassOptions = ipfWeightClasses(draft.sex, draft.competitionAgeDivision);

  function updateDraft(field: keyof ProfileDraft, value: string) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  }

  function readPositiveNumber(value: string, fallback: number | undefined) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function hasInvalidPositiveNumber(value: string) {
    if (!value.trim()) {
      return false;
    }
    const parsed = Number(value);
    return !Number.isFinite(parsed) || parsed <= 0;
  }

  async function saveProfile() {
    const currentDraft = draft;
    const profile = currentProfile;
    if (!currentDraft || !profile || !session) {
      return;
    }

    if (!currentDraft.displayName.trim()) {
      setValidationMessage("Display name is required.");
      return;
    }

    if (isLifter && [currentDraft.bodyWeightKg, currentDraft.squatOneRepMaxKg, currentDraft.benchOneRepMaxKg, currentDraft.deadliftOneRepMaxKg].some(hasInvalidPositiveNumber)) {
      setValidationMessage("Body weight and 1RM fields must be positive numbers when provided.");
      return;
    }
    if (isLifter && !ipfClassification(currentDraft.dateOfBirth, currentDraft.sex, Number(currentDraft.bodyWeightKg))) {
      setValidationMessage("Enter a valid date of birth and body weight for competition classification.");
      return;
    }

    const countryCode = currentDraft.countryCode.trim().toUpperCase();
    if (isLifter && countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
      setValidationMessage("Country must use a two-letter ISO code, such as PH.");
      return;
    }
    try {
      await updateCurrentProfile({
        displayName: currentDraft.displayName.trim(),
        countryCode: countryCode || undefined,
        bodyWeightKg: readPositiveNumber(currentDraft.bodyWeightKg, profile.bodyWeightKg),
        dateOfBirth: currentDraft.dateOfBirth,
        sex: currentDraft.sex,
        competitionAgeDivision: currentDraft.competitionAgeDivision,
        experience: currentDraft.experience,
        equipment: currentDraft.equipment,
        federationCode: currentDraft.federationCode,
        competitionWeightClass: currentDraft.competitionWeightClass.trim() || "Unspecified",
        squatOneRepMaxKg: readPositiveNumber(currentDraft.squatOneRepMaxKg, profile.squatOneRepMaxKg),
        benchOneRepMaxKg: readPositiveNumber(currentDraft.benchOneRepMaxKg, profile.benchOneRepMaxKg),
        deadliftOneRepMaxKg: readPositiveNumber(currentDraft.deadliftOneRepMaxKg, profile.deadliftOneRepMaxKg),
        upcomingMeet: currentDraft.upcomingMeet.trim() || undefined
      });
      setValidationMessage(null);
      setIsEditing(false);
    }
    catch (reason) {
      setValidationMessage(reason instanceof Error ? reason.message : "Could not save the profile.");
    }
  }

  async function refreshCareer() {
    const currentSession = session;
    if (!currentSession) return;
    const response = await getAthleteCareer(currentSession.accessToken, currentSession.activeAthleteId);
    setCareer(response);
    setDraft((current) => current ? { ...current, countryCode: response.countryCode ?? "" } : current);
  }

  async function selectActiveProgram(programId: string) {
    if (switchingProgramId) return;
    setSwitchingProgramId(programId);
    setValidationMessage(null);
    try {
      await activateProgram(programId);
      setCareer((current) => current ? { ...current, programHistory: current.programHistory.map((program) => ({ ...program, isActive: program.id === programId, status: program.id === programId ? "accepted" : program.isActive ? "completed" : program.status })) } : current);
    }
    catch (reason) {
      setValidationMessage(reason instanceof Error ? reason.message : "Could not switch the active training block.");
    }
    finally {
      setSwitchingProgramId(null);
    }
  }

  async function addFederationMembership(federationCode: string) {
    const currentSession = session;
    const profile = currentProfile;
    if (!currentSession || !profile) return;
    try {
      const membershipNumber = federationMembershipNumbers[federationCode]?.trim();
      await addAthleteFederationMembership(currentSession.accessToken, profile.id, { federationCode, membershipNumber: membershipNumber || undefined, startsOn: new Date().toISOString().slice(0, 10) });
      setFederationMembershipNumbers((current) => ({ ...current, [federationCode]: "" }));
      await refreshCareer();
      setValidationMessage(`${federationCode} membership added to federation history.`);
    }
    catch (reason) {
      setValidationMessage(reason instanceof Error ? reason.message : "Could not add federation membership.");
    }
  }

  async function linkOpenPowerlifting() {
    const externalId = openPowerliftingId.trim();
    if (!externalId) return setValidationMessage("Enter the OpenPowerlifting lifter ID you have confirmed is yours.");
    const currentSession = session;
    const profile = currentProfile;
    if (!currentSession || !profile) return;
    try {
      await linkAthleteExternalIdentity(currentSession.accessToken, profile.id, { provider: "OpenPowerlifting", externalId });
      setOpenPowerliftingId("");
      await refreshCareer();
      setValidationMessage("OpenPowerlifting identity confirmed for an authorized result import.");
    }
    catch (reason) {
      setValidationMessage(reason instanceof Error ? reason.message : "Could not link OpenPowerlifting identity.");
    }
  }

  function cancelEdit() {
    if (!currentProfile) {
      return;
    }
    setDraft(createDraft(currentProfile));
    setValidationMessage(null);
    setIsEditing(false);
  }

  async function disconnectCoach() {
    if (!confirmLeaveCoach) {
      setConfirmLeaveCoach(true);
      return;
    }
    setIsLeavingCoach(true);
    try {
      await leaveCoach();
      setCoachingAssignments((assignments) => assignments.map((assignment) => assignment.isPrimary && assignment.role === "strength" && assignment.status === "active" ? { ...assignment, status: "revoked", endsAt: new Date().toISOString() } : assignment));
      setConfirmLeaveCoach(false);
      setValidationMessage("Coach disconnected. They no longer have access to your athlete workspace.");
    }
    catch (reason) {
      setValidationMessage(reason instanceof Error ? reason.message : "Could not disconnect your coach.");
    }
    finally {
      setIsLeavingCoach(false);
    }
  }

  async function revokeAssignment(assignment: CoachingAssignmentResponse) {
    if (!session) return;
    try {
      await revokeCoachingAssignment(session.accessToken, assignment.id);
      setCoachingAssignments((assignments) => assignments.map((candidate) => candidate.id === assignment.id ? { ...candidate, status: "revoked", endsAt: new Date().toISOString() } : candidate));
    }
    catch (reason) {
      setValidationMessage(reason instanceof Error ? reason.message : "Could not revoke this coaching assignment.");
    }
  }

  return (
    <AppShell title="Profile">
      <ScrollView className="flex-1" contentContainerClassName="mx-auto w-full max-w-5xl gap-7 px-4 py-6 pb-12" showsVerticalScrollIndicator={false}>
        <View className="flex-col gap-4 border-l-4 border-signal pl-4 sm:flex-row sm:items-end sm:justify-between">
          <View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{isLifter ? "Lifter profile" : "Coach profile"}</Text><Text className="mt-2 font-serif text-3xl font-bold text-ink">{currentProfile.displayName}</Text><Text className="mt-2 font-serif text-base text-[#52675F]">{currentProfile.email}</Text></View>
          {isEditing ? <View className="flex-row gap-2"><Pressable className="min-h-10 flex-row items-center gap-2 rounded-md border border-fog px-3 py-2" onPress={cancelEdit}><X size={16} color="#17212B" /><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable><Pressable className="min-h-10 flex-row items-center gap-2 rounded-md bg-ink px-3 py-2" onPress={() => void saveProfile()}><Save size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Save changes</Text></Pressable></View> : <Pressable className="min-h-10 flex-row items-center gap-2 rounded-md bg-ink px-3 py-2" onPress={() => setIsEditing(true)}><Pencil size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">Edit profile</Text></Pressable>}
        </View>

        {validationMessage ? <View className="border border-signal bg-[#D74F3212] px-4 py-3"><Text className="font-serif text-sm text-signal">{validationMessage}</Text></View> : null}

        {isLifter ? <View className="border border-fog bg-paper p-5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Coaching relationships</Text><Text className="mt-2 font-serif text-lg font-bold text-ink">{coachingAssignments.some((assignment) => assignment.status === "active") ? "Active coaching team" : "Independent athlete"}</Text><Text className="mt-1 font-serif text-sm leading-6 text-[#52675F]">You can use My Training without a coach. Primary strength invitations transfer primary access; specialist and temporary assignments can run concurrently.</Text><View className="mt-4 border-t border-fog">{coachingAssignments.length ? coachingAssignments.map((assignment) => <View key={assignment.id} className="flex-col gap-2 border-b border-fog py-3 sm:flex-row sm:items-center"><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{assignment.coachName}{assignment.isPrimary ? " · Primary" : ""}</Text><Text className="mt-1 font-serif text-xs text-muted">{assignment.role} · {assignment.accessLevel} · {assignment.status}{assignment.movementScope ? ` · ${assignment.movementScope}` : ""}</Text><Text className="mt-1 font-mono text-[11px] text-muted">{new Date(assignment.startsAt).toLocaleDateString()} – {assignment.endsAt ? new Date(assignment.endsAt).toLocaleDateString() : "present"}</Text></View>{assignment.status === "active" ? <Pressable className="min-h-9 flex-row items-center justify-center gap-2 border border-signal px-3" onPress={() => void revokeAssignment(assignment)}><UserMinus size={15} color="#D74F32" /><Text className="font-serif text-xs font-bold text-signal">Revoke</Text></Pressable> : null}</View>) : <Text className="border-b border-fog py-4 font-serif text-sm text-muted">No coaching assignments yet.</Text>}</View>{currentProfile.coachId ? <View className="mt-4"><Pressable className={`min-h-10 flex-row items-center justify-center gap-2 border px-3 py-2 ${confirmLeaveCoach ? "border-signal bg-signal" : "border-fog bg-canvas"}`} onPress={() => void disconnectCoach()} disabled={isLeavingCoach}><UserMinus size={16} color={confirmLeaveCoach ? "#FFFFFF" : "#D74F32"} /><Text className={`font-serif text-sm font-bold ${confirmLeaveCoach ? "text-white" : "text-signal"}`}>{isLeavingCoach ? "Disconnecting..." : confirmLeaveCoach ? "Confirm disconnect" : "Leave primary coach"}</Text></Pressable>{confirmLeaveCoach ? <Pressable className="mt-2 min-h-9 items-center justify-center" onPress={() => setConfirmLeaveCoach(false)}><Text className="font-serif text-sm font-bold text-muted">Cancel</Text></Pressable> : null}</View> : null}</View> : null}

        {isLifter ? (
          <View className="border border-fog bg-paper p-5">
            <View className="flex-row items-center gap-3">
              <Globe2 size={20} color="#2E6F5E" />
              <View className="flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Competition career</Text><Text className="mt-1 font-serif text-lg font-bold text-ink">{career?.countryCode ? countryName(career.countryCode) : "Country not set"} · best official total {career?.bestOfficialTotalKg ?? 0} kg</Text></View>
            </View>
            {career?.availableFederations?.length ? <View className="mt-4 gap-3">{career.availableFederations.map((federation) => <View key={federation.id} className="gap-3 sm:flex-row"><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-serif text-ink" value={federationMembershipNumbers[federation.code] ?? ""} onChangeText={(value) => setFederationMembershipNumbers((current) => ({ ...current, [federation.code]: value }))} placeholder={`${federation.code} membership number`} placeholderTextColor="#8996AC" /><Pressable className="min-h-11 items-center justify-center bg-ink px-4" onPress={() => void addFederationMembership(federation.code)}><Text className="font-serif text-sm font-bold text-white">Add {federation.code} membership</Text></Pressable></View>)}</View> : <Text className="mt-4 font-serif text-sm leading-6 text-muted">No national federation is configured for this country. Training and competition history remain available without one.</Text>}
            <View className="mt-3 gap-3 sm:flex-row"><TextInput className="min-h-11 flex-1 border border-fog bg-canvas px-3 font-serif text-ink" value={openPowerliftingId} onChangeText={setOpenPowerliftingId} placeholder="OpenPowerlifting lifter ID" placeholderTextColor="#8996AC" /><Pressable className="min-h-11 flex-row items-center justify-center gap-2 border border-ink px-4" onPress={() => void linkOpenPowerlifting()}><Link size={15} color="#17212B" /><Text className="font-serif text-sm font-bold text-ink">Confirm identity</Text></Pressable></View>
            <View className="mt-5 gap-5 lg:flex-row">
              <View className="flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-muted">Your qualification gap</Text>{career?.qualificationProgress?.length ? career.qualificationProgress.map((standard) => <View key={standard.id} className="border-b border-fog py-3"><Text className="font-serif text-sm font-bold text-ink">{standard.federationCode} · {standard.name}</Text><Text className={`mt-1 font-mono text-xs ${standard.qualified ? "text-moss" : "text-signal"}`}>{standard.qualified ? "Qualified" : `${standard.gapKg} kg remaining`} · {standard.requiredTotalKg} kg</Text></View>) : <Text className="mt-3 font-serif text-sm text-muted">No sourced standard matches your current class.</Text>}</View>
              <View className="flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-muted">Federation qualifier totals</Text>{career?.qualifierTotals?.length ? career.qualifierTotals.map((standard) => <View key={standard.id} className="flex-row items-center justify-between gap-3 border-b border-fog py-3"><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{standard.federationCode} · {standard.weightClass} kg</Text><Text className="mt-1 font-serif text-xs text-muted">{standard.competitionDivision} · {standard.equipmentCategory}</Text></View><Text className="font-mono text-sm font-bold text-ink">{standard.qualifierTotalKg} kg</Text></View>) : <Text className="mt-3 font-serif text-sm text-muted">No effective, sourced qualifier totals have been imported.</Text>}</View>
            </View>
            <View className="mt-5 gap-5 lg:flex-row">
              <View className="flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-muted">Rankings</Text>{career?.rankings?.length ? career.rankings.slice(0, 5).map((ranking) => <View key={ranking.id} className="border-b border-fog py-3"><Text className="font-serif text-sm font-bold text-ink">#{ranking.rank} of {ranking.rankedLifterCount} · {ranking.scopeCode}</Text><Text className="mt-1 font-mono text-xs text-muted">{ranking.metric} {ranking.score} · {ranking.rankingDate}</Text></View>) : <Text className="mt-3 font-serif text-sm text-muted">No ranking snapshots imported yet.</Text>}</View>
              <View className="flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-muted">Program history</Text><Text className="mt-2 font-serif text-sm text-[#52675F]">{career?.programHistory?.length ?? athletePrograms.length} assigned program(s). Select an accepted or completed block to use it in My Training.</Text>{career?.programHistory?.map((program) => { const canActivate = program.status === "accepted" || program.status === "completed"; return <Pressable key={program.id} className={`border-b py-3 ${program.isActive ? "border-moss bg-[#2E6F5E0D] px-3" : "border-fog"}`} disabled={!canActivate || program.isActive || switchingProgramId !== null} onPress={() => void selectActiveProgram(program.id)} accessibilityRole="button" accessibilityState={{ disabled: !canActivate || program.isActive || switchingProgramId !== null, selected: program.isActive }}><View className="flex-row items-center justify-between gap-3"><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{program.name}</Text><Text className="mt-1 font-serif text-xs text-muted">{program.coachName ?? "Self-directed"} · {program.startsOn} to {program.endsOn}</Text></View><Text className={`font-serif text-xs font-bold uppercase ${program.isActive ? "text-moss" : canActivate ? "text-signal" : "text-muted"}`}>{program.isActive ? "Active" : switchingProgramId === program.id ? "Switching" : canActivate ? "Select" : program.status}</Text></View></Pressable>; })}</View>
            </View>
          </View>
        ) : null}

        {isEditing ? (
          <View className="border border-fog bg-paper p-5">
            <Text className="mb-5 font-serif text-xl font-bold text-ink">Editable details</Text>
            <EditableField label="Display name" value={draft.displayName} onChangeText={(value) => updateDraft("displayName", value)} />
            {isLifter ? <>
              <EditableField label="Country code" value={draft.countryCode} onChangeText={(value) => updateDraft("countryCode", value)} />
              <EditableField label="Date of birth" value={draft.dateOfBirth} onChangeText={(value) => { updateDraft("dateOfBirth", value); const derived = ipfClassification(value, draft.sex, Number(draft.bodyWeightKg)); if (derived) updateDraft("competitionAgeDivision", derived.ageDivision); }} isDate />
              <View className="flex-col gap-0 sm:flex-row sm:gap-4"><View className="flex-1"><DropdownField label="Bodyweight category" value={draft.sex} options={["Female", "Male"]} onChange={(value) => updateDraft("sex", value)} /></View><View className="flex-1"><DropdownField label="Age category" value={draft.competitionAgeDivision} options={eligibleAgeDivisions} onChange={(value) => { updateDraft("competitionAgeDivision", value); const classes = ipfWeightClasses(draft.sex, value); if (!classes.includes(draft.competitionWeightClass)) updateDraft("competitionWeightClass", classes[0]); }} /></View></View>
              <View className="flex-col gap-0 sm:flex-row sm:gap-4"><View className="flex-1"><EditableField label="Body weight (kg)" value={draft.bodyWeightKg} onChangeText={(value) => updateDraft("bodyWeightKg", value)} keyboardType="decimal-pad" /></View><View className="flex-1"><DropdownField label="Weight class" value={draft.competitionWeightClass} options={weightClassOptions} onChange={(value) => updateDraft("competitionWeightClass", value)} /></View><View className="flex-1"><DropdownField label="Federation rules" value={draft.federationCode} options={["IPF"]} onChange={(value) => updateDraft("federationCode", value)} /></View></View>
              <View className="flex-col gap-0 sm:flex-row sm:gap-4"><View className="flex-1"><DropdownField label="Experience category" value={draft.experience} options={["Novice", "Experienced"]} onChange={(value) => updateDraft("experience", value)} /></View><View className="flex-1"><DropdownField label="Equipment category" value={draft.equipment} options={["Classic", "Equipped"]} onChange={(value) => updateDraft("equipment", value)} /></View></View>
              <View className="flex-col gap-0 sm:flex-row sm:gap-4"><View className="flex-1"><EditableField label="Squat 1RM (kg)" value={draft.squatOneRepMaxKg} onChangeText={(value) => updateDraft("squatOneRepMaxKg", value)} keyboardType="decimal-pad" /></View><View className="flex-1"><EditableField label="Bench 1RM (kg)" value={draft.benchOneRepMaxKg} onChangeText={(value) => updateDraft("benchOneRepMaxKg", value)} keyboardType="decimal-pad" /></View><View className="flex-1"><EditableField label="Deadlift 1RM (kg)" value={draft.deadliftOneRepMaxKg} onChangeText={(value) => updateDraft("deadliftOneRepMaxKg", value)} keyboardType="decimal-pad" /></View></View>
              <EditableField label="Upcoming meet date" value={draft.upcomingMeet} onChangeText={(value) => updateDraft("upcomingMeet", value)} isDate />
            </> : <Text className="font-serif text-sm leading-6 text-[#52675F]">Coach assignment totals are managed by the coaching workspace. You can update your display identity and notification preference below.</Text>}
          </View>
        ) : isLifter ? (
          <View className="gap-5"><View className="border border-fog bg-paper p-5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Competition profile</Text><View className="mt-5 flex-col gap-5 lg:flex-row"><Detail label="Body weight" value={kilograms(currentProfile.bodyWeightKg)} /><Detail label="Sex" value={currentProfile.sex ?? "Not set"} /><Detail label="Weight class" value={currentProfile.competitionWeightClass ?? "Not set"} /><Detail label="Current block" value={activeProgram?.name ?? career?.programHistory.find((program) => program.isActive)?.name ?? "Not set"} /><Detail label="Upcoming meet" value={currentProfile.upcomingMeet ?? "Not set"} /></View></View><View className="border border-fog bg-paper p-5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Main lift baselines</Text><View className="mt-5 flex-col gap-5 sm:flex-row"><Detail label="Squat" value={kilograms(currentProfile.squatOneRepMaxKg)} /><Detail label="Bench press" value={kilograms(currentProfile.benchOneRepMaxKg)} /><Detail label="Deadlift" value={kilograms(currentProfile.deadliftOneRepMaxKg)} /></View></View><View><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Progress record</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">Achievements</Text><View className="mt-3 border border-fog bg-paper">{achievements.length ? achievements.map((achievement, index) => <View key={achievement.code} className={`flex-row items-center gap-3 px-4 py-4 ${index ? "border-t border-fog" : ""}`}><Trophy size={18} color="#A36F05" /><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{achievement.title}</Text><Text className="mt-0.5 font-serif text-xs text-[#52675F]">{achievement.detail}</Text></View></View>) : <View className="px-4 py-6"><Text className="font-serif text-sm font-bold text-ink">No achievements yet</Text><Text className="mt-1 font-serif text-xs text-[#52675F]">Completed training will build this progress record.</Text></View>}</View></View></View>
        ) : (
          <View className="gap-5"><View className="border border-fog bg-paper p-5"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Coaching workload</Text><View className="mt-5 flex-col gap-5 sm:flex-row"><View className="flex-1"><Users size={21} color="#2E6F5E" /><Text className="mt-2 font-serif text-3xl font-bold text-ink">{assignedAthleteCount}</Text><Text className="font-serif text-sm text-[#52675F]">assigned athletes</Text></View><View className="flex-1"><ClipboardCheck size={21} color="#D74F32" /><Text className="mt-2 font-serif text-3xl font-bold text-ink">{reviewWorkload}</Text><Text className="font-serif text-sm text-[#52675F]">reviews waiting</Text></View><View className="flex-1"><CalendarDays size={21} color="#17212B" /><Text className="mt-2 font-serif text-3xl font-bold text-ink">This week</Text><Text className="font-serif text-sm text-[#52675F]">program check-in window</Text></View></View></View></View>
        )}

        <View className="border border-fog bg-paper p-5"><View className="flex-row items-center justify-between"><View className="flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center rounded-md bg-[#2E6F5E1A]"><Bell size={19} color="#2E6F5E" /></View><View><Text className="font-serif text-base font-bold text-ink">Review notifications</Text><Text className="mt-0.5 font-serif text-xs text-[#52675F]">New messages, form flags, and submitted footage</Text></View></View><Switch value={currentProfile.notificationsEnabled} onValueChange={(value) => void updateCurrentProfile({ notificationsEnabled: value })} trackColor={{ false: "#DDE5E1", true: "#2E6F5E" }} accessibilityLabel="Toggle review notifications" /></View></View>
      </ScrollView>
    </AppShell>
  );
}