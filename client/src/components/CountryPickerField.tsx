import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Check, ChevronDown, Search, X } from "lucide-react-native";

import { countries, countryName } from "../data/countries";

interface CountryPickerFieldProps {
  value: string;
  onChange: (countryCode: string) => void;
}

export function CountryPickerField({ value, onChange }: CountryPickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCountries = normalizedQuery
    ? countries.filter((country) => country.name.toLowerCase().includes(normalizedQuery) || country.code.toLowerCase().includes(normalizedQuery))
    : countries;

  function chooseCountry(countryCode: string) {
    onChange(countryCode);
    setQuery("");
    setIsOpen(false);
  }

  return (
    <View>
      <Text className="mb-1.5 font-heading text-xs uppercase text-muted">Country</Text>
      <Pressable className="min-h-12 flex-row items-center border border-fog bg-canvas px-3" onPress={() => setIsOpen(true)} accessibilityRole="button" accessibilityLabel="Choose country">
        <Text className={`flex-1 font-sans text-base ${value ? "text-ink" : "text-muted"}`}>{value ? `${countryName(value)} (${value})` : "Select your country"}</Text>
        <ChevronDown size={17} color="#9B9B95" />
      </Pressable>

      <Modal transparent animationType="fade" visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <View className="flex-1 items-center justify-center bg-black/60 px-5 py-10">
          <View className="max-h-[80%] w-full max-w-lg border border-fog bg-paper p-5">
            <View className="flex-row items-center justify-between"><Text className="font-heading text-xl uppercase text-ink">Choose country</Text><Pressable className="h-9 w-9 items-center justify-center border border-fog bg-canvas" onPress={() => setIsOpen(false)} accessibilityLabel="Close country selector"><X size={17} color="#9B9B95" /></Pressable></View>
            <View className="mt-4 flex-row items-center border border-fog bg-canvas px-3"><Search size={17} color="#9B9B95" /><TextInput className="min-h-11 flex-1 px-3 font-sans text-base text-ink" value={query} onChangeText={setQuery} placeholder="Search countries" placeholderTextColor="#9B9B95" autoCapitalize="none" autoFocus accessibilityLabel="Search countries" /></View>
            <ScrollView className="mt-3" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {filteredCountries.map((country) => {
                const selected = country.code === value;
                return <Pressable key={country.code} className={`min-h-11 flex-row items-center border-b border-fog px-3 py-3 ${selected ? "bg-moss/10" : ""}`} onPress={() => chooseCountry(country.code)} accessibilityRole="radio" accessibilityState={{ selected }}><Text className="flex-1 font-sans text-base text-ink">{country.name}</Text><Text className="mr-3 font-mono text-xs text-muted">{country.code}</Text>{selected ? <Check size={16} color="#2E6F5E" /> : null}</Pressable>;
              })}
              {!filteredCountries.length ? <Text className="px-3 py-6 text-center font-sans text-sm text-muted">No countries match that search.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}