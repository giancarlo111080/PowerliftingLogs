import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { ShieldCheck, UserCheck } from "lucide-react-native";

import { useSession } from "../src/auth/AuthSessionContext";
import { AuthScreen } from "../src/components/AuthScreen";
import { getInvitationContext, type InvitationContextResponse } from "../src/lib/platformApi";

export default function InvitationRoute() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const invitationToken = Array.isArray(token) ? token[0] : token;
  const { isLoading, session, currentProfile, acceptInvitation } = useSession();
  const [invitation, setInvitation] = useState<InvitationContextResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    if (!invitationToken) {
      setError("This coaching invitation link is invalid.");
      return;
    }
    let isMounted = true;
    void getInvitationContext(invitationToken)
      .then((result) => {
        if (isMounted) setInvitation(result);
      })
      .catch((reason) => {
        if (isMounted) setError(reason instanceof Error ? reason.message : "This coaching invitation is invalid or has expired.");
      });
    return () => { isMounted = false; };
  }, [invitationToken]);

  if (isLoading || (!invitation && !error)) {
    return <View className="flex-1 items-center justify-center bg-canvas"><ActivityIndicator color="#CCFF00" /></View>;
  }
  if (invitation && !invitation.existingAccount && invitationToken) {
    return <Redirect href={{ pathname: "/register", params: { token: invitationToken } }} />;
  }
  if (!session && invitationToken) {
    return <AuthScreen initialMode="sign-in" invitationToken={invitationToken} />;
  }

  const emailMatches = invitation && currentProfile?.email.toLowerCase() === invitation.recipientEmail.toLowerCase();
  async function accept() {
    if (!invitationToken) return;
    setIsAccepting(true);
    setError(null);
    try {
      await acceptInvitation(invitationToken);
      router.replace("/training");
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not accept this coaching invitation.");
    }
    finally {
      setIsAccepting(false);
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-canvas px-5 py-8">
      <View className="w-full max-w-xl border border-fog bg-paper p-6">
        <ShieldCheck size={28} color="#CCFF00" />
        <Text className="mt-5 font-heading text-3xl uppercase text-ink">Coaching Invitation</Text>
        {invitation ? <>
          <Text className="mt-3 font-sans text-base leading-6 text-muted">{invitation.coachName} invited {invitation.recipientEmail.toLowerCase()} for {invitation.isPrimary ? "primary " : ""}{invitation.role} coaching.</Text>
          <View className="mt-5 border-l-4 border-signal bg-canvas p-4">
            <Text className="font-sans text-sm leading-5 text-ink">Your existing account, password, coaching workspace, athletes, and history stay unchanged. Accepting adds your athlete workspace and training access.</Text>
          </View>
        </> : null}
        {error ? <Text className="mt-4 font-sans text-sm text-signal">{error}</Text> : null}
        {!emailMatches && invitation ? <Text className="mt-4 font-sans text-sm text-signal">This invitation belongs to another email address. Sign in with {invitation.recipientEmail.toLowerCase()}.</Text> : null}
        <Pressable className="mt-6 min-h-12 flex-row items-center justify-center gap-2 bg-signal px-4 disabled:opacity-50" disabled={!emailMatches || isAccepting} onPress={() => void accept()} accessibilityLabel="Accept coaching invitation">
          {isAccepting ? <ActivityIndicator color="#FFFFFF" /> : <><UserCheck size={18} color="#FFFFFF" /><Text className="font-heading text-base uppercase text-white">Accept coaching</Text></>}
        </Pressable>
      </View>
    </View>
  );
}