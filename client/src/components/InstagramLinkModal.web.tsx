import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!visible) return;
    const focusTimer = globalThis.setTimeout(() => inputRef.current?.focus(), 0);
    return () => globalThis.clearTimeout(focusTimer);
  }, [visible]);

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
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the link.");
    }
    finally {
      setSaving(false);
    }
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-5">
        <View className="w-full max-w-xl rounded-md bg-paper p-5">
          <View className="mb-5 flex-row items-start justify-between">
            <View className="mr-4 flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Video link</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">{exerciseName}</Text></View>
            <Pressable className="h-10 w-10 items-center justify-center rounded-md bg-canvas" onPress={onClose} accessibilityLabel="Close Instagram link dialog"><X size={20} color="#17212B" /></Pressable>
          </View>
          <input
            ref={inputRef}
            className="min-h-12 w-full rounded-md border border-fog bg-white px-4 py-3 font-serif text-base text-ink outline-none focus:border-moss"
            style={{ color: "#17212B", caretColor: "#17212B", backgroundColor: "#FFFFFF" }}
            type="url"
            value={instagramVideoUrl}
            onChange={(event) => { setInstagramVideoUrl(event.currentTarget.value); setError(null); }}
            onPaste={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const pastedText = event.clipboardData.getData("text/plain");
              const input = event.currentTarget;
              const selectionStart = input.selectionStart ?? instagramVideoUrl.length;
              const selectionEnd = input.selectionEnd ?? selectionStart;
              setInstagramVideoUrl(`${instagramVideoUrl.slice(0, selectionStart)}${pastedText}${instagramVideoUrl.slice(selectionEnd)}`);
              setError(null);
            }}
            onCopy={(event) => event.stopPropagation()}
            onCut={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.stopPropagation()}
            onKeyDown={(event) => { if (event.key === "Enter") void submit(); }}
            placeholder="https://www.instagram.com/reel/..."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Instagram video URL"
          />
          {error ? <Text className="mt-2 font-serif text-sm text-signal">{error}</Text> : null}
          <Pressable className="mt-5 flex-row items-center justify-center gap-2 rounded-md bg-ink py-3.5 disabled:opacity-50" onPress={() => void submit()} disabled={saving} accessibilityLabel="Save Instagram video link"><Link2 size={18} color="#FFFFFF" /><Text className="font-serif text-base font-bold text-white">{saving ? "Saving link" : "Save Instagram link"}</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}