import { type ChangeEvent, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Activity, Check, FileVideo, X } from "lucide-react-native";

import { analyzeLiftVideoFile } from "../lib/analyzeLiftVideo.web";
import type { LiftCameraView, LiftVideoAnalysis } from "../lib/liftAnalysis";
import type { VideoAnalysisModalProps, VideoAnalysisTarget } from "./VideoAnalysisModal.types";

function targetKey(target: VideoAnalysisTarget) {
  return `${target.exerciseId}-${target.setNumber}`;
}

function metricValue(value: number | null, suffix: string) {
  return value === null ? "Not captured" : `${value.toFixed(1)}${suffix}`;
}

function AnalysisSummary({ analysis, target }: { analysis: LiftVideoAnalysis; target: VideoAnalysisTarget }) {
  const rows: Array<[string, string]> = [
    ["Repetitions", `${analysis.estimatedRepetitions} detected / ${target.prescribedRepetitions} prescribed`],
    ["Mean speed", metricValue(analysis.meanConcentricVelocityMps, " m/s")],
    ["Peak speed", metricValue(analysis.peakConcentricVelocityMps, " m/s")],
    ["Concentric range", metricValue(analysis.concentricRangeCm, " cm")],
    ["Velocity loss", metricValue(analysis.velocityLossPercent, "%")],
    ["Estimated RPE", metricValue(analysis.confidence === "low" ? null : analysis.estimatedRpe, " / 10")]
  ];
  if (analysis.cameraView === "side") {
    rows.splice(5, 0, ["Bar drift", metricValue(analysis.barPathHorizontalDriftCm, " cm")]);
  }
  if (analysis.cameraView === "front" && target.liftType !== "bench") {
    rows.splice(5, 0, ["Stance", metricValue(analysis.stanceWidthCm, " cm")], ["Stance / hips", metricValue(analysis.stanceWidthPercentOfHipWidth, "%")]);
  }
  if (analysis.cameraView === "side" && target.liftType === "squat") {
    rows.splice(6, 0, ["Knee travel", metricValue(analysis.maxKneeTravelPercentOfFemur, "% femur")]);
  }
  return <View className="mt-5 border border-fog bg-canvas p-4"><View className="flex-row items-center justify-between gap-3"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">{target.liftType} analysis result</Text><Text className={`font-serif text-xs font-bold uppercase ${analysis.confidence === "moderate" ? "text-moss" : "text-signal"}`}>{analysis.confidence} confidence</Text></View><View className="mt-3 flex-row flex-wrap">{rows.map(([label, value]) => <View key={label} className="w-1/2 border-t border-fog py-2 pr-3"><Text className="font-serif text-xs text-muted">{label}</Text><Text className="mt-0.5 font-mono text-sm font-bold text-ink">{value}</Text></View>)}</View><View className="mt-2 border-t border-fog pt-3 gap-1">{analysis.notes.map((note) => <Text key={note} className="font-serif text-xs leading-5 text-muted">{note}</Text>)}</View></View>;
}

export function VideoAnalysisModal({ visible, targets, onClose, onSave }: VideoAnalysisModalProps) {
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null);
  const [cameraView, setCameraView] = useState<LiftCameraView>("side");
  const [heightCm, setHeightCm] = useState("175");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<LiftVideoAnalysis | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const selectedTarget = targets.find((target) => targetKey(target) === selectedTargetKey) ?? targets[0] ?? null;

  useEffect(() => {
    if (!visible) {
      setSelectedFile(null);
      setResult(null);
      setMessage(null);
      setProgress(null);
      return;
    }
    if (!selectedTargetKey || !targets.some((target) => targetKey(target) === selectedTargetKey)) {
      setSelectedTargetKey(targets[0] ? targetKey(targets[0]) : null);
    }
  }, [selectedTargetKey, targets, visible]);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedFile(nextFile);
    setResult(null);
    setMessage(null);
    setProgress(null);
  }

  async function analyze() {
    if (!selectedFile || !selectedTarget) {
      setMessage("Choose an original lift video first.");
      return;
    }
    setIsAnalyzing(true);
    setMessage(null);
    setResult(null);
    try {
      const analysis = await analyzeLiftVideoFile(selectedFile, {
        athleteHeightCm: Number(heightCm),
        cameraView,
        liftType: selectedTarget.liftType,
        prescribedRepetitions: selectedTarget.prescribedRepetitions,
        onProgress: (completed, total) => setProgress({ completed, total })
      });
      setResult(analysis);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not analyze this video.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function save() {
    if (!selectedTarget || !result) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave(selectedTarget, result);
      onClose();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not save this analysis.");
    } finally {
      setIsSaving(false);
    }
  }

  return <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}><View className="flex-1 bg-black/60 px-4 py-6"><View className="mx-auto w-full max-w-2xl flex-1 border border-fog bg-paper"><View className="flex-row items-start justify-between border-b border-fog px-5 py-4"><View className="flex-1"><Text className="font-serif text-xs font-bold uppercase tracking-widest text-moss">Browser-local lift analysis</Text><Text className="mt-1 font-serif text-xl font-bold text-ink">Analyze original footage</Text></View><Pressable className="h-10 w-10 items-center justify-center border border-fog" onPress={onClose} disabled={isAnalyzing || isSaving} accessibilityLabel="Close lift analysis"><X size={18} color="#17212B" /></Pressable></View><ScrollView contentContainerClassName="p-5 pb-8" showsVerticalScrollIndicator={false}><View className="border-l-4 border-signal bg-canvas px-4 py-3"><Text className="font-serif text-sm leading-6 text-ink">The video stays in this browser. Only the metrics below can be saved to this training set. Analysis is limited to squat, bench press, and deadlift footage.</Text></View><Text className="mt-5 font-serif text-xs font-bold uppercase tracking-widest text-moss">Save result to</Text><View className="mt-2 flex-row flex-wrap gap-2">{targets.map((target) => <Pressable key={targetKey(target)} className={`min-h-10 border px-3 py-2 ${selectedTarget?.exerciseId === target.exerciseId && selectedTarget.setNumber === target.setNumber ? "border-ink bg-ink" : "border-fog bg-canvas"}`} onPress={() => { setSelectedTargetKey(targetKey(target)); setResult(null); }} disabled={isAnalyzing || isSaving} accessibilityLabel={`Analyze ${target.exerciseName}, set ${target.setNumber}`}><Text className={`font-serif text-sm font-bold ${selectedTarget?.exerciseId === target.exerciseId && selectedTarget.setNumber === target.setNumber ? "text-white" : "text-ink"}`}>{target.exerciseName} · S{target.setNumber} · {target.prescribedRepetitions} reps</Text></Pressable>)}</View>{selectedTarget?.videoAnalysis ? <Text className="mt-2 font-serif text-xs text-moss">This set already has a saved local analysis. A new save replaces it.</Text> : null}<Text className="mt-5 font-serif text-xs font-bold uppercase tracking-widest text-moss">Camera view</Text><View className="mt-2 flex-row gap-2">{(["side", "front"] as const).map((view) => <Pressable key={view} className={`min-h-10 flex-1 border px-3 py-2 ${cameraView === view ? "border-ink bg-ink" : "border-fog bg-canvas"}`} onPress={() => { setCameraView(view); setResult(null); }} disabled={isAnalyzing || isSaving}><Text className={`text-center font-serif text-sm font-bold capitalize ${cameraView === view ? "text-white" : "text-ink"}`}>{view}</Text></Pressable>)}</View><Text className="mt-2 font-serif text-xs leading-5 text-muted">Side view is required for useful bar-path velocity. Front view adds stance width for squat and deadlift. Keep the camera still, show the full body, and use good lighting.</Text><Text className="mt-5 font-serif text-xs font-bold uppercase tracking-widest text-moss">Athlete height</Text><TextInput className="mt-2 min-h-11 border border-fog bg-canvas px-3 font-serif text-base text-ink" value={heightCm} onChangeText={(value) => { setHeightCm(value); setResult(null); }} keyboardType="numeric" placeholder="Height in cm" placeholderTextColor="#688078" editable={!isAnalyzing && !isSaving} accessibilityLabel="Athlete height in centimeters" /><Text className="mt-5 font-serif text-xs font-bold uppercase tracking-widest text-moss">Lift video</Text><View className="mt-2 border border-dashed border-fog bg-canvas p-4"><View className="flex-row items-center gap-3"><FileVideo size={20} color="#2E6F5E" /><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">{selectedFile?.name ?? "Choose a video file"}</Text><Text className="mt-1 font-serif text-xs text-muted">MP4, MOV, or a browser-supported video up to 150 MB and 20 seconds.</Text></View></View><input className="mt-4 block w-full text-sm text-ink" type="file" accept="video/*" capture="environment" onChange={selectFile} disabled={isAnalyzing || isSaving} /></View>{message ? <View className="mt-4 border border-signal bg-[#D74F3212] px-4 py-3"><Text className="font-serif text-sm leading-6 text-signal">{message}</Text></View> : null}{isAnalyzing ? <View className="mt-4 flex-row items-center gap-3 border border-fog bg-canvas px-4 py-3"><ActivityIndicator color="#2E6F5E" /><View className="flex-1"><Text className="font-serif text-sm font-bold text-ink">Analyzing {selectedTarget?.liftType ?? "lift"} pose and motion</Text><Text className="mt-1 font-serif text-xs text-muted">{progress ? `${progress.completed} of ${progress.total} frames sampled` : "Loading the pose model"}</Text></View></View> : null}{result && selectedTarget ? <AnalysisSummary analysis={result} target={selectedTarget} /> : null}<View className="mt-5 flex-row justify-end gap-2"><Pressable className="min-h-11 border border-fog px-4 py-3" onPress={onClose} disabled={isAnalyzing || isSaving}><Text className="font-serif text-sm font-bold text-ink">Cancel</Text></Pressable>{result ? <Pressable className="min-h-11 flex-row items-center gap-2 bg-ink px-4 py-3 disabled:opacity-50" onPress={() => void save()} disabled={isSaving}><Check size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">{isSaving ? "Saving" : "Save analysis"}</Text></Pressable> : <Pressable className="min-h-11 flex-row items-center gap-2 bg-ink px-4 py-3 disabled:opacity-50" onPress={() => void analyze()} disabled={!selectedFile || !selectedTarget || isAnalyzing}><Activity size={16} color="#FFFFFF" /><Text className="font-serif text-sm font-bold text-white">{isAnalyzing ? "Analyzing" : "Analyze video"}</Text></Pressable>}</View></ScrollView></View></View></Modal>;
}