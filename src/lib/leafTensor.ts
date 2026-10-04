const INPUT_SIZE = 224;

/** NCHW float tensor, shape [1, 3, 224, 224], RGB scaled to 0–1. */
export function rgbaToNchw(data: Uint8ClampedArray): Float32Array {
  const plane = INPUT_SIZE * INPUT_SIZE;
  const tensor = new Float32Array(3 * plane);

  for (let index = 0; index < plane; index += 1) {
    const pixel = index * 4;
    tensor[index] = data[pixel] / 255;
    tensor[plane + index] = data[pixel + 1] / 255;
    tensor[plane * 2 + index] = data[pixel + 2] / 255;
  }

  return tensor;
}

/**
 * Capture path: draw the canvas frame down to 224×224, then pack RGB.
 * Runs in the browser only — no filesystem access.
 */
export function preprocessCanvasFrame(source: HTMLCanvasElement): Float32Array {
  const resized = document.createElement("canvas");
  resized.width = INPUT_SIZE;
  resized.height = INPUT_SIZE;
  const context = resized.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Could not read the captured frame.");
  }

  context.drawImage(source, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const { data } = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  return rgbaToNchw(data);
}
