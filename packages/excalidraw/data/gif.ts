import { encode } from "modern-gif";

const normalizeCanvasFrame = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  if (canvas.width === width && canvas.height === height) {
    return canvas;
  }

  const normalizedCanvas = document.createElement("canvas");
  normalizedCanvas.width = width;
  normalizedCanvas.height = height;

  const context = normalizedCanvas.getContext("2d");
  if (!context) {
    throw new Error("Could not initialize GIF frame canvas.");
  }

  context.drawImage(canvas, 0, 0, width, height);

  return normalizedCanvas;
};

export const canvasesToGifBlob = async (
  canvases: readonly HTMLCanvasElement[],
  { frameDelay = 800 }: { frameDelay?: number } = {},
) => {
  if (!canvases.length) {
    throw new Error("Cannot encode an empty GIF.");
  }

  const width = canvases[0].width;
  const height = canvases[0].height;

  return encode({
    format: "blob",
    width,
    height,
    looped: true,
    loopCount: 0,
    frames: canvases.map((canvas) => ({
      data: normalizeCanvasFrame(canvas, width, height),
      delay: frameDelay,
    })),
  });
};
