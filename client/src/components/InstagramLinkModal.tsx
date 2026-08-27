import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Link2, X } from "lucide-react-native";

import { isInstagramVideoUrl } from "../lib/instagram";

interface InstagramLinkModalProps {
  visible: boolean;
  exerciseName: string;
  onClose: () => void;
  onSave: (instagramVideoUrl: string) => Promise<void>;
}

export function InstagramLinkModal({ visible, exerciseName, onClose, onSave }: InstagramLinkModalProps) {
  const [instagramVideoUrl, setInstagramVideoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const value = instagramVideoUrl.trim();
    if (!isInstagramVideoUrl(value)) {
      setError("Enter a public Instagram post or reel link.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(value);
      setInstagramVideoUrl("");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the link.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/40"
        behavior={Platform.select({ ios: "padding", default: undefined })}
      >
        <View className="rounded-t-lg bg-paper px-5 pb-8 pt-5">
          <View className="mb-5 flex-row items-start justify-between">
            <View className="mr-4 flex-1">
              <Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Video link</Text>
              <Text className="mt-1 font-serif text-xl font-bold text-ink">{exerciseName}</Text>
            </View>
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-md bg-canvas"
              onPress={onClose}
              accessibilityLabel="Close Instagram link dialog"
            >
              <X size={20} color="#17212B" />
            </Pressable>
          </View>
          <TextInput
            className="rounded-md border border-fog bg-white px-4 py-3 font-serif text-base text-ink"
            value={instagramVideoUrl}
            onChangeText={setInstagramVideoUrl}
            placeholder="https://www.instagram.com/reel/..."
            placeholderTextColor="#688078"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Instagram video URL"
          />
          {error ? <Text className="mt-2 font-serif text-sm text-signal">{error}</Text> : null}
          <Pressable
            className="mt-5 flex-row items-center justify-center gap-2 rounded-md bg-ink py-3.5 disabled:opacity-50"
            onPress={submit}
            disabled={saving}
            accessibilityLabel="Save Instagram video link"
          >
            <Link2 size={18} color="#FFFFFF" />
            <Text className="font-serif text-base font-bold text-white">{saving ? "Saving link" : "Save Instagram link"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
