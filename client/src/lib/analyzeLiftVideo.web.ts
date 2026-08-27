import type { LiftAnalysisConfidence, LiftCameraView, LiftVideoAnalysis, PrimaryLift } from "./liftAnalysis";

interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface PoseDetectionResult {
  landmarks: Landmark[][];
}

interface PoseLandmarkerInstance {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => PoseDetectionResult;
  close?: () => void;
}

interface VisionLibrary {
  FilesetResolver: {
    forVisionTasks: (wasmRoot: string) => Promise<unknown>;
  };
  PoseLandmarker: {
    createFromOptions: (vision: unknown, options: unknown) => Promise<PoseLandmarkerInstance>;
  };
}

interface Point {
  x: number;
  y: number;
}

interface FrameSample {
  time: number;
  bar: Point;
  hip: Point | null;
  scaleMetresPerPixel: number;
  stanceWidthPx: number | null;
  hipWidthPx: number | null;
  kneeTravelPercentOfFemur: number | null;
}

interface RepMetric {
  meanVelocityMps: number;
  peakVelocityMps: number;
  rangeMetres: number;
  horizontalDriftMetres: number | null;
}

interface LiftProfile {
  startsAtTop: boolean;
  minimumRangeMetres: number;
  maximumRangeMetres: number;
  minimumHipAscentMetres: number;
  maximumHorizontalDriftMetres: number;
  maximumMeanVelocityMps: number;
  fastVelocityMps: number;
  limitVelocityMps: number;
}

export interface LiftVideoAnalysisOptions {
  athleteHeightCm: number;
  cameraView: LiftCameraView;
  liftType: PrimaryLift;
  prescribedRepetitions: number;
  onProgress?: (completedSamples: number, totalSamples: number) => void;
}

const visionModuleUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const visionWasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const poseModelUrl = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const targetSampleRateFps = 6;
const maximumDurationSeconds = 20;
const maximumFileSizeBytes = 150 * 1024 * 1024;
const maximumSamples = 96;
const metadataTimeoutMs = 12_000;
const modelTimeoutMs = 20_000;
const seekTimeoutMs = 8_000;
const stableStartFrames = 2;
const liftProfiles: Record<PrimaryLift, LiftProfile> = {
  squat: { startsAtTop: true, minimumRangeMetres: 0.15, maximumRangeMetres: 0.85, minimumHipAscentMetres: 0, maximumHorizontalDriftMetres: 0.3, maximumMeanVelocityMps: 1.6, fastVelocityMps: 0.75, limitVelocityMps: 0.25 },
  bench: { startsAtTop: true, minimumRangeMetres: 0.06, maximumRangeMetres: 0.45, minimumHipAscentMetres: 0, maximumHorizontalDriftMetres: 0.22, maximumMeanVelocityMps: 1.4, fastVelocityMps: 0.55, limitVelocityMps: 0.12 },
  deadlift: { startsAtTop: false, minimumRangeMetres: 0.22, maximumRangeMetres: 1.05, minimumHipAscentMetres: 0.08, maximumHorizontalDriftMetres: 0.3, maximumMeanVelocityMps: 1.8, fastVelocityMps: 0.75, limitVelocityMps: 0.18 }
};

let visionLibraryPromise: Promise<VisionLibrary> | null = null;

function getVisionLibrary() {
  return (globalThis as typeof globalThis & { ironForgeVision?: VisionLibrary }).ironForgeVision;
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    operation.then((value) => {
      window.clearTimeout(timeout);
      resolve(value);
    }, (reason: unknown) => {
      window.clearTimeout(timeout);
      reject(reason);
    });
  });
}

async function loadVisionLibrary(): Promise<VisionLibrary> {
  const availableLibrary = getVisionLibrary();
  if (availableLibrary) {
    return availableLibrary;
  }
  if (visionLibraryPromise) {
    return visionLibraryPromise;
  }
  visionLibraryPromise = new Promise<VisionLibrary>((resolve, reject) => {
    const readyEventName = "iron-forge-vision-ready";
    const script = document.createElement("script");
    script.type = "module";
    const complete = () => {
      window.removeEventListener(readyEventName, complete);
      const loadedLibrary = getVisionLibrary();
      if (loadedLibrary) {
        resolve(loadedLibrary);
        return;
      }
      reject(new Error("The pose-analysis library did not initialize."));
    };
    window.addEventListener(readyEventName, complete, { once: true });
    script.textContent = `import * as vision from "${visionModuleUrl}"; globalThis.ironForgeVision = vision; window.dispatchEvent(new Event("${readyEventName}"));`;
    script.onerror = () => reject(new Error("Could not load the pose-analysis library. Check your connection and try again."));
    document.head.appendChild(script);
  });
  try {
    return await withTimeout(visionLibraryPromise, modelTimeoutMs, "The pose-analysis library did not load within 20 seconds. Check your internet connection or browser privacy extensions, then try again.");
  } catch (reason) {
    visionLibraryPromise = null;
    throw reason;
  }
}

function midpoint(points: Array<Landmark | undefined>): Point | null {
  const visiblePoints = points.filter((point): point is Landmark => point !== undefined && (point.visibility ?? 1) >= 0.35);
  if (visiblePoints.length !== points.length) {
    return null;
  }
  return {
    x: visiblePoints.reduce((total, point) => total + point.x, 0) / visiblePoints.length,
    y: visiblePoints.reduce((total, point) => total + point.y, 0) / visiblePoints.length
  };
}

function distance(first: Point, second: Point) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function median(values: number[]) {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function percentile(values: number[], fraction: number) {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const position = clamp(fraction, 0, 1) * (sorted.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const weight = position - lowerIndex;
  return sorted[lowerIndex] + ((sorted[upperIndex] - sorted[lowerIndex]) * weight);
}

function rollingAverage(values: number[], windowSize = 5) {
  const halfWindow = Math.floor(windowSize / 2);
  return values.map((_, index) => {
    const start = Math.max(0, index - halfWindow);
    const end = Math.min(values.length, index + halfWindow + 1);
    return mean(values.slice(start, end)) ?? values[index];
  });
}

function stabilizeSamples(samples: FrameSample[]) {
  return samples.map((sample, index) => {
    const nearbySamples = samples.slice(Math.max(0, index - 1), Math.min(samples.length, index + 2));
    return {
      ...sample,
      bar: {
        x: median(nearbySamples.map((nearby) => nearby.bar.x)) ?? sample.bar.x,
        y: median(nearbySamples.map((nearby) => nearby.bar.y)) ?? sample.bar.y
      }
    };
  });
}

function createRepMetric(samples: FrameSample[], smoothedHeights: number[], bottomIndex: number, lockoutIndex: number, profile: LiftProfile): RepMetric | null {
  if (lockoutIndex <= bottomIndex) {
    return null;
  }
  const segment = samples.slice(bottomIndex, lockoutIndex + 1);
  const scale = median(segment.map((sample) => sample.scaleMetresPerPixel));
  const durationSeconds = samples[lockoutIndex].time - samples[bottomIndex].time;
  if (!scale || durationSeconds < 0.18 || durationSeconds > 5) {
    return null;
  }
  const ascentPixels = smoothedHeights[bottomIndex] - smoothedHeights[lockoutIndex];
  const rangeMetres = ascentPixels * scale;
  if (rangeMetres < profile.minimumRangeMetres || rangeMetres > profile.maximumRangeMetres) {
    return null;
  }
  if (profile.minimumHipAscentMetres > 0) {
    const bottomHip = samples[bottomIndex].hip;
    const lockoutHip = samples[lockoutIndex].hip;
    const hipAscentMetres = bottomHip && lockoutHip ? (bottomHip.y - lockoutHip.y) * scale : 0;
    if (hipAscentMetres < profile.minimumHipAscentMetres) {
      return null;
    }
  }
  let totalVerticalTravelPixels = 0;
  const instantaneousSpeeds: number[] = [];
  for (let index = bottomIndex; index < lockoutIndex; index += 1) {
    const verticalChangePixels = smoothedHeights[index] - smoothedHeights[index + 1];
    const elapsedSeconds = samples[index + 1].time - samples[index].time;
    totalVerticalTravelPixels += Math.abs(verticalChangePixels);
    if (verticalChangePixels > 0 && elapsedSeconds > 0) {
      const speed = (verticalChangePixels * scale) / elapsedSeconds;
      if (speed <= 3) {
        instantaneousSpeeds.push(speed);
      }
    }
  }
  if (totalVerticalTravelPixels <= 0 || ascentPixels / totalVerticalTravelPixels < 0.52) {
    return null;
  }
  const meanVelocityMps = rangeMetres / durationSeconds;
  if (meanVelocityMps < 0.03 || meanVelocityMps > profile.maximumMeanVelocityMps) {
    return null;
  }
  const horizontalPositions = segment.map((sample) => sample.bar.x);
  const lowerHorizontalPosition = percentile(horizontalPositions, 0.1);
  const upperHorizontalPosition = percentile(horizontalPositions, 0.9);
  const horizontalDriftMetres = lowerHorizontalPosition === null || upperHorizontalPosition === null
    ? null
    : (upperHorizontalPosition - lowerHorizontalPosition) * scale;
  return {
    meanVelocityMps,
    peakVelocityMps: percentile(instantaneousSpeeds, 0.9) ?? meanVelocityMps,
    rangeMetres,
    horizontalDriftMetres: horizontalDriftMetres !== null && horizontalDriftMetres <= profile.maximumHorizontalDriftMetres ? horizontalDriftMetres : null
  };
}

function deriveRepMetrics(rawSamples: FrameSample[], liftType: PrimaryLift): RepMetric[] {
  if (rawSamples.length < 8) {
    return [];
  }
  const profile = liftProfiles[liftType];
  const samples = stabilizeSamples(rawSamples);
  const smoothedHeights = rollingAverage(samples.map((sample) => sample.bar.y), 3);
  const topPosition = percentile(smoothedHeights, 0.1);
  const bottomPosition = percentile(smoothedHeights, 0.9);
  const scale = median(samples.map((sample) => sample.scaleMetresPerPixel));
  if (topPosition === null || bottomPosition === null || !scale) {
    return [];
  }
  const observedRangeMetres = (bottomPosition - topPosition) * scale;
  if (observedRangeMetres < profile.minimumRangeMetres || observedRangeMetres > profile.maximumRangeMetres * 1.15) {
    return [];
  }
  const verticalRange = bottomPosition - topPosition;
  const topThreshold = topPosition + (verticalRange * 0.24);
  const bottomThreshold = topPosition + (verticalRange * 0.72);
  const metrics: RepMetric[] = [];
  let phase: "waiting" | "armed" | "returning" = "waiting";
  let bottomIndex = -1;
  let stablePositionCount = 0;

  for (let index = 0; index < samples.length; index += 1) {
    const height = smoothedHeights[index];
    if (profile.startsAtTop) {
      if (phase === "waiting" && height <= topThreshold) {
        stablePositionCount += 1;
        if (stablePositionCount >= stableStartFrames) {
          phase = "armed";
          stablePositionCount = 0;
        }
      } else if (phase === "waiting") {
        stablePositionCount = 0;
      } else if (phase === "armed" && height >= bottomThreshold) {
        bottomIndex = index;
        phase = "returning";
      } else if (phase === "returning") {
        if (height > smoothedHeights[bottomIndex]) {
          bottomIndex = index;
        }
        if (height <= topThreshold) {
          const metric = createRepMetric(samples, smoothedHeights, bottomIndex, index, profile);
          if (metric) {
            metrics.push(metric);
          }
          phase = "waiting";
          stablePositionCount = 1;
          bottomIndex = -1;
        }
      }
    } else {
      if ((phase === "waiting" || phase === "returning") && height >= bottomThreshold) {
        if (bottomIndex < 0 || height > smoothedHeights[bottomIndex]) {
          bottomIndex = index;
        }
        stablePositionCount += 1;
        if (stablePositionCount >= stableStartFrames) {
          phase = "armed";
          stablePositionCount = 0;
        }
      } else if (phase === "waiting" || phase === "returning") {
        stablePositionCount = 0;
        bottomIndex = -1;
      } else if (phase === "armed") {
        if (height > smoothedHeights[bottomIndex]) {
          bottomIndex = index;
        }
        if (height <= topThreshold) {
          const metric = createRepMetric(samples, smoothedHeights, bottomIndex, index, profile);
          if (metric) {
            metrics.push(metric);
          }
          phase = "returning";
          bottomIndex = -1;
        }
      }
    }
  }
  return metrics;
}

function analysisConfidence(samples: FrameSample[], expectedSamples: number, repetitions: number, prescribedRepetitions: number): LiftAnalysisConfidence {
  const trackingRatio = samples.length / Math.max(expectedSamples, 1);
  const repetitionCountIsPlausible = prescribedRepetitions < 1 || repetitions <= prescribedRepetitions;
  return trackingRatio >= 0.72 && repetitions > 0 && repetitionCountIsPlausible ? "moderate" : "low";
}

function landmarkPoint(landmark: Landmark | undefined, videoWidth: number, videoHeight: number): Point | null {
  if (!landmark || (landmark.visibility ?? 1) < 0.35) {
    return null;
  }
  return { x: landmark.x * videoWidth, y: landmark.y * videoHeight };
}

function chainLength(landmarks: Landmark[], indices: number[], videoWidth: number, videoHeight: number) {
  const points = indices.map((index) => landmarkPoint(landmarks[index], videoWidth, videoHeight));
  if (points.some((point) => point === null)) {
    return null;
  }
  return points.slice(1).reduce((total, point, index) => total + distance(points[index]!, point!), 0);
}

function kneeTravelRatio(landmarks: Landmark[], hipIndex: number, kneeIndex: number, ankleIndex: number, videoWidth: number, videoHeight: number) {
  const hip = landmarkPoint(landmarks[hipIndex], videoWidth, videoHeight);
  const knee = landmarkPoint(landmarks[kneeIndex], videoWidth, videoHeight);
  const ankle = landmarkPoint(landmarks[ankleIndex], videoWidth, videoHeight);
  if (!hip || !knee || !ankle) {
    return null;
  }
  return (Math.abs(knee.x - ankle.x) / Math.max(distance(hip, knee), 1)) * 100;
}

function frameFromLandmarks(landmarks: Landmark[], time: number, athleteHeightCm: number, videoWidth: number, videoHeight: number, liftType: PrimaryLift): FrameSample | null {
  const trackedLandmark = liftType === "squat"
    ? midpoint([landmarks[11], landmarks[12]])
    : midpoint([landmarks[15], landmarks[16]]);
  if (!trackedLandmark) {
    return null;
  }
  const bodyChainPixels = median([
    chainLength(landmarks, [11, 23, 25, 27], videoWidth, videoHeight),
    chainLength(landmarks, [12, 24, 26, 28], videoWidth, videoHeight)
  ].filter((value): value is number => value !== null));
  if (!bodyChainPixels || bodyChainPixels < 60) {
    return null;
  }
  const leftAnkle = landmarkPoint(landmarks[27], videoWidth, videoHeight);
  const rightAnkle = landmarkPoint(landmarks[28], videoWidth, videoHeight);
  const leftHip = landmarkPoint(landmarks[23], videoWidth, videoHeight);
  const rightHip = landmarkPoint(landmarks[24], videoWidth, videoHeight);
  const hipLandmark = midpoint([landmarks[23], landmarks[24]]);
  const kneeTravelPercentOfFemur = mean([
    kneeTravelRatio(landmarks, 23, 25, 27, videoWidth, videoHeight),
    kneeTravelRatio(landmarks, 24, 26, 28, videoWidth, videoHeight)
  ].filter((value): value is number => value !== null));
  return {
    time,
    bar: { x: trackedLandmark.x * videoWidth, y: trackedLandmark.y * videoHeight },
    hip: hipLandmark ? { x: hipLandmark.x * videoWidth, y: hipLandmark.y * videoHeight } : null,
    scaleMetresPerPixel: ((athleteHeightCm / 100) * 0.72) / bodyChainPixels,
    stanceWidthPx: leftAnkle && rightAnkle ? Math.abs(leftAnkle.x - rightAnkle.x) : null,
    hipWidthPx: leftHip && rightHip ? Math.abs(leftHip.x - rightHip.x) : null,
    kneeTravelPercentOfFemur
  };
}

function waitForMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    const complete = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error("The selected video could not be read by this browser."));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", complete);
      video.removeEventListener("error", fail);
    };
    video.addEventListener("loadedmetadata", complete, { once: true });
    video.addEventListener("error", fail, { once: true });
  });
}

function seekVideo(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.003) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const complete = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error("The video could not be sampled."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", complete);
      video.removeEventListener("error", fail);
    };
    video.addEventListener("seeked", complete, { once: true });
    video.addEventListener("error", fail, { once: true });
    video.currentTime = time;
  });
}

export async function analyzeLiftVideoFile(file: File, options: LiftVideoAnalysisOptions): Promise<LiftVideoAnalysis> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Choose a video file to analyze.");
  }
  if (file.size > maximumFileSizeBytes) {
    throw new Error("Choose a video smaller than 150 MB for browser-local analysis.");
  }
  if (!Number.isFinite(options.athleteHeightCm) || options.athleteHeightCm < 120 || options.athleteHeightCm > 230) {
    throw new Error("Enter an athlete height between 120 and 230 cm for velocity scaling.");
  }
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = objectUrl;
  try {
    await withTimeout(waitForMetadata(video), metadataTimeoutMs, "The video metadata did not load within 12 seconds. Convert the clip to MP4 (H.264) and try again.");
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > maximumDurationSeconds) {
      throw new Error(`Choose a clip between 1 second and ${maximumDurationSeconds} seconds long.`);
    }
    const library = await loadVisionLibrary();
    const vision = await withTimeout(library.FilesetResolver.forVisionTasks(visionWasmUrl), modelTimeoutMs, "The pose-analysis runtime did not start within 20 seconds. Check your connection and try again.");
    const poseLandmarker = await withTimeout(library.PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: poseModelUrl, delegate: "CPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.55,
      minPosePresenceConfidence: 0.55,
      minTrackingConfidence: 0.5
    }), modelTimeoutMs, "The pose model did not load within 20 seconds. Check your connection and try again.");
    try {
      const totalSamples = Math.min(maximumSamples, Math.max(1, Math.ceil(video.duration * targetSampleRateFps)));
      const sampleIntervalSeconds = video.duration / totalSamples;
      const effectiveSampleRateFps = totalSamples / video.duration;
      const samples: FrameSample[] = [];
      for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex += 1) {
        const time = Math.min(video.duration - 0.001, sampleIndex * sampleIntervalSeconds);
        await withTimeout(seekVideo(video, time), seekTimeoutMs, "The browser stopped while reading the video. Convert the clip to MP4 (H.264), keep it under 20 seconds, and try again.");
        const result = poseLandmarker.detectForVideo(video, time * 1000);
        const sample = frameFromLandmarks(result.landmarks[0] ?? [], time, options.athleteHeightCm, video.videoWidth, video.videoHeight, options.liftType);
        if (sample) {
          samples.push(sample);
        }
        options.onProgress?.(sampleIndex + 1, totalSamples);
        if (sampleIndex % 6 === 5) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        }
      }
      const repMetrics = deriveRepMetrics(samples, options.liftType);
      const meanVelocity = mean(repMetrics.map((metric) => metric.meanVelocityMps));
      const peakVelocity = repMetrics.length ? Math.max(...repMetrics.map((metric) => metric.peakVelocityMps)) : null;
      const firstRepVelocity = repMetrics[0]?.meanVelocityMps;
      const lastRepVelocity = repMetrics.at(-1)?.meanVelocityMps;
      const velocityLoss = firstRepVelocity && lastRepVelocity && repMetrics.length > 1
        ? Math.max(0, ((firstRepVelocity - lastRepVelocity) / firstRepVelocity) * 100)
        : null;
      const profile = liftProfiles[options.liftType];
      const scale = median(samples.map((sample) => sample.scaleMetresPerPixel));
      const repDrifts = repMetrics.flatMap((metric) => metric.horizontalDriftMetres === null ? [] : [metric.horizontalDriftMetres]);
      const barDrift = options.cameraView === "side" ? median(repDrifts) : null;
      const stanceWidths = options.cameraView === "front" && options.liftType !== "bench" && scale
        ? samples.flatMap((sample) => sample.stanceWidthPx === null ? [] : [sample.stanceWidthPx * scale * 100])
        : [];
      const stanceRatios = options.cameraView === "front" && options.liftType !== "bench"
        ? samples.flatMap((sample) => sample.stanceWidthPx === null || !sample.hipWidthPx || sample.hipWidthPx <= 0 ? [] : [(sample.stanceWidthPx / sample.hipWidthPx) * 100])
        : [];
      const kneeTravel = options.cameraView === "side" && options.liftType === "squat"
        ? percentile(samples.flatMap((sample) => sample.kneeTravelPercentOfFemur === null ? [] : [sample.kneeTravelPercentOfFemur]), 0.9)
        : null;
      const velocityEffort = lastRepVelocity === undefined
        ? null
        : clamp((profile.fastVelocityMps - lastRepVelocity) / (profile.fastVelocityMps - profile.limitVelocityMps), 0, 1);
      const confidence = analysisConfidence(samples, totalSamples, repMetrics.length, options.prescribedRepetitions);
      const estimatedRpe = velocityEffort === null || confidence === "low"
        ? null
        : clamp(6 + (velocityEffort * 3.5) + Math.min(0.5, (velocityLoss ?? 0) / 40), 6, 10);
      const trackingDescription = options.liftType === "squat" ? "shoulder line" : "wrist midpoint";
      const notes = [
        `${options.liftType[0].toUpperCase()}${options.liftType.slice(1)} repetitions use a lift-specific ${profile.startsAtTop ? "top-bottom-lockout" : "floor-lockout-reset"} phase model.`,
        `Bar movement is approximated from the detected ${trackingDescription}, not a direct barbell detector.`,
        "Velocity is scaled from entered body height. Use a stable camera with the full body visible for a better estimate.",
        "Estimated RPE is a screening value. Athlete-reported RPE remains the source of truth.",
        options.cameraView === "side" ? "Side view is used for bar-path drift; use a front view for stance width." : "Front view is used for stance width; use a side view for bar-path drift."
      ];
      if (samples.length / totalSamples < 0.72) {
        notes.push("The athlete was not confidently visible for much of the clip. Check framing and lighting before relying on these values.");
      }
      if (!repMetrics.length) {
        notes.push(options.liftType === "deadlift" ? "No complete floor-to-lockout repetition was detected." : "No complete top-to-bottom-to-lockout repetition was detected.");
      }
      if (repMetrics.length > options.prescribedRepetitions) {
        notes.push(`Detected ${repMetrics.length} repetitions for a ${options.prescribedRepetitions}-rep prescription. Treat this result as unreliable and trim out setup or reracking footage.`);
      }
      if (velocityEffort !== null && confidence === "low") {
        notes.push("Estimated RPE was withheld because pose tracking or repetition agreement was not reliable enough.");
      }
      if (options.cameraView === "side" && repMetrics.length && barDrift === null) {
        notes.push("Bar-path drift was hidden because tracking exceeded realistic movement bounds.");
      }
      return {
        version: 1,
        liftType: options.liftType,
        analyzedAt: new Date().toISOString(),
        sourceFileName: file.name,
        cameraView: options.cameraView,
        sampleRateFps: round(effectiveSampleRateFps, 1),
        visibleDurationSeconds: round(video.duration, 1),
        estimatedRepetitions: repMetrics.length,
        meanConcentricVelocityMps: meanVelocity === null ? null : round(meanVelocity),
        peakConcentricVelocityMps: peakVelocity === null ? null : round(peakVelocity),
        concentricRangeCm: repMetrics.length ? round((mean(repMetrics.map((metric) => metric.rangeMetres)) ?? 0) * 100, 1) : null,
        velocityLossPercent: velocityLoss === null ? null : round(velocityLoss, 1),
        barPathHorizontalDriftCm: barDrift === null ? null : round(barDrift * 100, 1),
        stanceWidthCm: median(stanceWidths) === null ? null : round(median(stanceWidths)!, 1),
        stanceWidthPercentOfHipWidth: median(stanceRatios) === null ? null : round(median(stanceRatios)!, 1),
        maxKneeTravelPercentOfFemur: kneeTravel === null ? null : round(kneeTravel, 1),
        estimatedRpe: estimatedRpe === null ? null : round(estimatedRpe, 1),
        confidence,
        notes
      };
    } finally {
      poseLandmarker.close?.();
    }
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}