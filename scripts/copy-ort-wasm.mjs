import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "node_modules/onnxruntime-web/dist");
const publicDir = join(root, "public");

mkdirSync(publicDir, { recursive: true });

for (const file of ["ort-wasm-simd.wasm", "ort-wasm.wasm"]) {
  copyFileSync(join(dist, file), join(publicDir, file));
}
