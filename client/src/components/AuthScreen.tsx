import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from "react-native";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDot, Dumbbell, KeyRound, Link2, LockKeyhole, ShieldCheck, Users, X } from "lucide-react-native";
import { router } from "expo-router";

import { completePasswordReset, getInvitationContext, isStaticDemo, PlatformApiError, requestPasswordReset, staticDemoCredentials, type PlatformRole } from "../lib/platformApi";
import { useSession } from "../auth/AuthSessionContext";
import { CountryPickerField } from "./CountryPickerField";

type AuthMode = "sign-in" | "register" | "forgot-password" | "reset-password";

interface AuthScreenProps {
  initialMode?: AuthMode;
  invitationToken?: string;
  resetToken?: string;
}

export function AuthScreen({ initialMode = "sign-in", invitationToken, resetToken }: AuthScreenProps) {
  const { login, register } = useSession();
  const staticRegistrationRequested = isStaticDemo && (Boolean(invitationToken) || initialMode === "register");
  const [mode, setMode] = useState<AuthMode>(isStaticDemo ? "sign-in" : resetToken ? "reset-password" : invitationToken ? "sign-in" : initialMode);
  const [role, setRole] = useState<PlatformRole>(invitationToken ? "ATHLETE" : "ATHLETE");
  const [displayName, setDisplayName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(invitationToken ? "Checking your coach invitation..." : null);
  const [message, setMessage] = useState<string | null>(staticRegistrationRequested ? "Registration requires the hosted API. Choose a demo workspace to continue." : initialMode === "reset-password" && !resetToken ? "This password reset link is invalid." : null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!invitationToken || isStaticDemo) {
      return;
    }
    let isMounted = true;
    void getInvitationContext(invitationToken)
      .then((invitation) => {
        if (isMounted) {
          setEmail(invitation.recipientEmail.toLowerCase());
          setMode(invitation.existingAccount ? "sign-in" : "register");
          const assignmentLabel = `${invitation.isPrimary ? "primary " : ""}${invitation.role} coaching`;
          setInviteMessage(invitation.existingAccount
            ? `${invitation.coachName} invited your existing account to accept ${assignmentLabel}. Sign in to accept.`
            : `${invitation.coachName} invited you to create an account and accept ${assignmentLabel}.`);
        }
      })
      .catch(() => {
        if (isMounted) {
          setInviteMessage("This invitation is invalid or has expired.");
        }
      });
    return () => {
      isMounted = false;
    };
  }, [invitationToken]);

  async function submit() {
    setMessage(null);
    setMessageTone("error");
    if (mode === "forgot-password") {
      setResetLink(null);
      if (!email.trim()) {
        setMessage("Enter your email address.");
        return;
      }
      setIsSubmitting(true);
      try {
        const response = await requestPasswordReset(email.trim());
        setMessage(response.message);
        setResetLink(response.resetUrl);
        setMessageTone("success");
      }
      catch (reason) {
        setMessage(reason instanceof Error ? reason.message : "Could not request a password reset.");
      }
      finally {
        setIsSubmitting(false);
      }
      return;
    }
    if (mode === "reset-password") {
      if (!resetToken) {
        setMessage("This password reset link is invalid.");
        return;
      }
      if (password.length < 12 || password.length > 128) {
        setMessage("Use between 12 and 128 characters for your new password.");
        return;
      }
      if (password !== confirmPassword) {
        setMessage("Your passwords do not match.");
        return;
      }
      setIsSubmitting(true);
      try {
        await completePasswordReset(resetToken, password);
        setPassword("");
        setConfirmPassword("");
        setResetLink(null);
        setMode("sign-in");
        setMessage("Your password has been changed. Sign in with your new password.");
        setMessageTone("success");
      }
      catch (reason) {
        setMessage(reason instanceof Error ? reason.message : "Could not reset this password.");
      }
      finally {
        setIsSubmitting(false);
      }
      return;
    }
    if (!email.trim() || !password) {
      setMessage("Enter your email address and password.");
      return;
    }
    if (mode === "register" && !displayName.trim()) {
      setMessage("Enter the name your coach should see.");
      return;
    }
    if (mode === "register" && !countryCode) {
      setMessage("Select your country.");
      return;
    }
    if (mode === "register" && password.length < 12) {
      setMessage("Use at least 12 characters for your password.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setMessage("Your passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "register") {
        await register({ displayName: displayName.trim(), email: email.trim(), password, countryCode: countryCode.trim().toUpperCase(), role, invitationToken });
      }
      else {
        await login(email.trim(), password, invitationToken);
      }
      router.replace("/dashboard");
    }
    catch (reason) {
      if (mode === "register" && reason instanceof PlatformApiError && reason.status === 409) {
        setMode("sign-in");
        setConfirmPassword("");
        setMessage("An account already exists for this email address. Sign in with its password instead.");
      }
      else {
        setMessage(reason instanceof Error ? reason.message : "Could not authenticate this account.");
      }
    }
    finally {
      setIsSubmitting(false);
    }
  }

  async function signInToDemo(kind: "coach" | "athlete") {
    const credentials = staticDemoCredentials[kind];
    setEmail(credentials.email);
    setPassword(credentials.password);
    setMessage(null);
    setIsSubmitting(true);
    try {
      await login(credentials.email, credentials.password);
      router.replace("/dashboard");
    }
    catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not open the static demo.");
    }
    finally {
      setIsSubmitting(false);
    }
  }

  const isRegistering = mode === "register";
  const isForgotPassword = mode === "forgot-password";
  const isResettingPassword = mode === "reset-password";
  const heading = isRegistering ? "Build Your Base" : isForgotPassword ? "Recover Access" : isResettingPassword ? "Set New Password" : "Enter The Platform";
  const supportingText = isRegistering ? "Create the account that owns your training." : isForgotPassword ? "Enter your account email to create a one-hour reset link." : isResettingPassword ? "Choose a new password for your Iron Forge account." : "Sign in to your coaching or athlete workspace.";
  const actionLabel = isRegistering ? "Create account" : isForgotPassword ? "Create reset link" : isResettingPassword ? "Reset password" : "Sign in";
  return (
    <View className="flex-1 bg-canvas px-5 py-8 sm:items-center sm:justify-center">
      <View className="w-full max-w-xl">
        <View className="border-l-4 border-signal pl-4">
          <View className="flex-row items-center gap-3"><View className="h-11 w-11 items-center justify-center border border-fog bg-paper"><Dumbbell size={23} color="#CCFF00" /></View><Text className="font-heading text-3xl uppercase text-ink">Iron Forge</Text></View>
          <Text className="mt-7 font-heading text-4xl uppercase leading-none text-ink">{heading}</Text>
          <Text className="mt-3 font-sans text-base leading-6 text-muted">{supportingText}</Text>
        </View>

        <View className="mt-8 border border-fog bg-paper p-5">
          {isForgotPassword || isResettingPassword ? <Pressable className="flex-row items-center gap-2 border-b border-fog px-1 pb-3" onPress={() => { setMode("sign-in"); setMessage(null); setResetLink(null); setPassword(""); setConfirmPassword(""); }} accessibilityLabel="Back to sign in"><ArrowLeft size={17} color="#9B9B95" /><Text className="font-heading text-sm uppercase text-muted">Back to sign in</Text></Pressable> : <View className="flex-row border-b border-fog"><Pressable className={`flex-1 border-b-2 px-3 py-3 ${!isRegistering ? "border-signal" : "border-transparent"}`} onPress={() => { setMode("sign-in"); setMessage(null); setResetLink(null); }}><Text className={`text-center font-heading text-base uppercase ${!isRegistering ? "text-ink" : "text-muted"}`}>Sign in</Text></Pressable>{!isStaticDemo ? <Pressable className={`flex-1 border-b-2 px-3 py-3 ${isRegistering ? "border-signal" : "border-transparent"}`} onPress={() => { setMode("register"); setMessage(null); setResetLink(null); }}><Text className={`text-center font-heading text-base uppercase ${isRegistering ? "text-ink" : "text-muted"}`}>Register</Text></Pressable> : null}</View>}

          {inviteMessage ? <View className="mt-5 flex-row gap-3 border border-zinc bg-zinc/10 p-3"><ShieldCheck size={18} color="#CCFF00" /><Text className="flex-1 font-sans text-sm leading-5 text-ink">{inviteMessage}</Text></View> : null}
          {isStaticDemo && !isRegistering ? <View className="mt-5 border border-fog bg-canvas p-4"><Text className="font-heading text-sm uppercase text-ink">Open the static demo</Text><Text className="mt-1 font-sans text-sm leading-5 text-muted">Choose a sample workspace. Changes stay only in this browser.</Text><View className="mt-4 flex-col gap-2 sm:flex-row"><Pressable className="min-h-11 flex-1 flex-row items-center justify-center gap-2 border border-fog bg-paper px-3 py-3 disabled:opacity-60" onPress={() => void signInToDemo("athlete")} disabled={isSubmitting} accessibilityLabel="Open athlete demo"><Dumbbell size={17} color="#F5F7FB" /><Text className="font-heading text-sm uppercase text-ink">Athlete demo</Text></Pressable><Pressable className="min-h-11 flex-1 flex-row items-center justify-center gap-2 bg-signal px-3 py-3 disabled:opacity-60" onPress={() => void signInToDemo("coach")} disabled={isSubmitting} accessibilityLabel="Open coach demo"><Users size={17} color="#FFFFFF" /><Text className="font-heading text-sm uppercase text-white">Coach demo</Text></Pressable></View></View> : null}
          {isRegistering ? <View className="mt-5 gap-2"><Text className="font-heading text-sm uppercase text-ink">Account type</Text><View className="flex-col gap-2 sm:flex-row">{(["ATHLETE", "COACH"] as PlatformRole[]).map((candidate) => { const selected = role === candidate; const Icon = candidate === "ATHLETE" ? Dumbbell : Users; return <Pressable key={candidate} className={`min-h-16 flex-1 flex-row items-center gap-3 border px-4 py-3 ${selected ? "border-signal bg-signal/10" : "border-fog bg-canvas"} ${invitationToken && candidate === "COACH" ? "opacity-40" : ""}`} onPress={() => !invitationToken && setRole(candidate)} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`Register as ${candidate.toLowerCase()}`}><CircleDot size={18} color={selected ? "#D32F2F" : "#9B9B95"} /><Icon size={18} color={selected ? "#F4F4ED" : "#9B9B95"} /><Text className={`font-heading text-sm uppercase ${selected ? "text-ink" : "text-muted"}`}>{candidate}</Text></Pressable>; })}</View></View> : null}

          <View className="mt-5 gap-4">
            {isRegistering ? <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="How your coach will know you" /> : null}
            {isRegistering ? <CountryPickerField value={countryCode} onChange={setCountryCode} /> : null}
            {!isResettingPassword ? <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" editable={!Boolean(invitationToken)} /> : null}
            {!isForgotPassword ? <Field label={isResettingPassword ? "New password" : "Password"} value={password} onChangeText={setPassword} placeholder="At least 12 characters" secureTextEntry /> : null}
            {isRegistering || isResettingPassword ? <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat your password" secureTextEntry /> : null}
            {mode === "sign-in" && !isStaticDemo ? <Pressable className="self-end py-1" onPress={() => { setMode("forgot-password"); setMessage(null); setResetLink(null); setPassword(""); }} accessibilityLabel="Forgot password"><Text className="font-heading text-sm uppercase text-signal">Forgot password?</Text></Pressable> : null}
          </View>
          {message ? <View className={`mt-4 flex-row gap-2 border p-3 ${messageTone === "success" ? "border-moss bg-moss/10" : "border-signal bg-signal/10"}`}>{messageTone === "success" ? <CheckCircle2 size={17} color="#2E6F5E" /> : <X size={17} color="#D32F2F" />}<Text className="flex-1 font-sans text-sm leading-5 text-ink">{message}</Text></View> : null}
          {resetLink ? <View className="mt-3 gap-3 border border-moss bg-canvas p-3"><View className="flex-row items-start gap-2"><Link2 size={17} color="#2E6F5E" /><Text selectable className="flex-1 font-mono text-xs leading-5 text-muted">{resetLink}</Text></View><Pressable className="min-h-11 flex-row items-center justify-center gap-2 bg-moss px-4" onPress={() => void Linking.openURL(resetLink)} accessibilityRole="link" accessibilityLabel="Open password reset form"><KeyRound size={17} color="#FFFFFF" /><Text className="font-heading text-sm uppercase text-white">Open reset form</Text></Pressable></View> : null}
          <Pressable className="mt-5 min-h-12 flex-row items-center justify-center gap-2 bg-signal px-4 py-3 disabled:opacity-60" onPress={() => void submit()} disabled={isSubmitting} accessibilityLabel={actionLabel}>{isSubmitting ? <ActivityIndicator color="#F4F4ED" /> : <>{isForgotPassword || isResettingPassword ? <KeyRound size={18} color="#F4F4ED" /> : <LockKeyhole size={18} color="#F4F4ED" />}<Text className="font-heading text-base uppercase text-white">{actionLabel}</Text><ArrowRight size={17} color="#F4F4ED" /></>}</Pressable>
        </View>
        <Text className="mt-5 text-center font-mono text-xs leading-5 text-muted">IRON FORGE USES SECURE SESSION TOKENS AND ROLE-BASED ACCESS.</Text>
      </View>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, keyboardType = "default", editable = true }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; secureTextEntry?: boolean; keyboardType?: "default" | "email-address"; editable?: boolean }) {
  return <View><Text className="mb-1.5 font-heading text-xs uppercase text-muted">{label}</Text><TextInput className="min-h-12 border border-fog bg-canvas px-3 font-sans text-base text-ink" value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9B9B95" secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize="none" editable={editable} accessibilityLabel={label} /></View>;
}