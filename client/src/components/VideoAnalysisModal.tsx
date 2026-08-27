import { Modal, Pressable, Text, View } from "react-native";
import { Video, X } from "lucide-react-native";

import type { VideoAnalysisModalProps } from "./VideoAnalysisModal.types";

export function VideoAnalysisModal({ visible, onClose }: VideoAnalysisModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-5">
        <View className="w-full max-w-md border border-fog bg-paper p-5">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Lift analysis</Text><Text className="mt-2 font-serif text-xl font-bold text-ink">Available on the web</Text></View>
            <Pressable className="h-10 w-10 items-center justify-center border border-fog" onPress={onClose} accessibilityLabel="Close lift analysis"><X size={18} color="#17212B" /></Pressable>
          </View>
          <View className="mt-5 flex-row gap-3 border-y border-fog py-4"><Video size={20} color="#2E6F5E" /><Text className="flex-1 font-serif text-sm leading-6 text-muted">Open this training log in the web app to analyze an original lift video locally. The clip is not uploaded or stored by this app.</Text></View>
          <View className="mt-5 items-end"><Pressable className="min-h-10 border border-fog px-4 py-2" onPress={onClose}><Text className="font-serif text-sm font-bold text-ink">Close</Text></Pressable></View>
        </View>
      </View>
    </Modal>
  );
}