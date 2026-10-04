import * as ort from "onnxruntime-web";
import { rgbaToNchw } from "../lib/leafTensor";

const MODEL_URL = "/models/coffee_rust_quantized.onnx";
const INPUT_SIZE = 224;

type WorkerResult = {
  type: "result";
  scores: Float32Array;
  elapsedMs: number;
};

type WorkerStatus = {
  type: "status";
  message: string;
};

type WorkerError = {
  type: "error";
  message: string;
};

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function loadSession() {
  ort.env.wasm.wasmPaths = "/";
  ort.env.wasm.numThreads = 1;

  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ["wasm"],
    }).catch((error: unknown) => {
      sessionPromise = null;
      throw error;
    });
  }

  return sessionPromise;
}

async function imageDataToTensor(image: ImageData) {
  const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Could not preprocess the frame in the vision worker.");
  }

  const bitmap = await createImageBitmap(image);
  context.drawImage(bitmap, 0, 0, INPUT_SIZE, INPUT_SIZE);
  bitmap.close();
  const { data } = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  return rgbaToNchw(data);
}

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (event: MessageEvent<ImageData>) => {
  const started = performance.now();

  try {
    scope.postMessage({
      type: "status",
      message: "Initializing Neural Engine 🧠",
    } satisfies WorkerStatus);

    const session = await loadSession();
    const tensor = await imageDataToTensor(event.data);
    console.log(tensor);

    scope.postMessage({
      type: "status",
      message: "Analyzing Tensors 🔬",
    } satisfies WorkerStatus);

    const inputName = session.inputNames[0];
    const output = await session.run({
      [inputName]: new ort.Tensor("float32", tensor, [1, 3, 224, 224]),
    });
    const scores = output[session.outputNames[0]].data as Float32Array;

    scope.postMessage({
      type: "result",
      scores,
      elapsedMs: Math.round(performance.now() - started),
    } satisfies WorkerResult);
  } catch (error) {
    scope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "On-device inference failed.",
    } satisfies WorkerError);
  }
};
