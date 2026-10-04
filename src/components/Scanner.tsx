"use client";

import { useEffect, useRef, useState } from "react";
import { preprocessCanvasFrame } from "@/lib/leafTensor";

const MODEL_URL = "/models/coffee_rust_quantized.onnx";

type Diagnosis = {
  label: string;
  confidence: number;
  mocked: boolean;
};

type OrtModule = typeof import("onnxruntime-web");

let sessionPromise: Promise<import("onnxruntime-web").InferenceSession> | null =
  null;

function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Float32Array {
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
  return preprocessCanvasFrame(canvas);
}

async function runOnnx(tensor: Float32Array): Promise<Diagnosis> {
  const ort: OrtModule = await import("onnxruntime-web");
  ort.env.wasm.wasmPaths = "/";
  // Threaded WASM needs cross-origin isolation, which a normal phone tab does not have.
  ort.env.wasm.numThreads = 1;

  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
    }).catch((error: unknown) => {
      sessionPromise = null;
      throw error;
    });
  }

  const session = await sessionPromise;
  const inputName = session.inputNames[0];
  const output = await session.run({
    [inputName]: new ort.Tensor("float32", tensor, [1, 3, 224, 224]),
  });
  const scores = output[session.outputNames[0]].data as Float32Array;

  return diagnosisFromScores(scores);
}

function diagnosisFromScores(scores: Float32Array): Diagnosis {
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
      mocked: false,
    };
  }

  const max = Math.max(...scores);
  const exps = Array.from(scores, (value) => Math.exp(value - max));
  const sum = exps.reduce((total, value) => total + value, 0);
  const rustProbability = exps[1] / sum;
  const rust = rustProbability >= 0.5;

  return {
    label: rust ? "Coffee Rust Detected" : "No coffee rust detected",
    confidence: rust ? rustProbability : 1 - rustProbability,
    mocked: false,
  };
}

async function mockDiagnosis(): Promise<Diagnosis> {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 1500);
  });

  return {
    label: "Coffee Rust Detected",
    confidence: 0.89,
    mocked: true,
  };
}

export default function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<Diagnosis | null>(null);

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

  async function analyzeFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || analyzing) {
      return;
    }

    setAnalyzing(true);

    try {
      const tensor = captureFrame(video, canvas);
      console.log(tensor);

      try {
        setResult(await runOnnx(tensor));
      } catch (error) {
        console.warn(
          "ONNX model unavailable, using the offline demo result.",
          error,
        );
        setResult(await mockDiagnosis());
      }
    } catch (error) {
      console.error(error);
      setCameraError("Could not read a frame. Hold the leaf steady and try again.");
    } finally {
      setAnalyzing(false);
    }
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
        onClick={() => {
          void analyzeFrame();
        }}
        disabled={!cameraReady || analyzing}
        className="h-14 w-full rounded-2xl bg-emerald-950 text-lg font-semibold text-white disabled:opacity-50"
      >
        {analyzing ? "Analyzing on this phone…" : "Snap & Analyze"}
      </button>

      {result && percent !== null && (
        <div className="rounded-2xl bg-stone-950 px-4 py-5 text-center text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
            Diagnosis
          </p>
          <p className="mt-2 text-2xl font-bold leading-tight">{result.label}</p>
          <p className="mt-3 text-5xl font-bold tabular-nums text-amber-300">
            {percent}%
          </p>
          <p className="mt-1 text-sm text-stone-200">confidence</p>
          {result.mocked && (
            <p className="mt-3 text-sm leading-relaxed text-amber-100">
              Demo result. The on-device model file is not on this phone yet.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
