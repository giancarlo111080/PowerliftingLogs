import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { ArrowRight, CircleDot, Dumbbell, LockKeyhole, ShieldCheck, Users, X } from "lucide-react-native";
import { router } from "expo-router";

import { getInvitationContext, type PlatformRole } from "../lib/platformApi";
import { useSession } from "../auth/AuthSessionContext";

interface AuthScreenProps {
  initialMode?: "sign-in" | "register";
  invitationToken?: string;
}

export function AuthScreen({ initialMode = "sign-in", invitationToken }: AuthScreenProps) {
  const { login, register } = useSession();
  const [mode, setMode] = useState<"sign-in" | "register">(invitationToken ? "register" : initialMode);
  const [role, setRole] = useState<PlatformRole>(invitationToken ? "ATHLETE" : "ATHLETE");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(invitationToken ? "Checking your coach invitation..." : null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!invitationToken) {
      return;
    }
    let isMounted = true;
    void getInvitationContext(invitationToken)
      .then((invitation) => {
        if (isMounted) {
          setEmail(invitation.recipientEmail.toLowerCase());
          setInviteMessage(`${invitation.coachName} has reserved an athlete place for you.`);
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
    if (!email.trim() || !password) {
      setMessage("Enter your email address and password.");
      return;
    }
    if (mode === "register" && !displayName.trim()) {
      setMessage("Enter the name your coach should see.");
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
        await register({ displayName: displayName.trim(), email: email.trim(), password, role, invitationToken });
      }
      else {
        await login(email.trim(), password);
      }
      router.replace("/dashboard");
    }
    catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not authenticate this account.");
    }
    finally {
      setIsSubmitting(false);
    }
  }

  const isRegistering = mode === "register";
  return (
    <View className="flex-1 bg-canvas px-5 py-8 sm:items-center sm:justify-center">
      <View className="w-full max-w-xl">
        <View className="border-l-4 border-signal pl-4">
          <View className="flex-row items-center gap-3"><View className="h-11 w-11 items-center justify-center border border-fog bg-paper"><Dumbbell size={23} color="#CCFF00" /></View><Text className="font-heading text-3xl uppercase text-ink">Iron Forge</Text></View>
          <Text className="mt-7 font-heading text-4xl uppercase leading-none text-ink">{isRegistering ? "Build Your Base" : "Enter The Platform"}</Text>
          <Text className="mt-3 font-sans text-base leading-6 text-muted">{isRegistering ? "Create the account that owns your training." : "Sign in to your coaching or athlete workspace."}</Text>
        </View>

        <View className="mt-8 border border-fog bg-paper p-5">
          <View className="flex-row border-b border-fog"><Pressable className={`flex-1 border-b-2 px-3 py-3 ${!isRegistering ? "border-signal" : "border-transparent"}`} onPress={() => { setMode("sign-in"); setMessage(null); }}><Text className={`text-center font-heading text-base uppercase ${!isRegistering ? "text-ink" : "text-muted"}`}>Sign in</Text></Pressable><Pressable className={`flex-1 border-b-2 px-3 py-3 ${isRegistering ? "border-signal" : "border-transparent"}`} onPress={() => { setMode("register"); setMessage(null); }}><Text className={`text-center font-heading text-base uppercase ${isRegistering ? "text-ink" : "text-muted"}`}>Register</Text></Pressable></View>

          {inviteMessage ? <View className="mt-5 flex-row gap-3 border border-zinc bg-zinc/10 p-3"><ShieldCheck size={18} color="#CCFF00" /><Text className="flex-1 font-sans text-sm leading-5 text-ink">{inviteMessage}</Text></View> : null}
          {isRegistering ? <View className="mt-5 gap-2"><Text className="font-heading text-sm uppercase text-ink">Account type</Text><View className="flex-col gap-2 sm:flex-row">{(["ATHLETE", "COACH"] as PlatformRole[]).map((candidate) => { const selected = role === candidate; const Icon = candidate === "ATHLETE" ? Dumbbell : Users; return <Pressable key={candidate} className={`min-h-16 flex-1 flex-row items-center gap-3 border px-4 py-3 ${selected ? "border-signal bg-signal/10" : "border-fog bg-canvas"} ${invitationToken && candidate === "COACH" ? "opacity-40" : ""}`} onPress={() => !invitationToken && setRole(candidate)} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`Register as ${candidate.toLowerCase()}`}><CircleDot size={18} color={selected ? "#D32F2F" : "#9B9B95"} /><Icon size={18} color={selected ? "#F4F4ED" : "#9B9B95"} /><Text className={`font-heading text-sm uppercase ${selected ? "text-ink" : "text-muted"}`}>{candidate}</Text></Pressable>; })}</View></View> : null}

          <View className="mt-5 gap-4">
            {isRegistering ? <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="How your coach will know you" /> : null}
            <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" editable={!Boolean(invitationToken)} />
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 12 characters" secureTextEntry />
            {isRegistering ? <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat your password" secureTextEntry /> : null}
          </View>
          {message ? <View className="mt-4 flex-row gap-2 border border-signal bg-signal/10 p-3"><X size={17} color="#D32F2F" /><Text className="flex-1 font-sans text-sm leading-5 text-ink">{message}</Text></View> : null}
          <Pressable className="mt-5 min-h-12 flex-row items-center justify-center gap-2 bg-signal px-4 py-3 disabled:opacity-60" onPress={() => void submit()} disabled={isSubmitting} accessibilityLabel={isRegistering ? "Create account" : "Sign in"}>{isSubmitting ? <ActivityIndicator color="#F4F4ED" /> : <><LockKeyhole size={18} color="#F4F4ED" /><Text className="font-heading text-base uppercase text-white">{isRegistering ? "Create account" : "Sign in"}</Text><ArrowRight size={17} color="#F4F4ED" /></>}</Pressable>
        </View>
        <Text className="mt-5 text-center font-mono text-xs leading-5 text-muted">IRON FORGE USES SECURE SESSION TOKENS AND ROLE-BASED ACCESS.</Text>
      </View>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, keyboardType = "default", editable = true }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; secureTextEntry?: boolean; keyboardType?: "default" | "email-address"; editable?: boolean }) {
  return <View><Text className="mb-1.5 font-heading text-xs uppercase text-muted">{label}</Text><TextInput className="min-h-12 border border-fog bg-canvas px-3 font-sans text-base text-ink" value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9B9B95" secureTextEntry={secureTextEntry} keyboardType={keyboardType} autoCapitalize="none" editable={editable} accessibilityLabel={label} /></View>;
}