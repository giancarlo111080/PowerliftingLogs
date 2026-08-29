import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Check, ChevronDown, Search, X } from "lucide-react-native";

import { useSession } from "../auth/AuthSessionContext";
import { getExerciseLibrary, type ExerciseBodyPart, type ExerciseLibraryItemResponse } from "../lib/platformApi";

const bodyParts: Array<{ value: ExerciseBodyPart; label: string }> = [
  { value: "back", label: "Back" },
  { value: "chest", label: "Chest" },
  { value: "shoulders", label: "Shoulders" },
  { value: "arms", label: "Arms" },
  { value: "legs", label: "Legs" },
  { value: "glutes", label: "Glutes" },
  { value: "core", label: "Core" }
];

interface AccessoryExercisePickerProps {
  value: string;
  onSelect: (name: string) => void;
  label?: string;
  openOnMount?: boolean;
  onClose?: () => void;
}

export function AccessoryExercisePicker({ value, onSelect, label = "Accessory exercise", openOnMount = false, onClose }: AccessoryExercisePickerProps) {
  const { session } = useSession();
  const [isOpen, setIsOpen] = useState(openOnMount);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ExerciseLibraryItemResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !session || items.length) return;
    let isMounted = true;
    setIsLoading(true);
    void getExerciseLibrary(session.accessToken)
      .then((result) => { if (isMounted) setItems(result); })
      .catch((reason) => { if (isMounted) setError(reason instanceof Error ? reason.message : "Could not load the exercise library."); })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, [isOpen, items.length, session]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = normalizedQuery
    ? items.filter((item) => item.name.toLowerCase().includes(normalizedQuery) || item.bodyPart.includes(normalizedQuery))
    : items;

  function choose(name: string) {
    onSelect(name);
    setIsOpen(false);
    setQuery("");
    onClose?.();
  }

  function close() {
    setIsOpen(false);
    onClose?.();
  }

  return <>
    <View>
      <Text className="mb-1.5 font-heading text-xs uppercase text-muted">{label}</Text>
      <Pressable className="min-h-11 flex-row items-center justify-between border border-fog bg-canvas px-3 py-2" onPress={() => setIsOpen(true)} accessibilityLabel={`Choose ${label.toLowerCase()}`}>
        <Text className={`flex-1 font-sans text-sm ${value && value !== "Accessory Exercise" ? "text-ink" : "text-muted"}`}>{value && value !== "Accessory Exercise" ? value : "Choose from exercise library"}</Text>
        <ChevronDown size={17} color="#9B9B95" />
      </Pressable>
    </View>
    <Modal transparent animationType="fade" visible={isOpen} onRequestClose={close}>
      <View className="flex-1 items-center justify-center bg-black/60 px-4 py-8">
        <View className="max-h-[85vh] w-full max-w-xl border border-fog bg-paper">
          <View className="flex-row items-center justify-between border-b border-fog p-4">
            <View><Text className="font-heading text-lg uppercase text-ink">Exercise library</Text><Text className="mt-1 font-sans text-xs text-muted">Grouped by primary body part</Text></View>
            <Pressable className="h-9 w-9 items-center justify-center border border-fog" onPress={close} accessibilityLabel="Close exercise library"><X size={17} color="#9B9B95" /></Pressable>
          </View>
          <View className="m-4 flex-row items-center gap-2 border border-fog bg-canvas px-3">
            <Search size={16} color="#9B9B95" />
            <TextInput className="min-h-11 flex-1 font-sans text-base text-ink" value={query} onChangeText={setQuery} placeholder="Search exercise or body part" placeholderTextColor="#9B9B95" autoFocus accessibilityLabel="Search exercise library" />
          </View>
          <ScrollView className="px-4 pb-4" showsVerticalScrollIndicator={false}>
            {isLoading ? <ActivityIndicator className="my-8" color="#CCFF00" /> : null}
            {error ? <Text className="mb-4 font-sans text-sm text-signal">{error}</Text> : null}
            {bodyParts.map((bodyPart) => {
              const group = filteredItems.filter((item) => item.bodyPart === bodyPart.value);
              if (!group.length) return null;
              return <View key={bodyPart.value} className="mb-5">
                <Text className="mb-2 font-heading text-xs uppercase text-moss">{bodyPart.label}</Text>
                {group.map((item) => <Pressable key={item.id} className="min-h-11 flex-row items-center justify-between border-t border-fog py-3" onPress={() => choose(item.name)} accessibilityLabel={`Choose ${item.name}`}>
                  <View className="flex-1"><Text className="font-sans text-sm font-bold text-ink">{item.name}</Text>{item.isSystem ? null : <Text className="mt-0.5 font-mono text-[10px] uppercase text-muted">Coach catalog</Text>}</View>
                  {value === item.name ? <Check size={17} color="#2E6F5E" /> : null}
                </Pressable>)}
              </View>;
            })}
            {!isLoading && !error && !filteredItems.length ? <Text className="mb-6 text-center font-sans text-sm text-muted">No matching exercises.</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
