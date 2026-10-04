"use client";

import { useEffect, useRef, useState } from "react";

type Diagnosis = {
  label: string;
  confidence: number;
  disease: boolean;
  elapsedMs: number;
};

type WorkerMessage =
  | { type: "status"; message: string }
  | { type: "result"; scores: Float32Array; elapsedMs: number }
  | { type: "error"; message: string };

function diagnosisFromScores(scores: Float32Array, elapsedMs: number): Diagnosis {
  if (scores.length === 0) {
    throw new Error("The model returned no scores.");
  }

  if (scores.length === 1) {
    const raw = scores[0];
    const probability = raw >= 0 && raw <= 1 ? raw : 1 / (1 + Math.exp(-raw));
    const rust = probability >= 0.5;
    return {
      label: rust ? "Coffee Rust Detected" : "No coffee rust detected",
      confidence: rust ? probability : 1 - probability,
      disease: rust,
      elapsedMs,
    };
  }

  if (scores.length === 2) {
    const max = Math.max(scores[0], scores[1]);
    const exps = [Math.exp(scores[0] - max), Math.exp(scores[1] - max)];
    const rustProbability = exps[1] / (exps[0] + exps[1]);
    const rust = rustProbability >= 0.5;
    return {
      label: rust ? "Coffee Rust Detected" : "No coffee rust detected",
      confidence: rust ? rustProbability : 1 - rustProbability,
      disease: rust,
      elapsedMs,
    };
  }

  let top = 0;
  let max = scores[0];
  for (let index = 1; index < scores.length; index += 1) {
    if (scores[index] > max) {
      max = scores[index];
      top = index;
    }
  }

  const exps = Array.from(scores, (value) => Math.exp(value - max));
  const sum = exps.reduce((total, value) => total + value, 0);

  return {
    label: `On-device class ${top}`,
    confidence: exps[top] / sum,
    disease: false,
    elapsedMs,
  };
}

function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const width = video.videoWidth;
  const height = video.videoHeight;

  if (!width || !height) {
    throw new Error("The camera frame is not ready yet.");
  }

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Could not capture a frame from the camera.");
  }

  context.drawImage(video, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

export default function Scanner({
  onDiseaseDetected,
}: {
  onDiseaseDetected?: (detected: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const busyRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<Diagnosis | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/vision.worker.ts", import.meta.url),
    );
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot open the camera.");
      return;
    }

    let stream: MediaStream | null = null;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      })
      .then(async (next) => {
        stream = next;
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = next;
        await video.play();
        if (!cancelled) {
          setCameraReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError("Allow the camera to scan a leaf on this phone.");
        }
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function analyzeFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const worker = workerRef.current;

    if (!video || !canvas || !worker || busyRef.current) {
      return;
    }

    let image: ImageData;
    try {
      image = captureFrame(video, canvas);
    } catch (error) {
      console.error(error);
      setCameraError("Could not read a frame. Hold the leaf steady and try again.");
      return;
    }

    busyRef.current = true;
    setCameraError(null);
    setStatus("Initializing Neural Engine 🧠");

    const onMessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.type === "status") {
        setStatus(message.message);
        return;
      }

      worker.removeEventListener("message", onMessage);
      busyRef.current = false;

      if (message.type === "error") {
        setStatus(null);
        setCameraError(message.message);
        return;
      }

      console.log(message.scores);
      const diagnosis = diagnosisFromScores(message.scores, message.elapsedMs);
      setResult(diagnosis);
      onDiseaseDetected?.(diagnosis.disease);
      setStatus(null);
    };

    worker.addEventListener("message", onMessage);
    worker.postMessage(image);
  }

  const percent = result ? Math.round(result.confidence * 100) : null;

  return (
    <section aria-label="Leaf scan" className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-3xl bg-stone-950">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="aspect-[3/4] w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        {!cameraReady && (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-base font-medium text-white">
            {cameraError ?? "Starting the rear camera…"}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={analyzeFrame}
        disabled={!cameraReady || status !== null}
        className="h-14 w-full rounded-2xl bg-emerald-950 text-lg font-semibold text-white disabled:opacity-50"
      >
        {status ?? "Snap & Analyze"}
      </button>

      {status ? (
        <p role="status" aria-live="polite" className="text-center text-sm font-semibold text-emerald-950">
          {status}
        </p>
      ) : null}

      {cameraReady && cameraError ? (
        <p role="status" className="text-center text-sm font-medium text-red-800">
          {cameraError}
        </p>
      ) : null}

      {result && percent !== null && !status ? (
        <div className="rounded-2xl bg-stone-950 px-4 py-5 text-center text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
            Diagnosis
          </p>
          <p className="mt-2 text-2xl font-bold leading-tight">{result.label}</p>
          <p className="mt-3 text-5xl font-bold tabular-nums text-amber-300">
            {percent}%
          </p>
          <p className="mt-1 text-sm text-stone-200">
            confidence · {result.elapsedMs} ms on this phone
          </p>
        </div>
      ) : null}
    </section>
  );
}
