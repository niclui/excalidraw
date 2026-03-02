import { DEFAULT_FILENAME, MIME_TYPES } from "@excalidraw/common";
import { fileSave } from "@excalidraw/excalidraw/data/filesystem";
import { GIFEncoder, applyPalette, quantize } from "gifenc";

import {
  renderBuildUpStepCanvases,
  renderBuildUpStillFrame,
  renderBuildUpTransitionFrame,
} from "./buildUpRender";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

type ExportBuildUpGifOpts = {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
  holdDurationMs: number;
  transitionDurationMs: number;
  fps: number;
  name?: string | null;
  onProgress?: (progress: number) => void;
};

export const exportBuildUpGif = async ({
  elements,
  appState,
  files,
  holdDurationMs,
  transitionDurationMs,
  fps,
  name,
  onProgress,
}: ExportBuildUpGifOpts) => {
  const rendered = await renderBuildUpStepCanvases({
    elements,
    appState,
    files,
  });

  const gif = GIFEncoder();
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = rendered.width;
  tempCanvas.height = rendered.height;
  const context = tempCanvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to initialize GIF renderer");
  }

  const transitionsCount = Math.max(0, rendered.steps.length - 1);
  const transitionFramesPerStep = Math.max(
    1,
    Math.round((transitionDurationMs / 1000) * Math.max(1, fps)),
  );
  const totalFrames = 1 + transitionsCount * transitionFramesPerStep + transitionsCount;
  let renderedFrames = 0;
  const transitionFrameDelay = Math.max(20, Math.round(1000 / Math.max(1, fps)));

  const encodeCurrentCanvas = (delay: number) => {
    const { data } = context.getImageData(0, 0, rendered.width, rendered.height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, rendered.width, rendered.height, {
      palette,
      delay: Math.max(20, Math.round(delay)),
    });
    renderedFrames += 1;
    onProgress?.(Math.min(1, renderedFrames / Math.max(1, totalFrames)));
  };

  const firstStep = rendered.steps[0];
  const firstCanvas = rendered.canvases.get(firstStep.step);
  if (!firstCanvas) {
    throw new Error("Failed to render first animation step");
  }

  renderBuildUpStillFrame({
    targetContext: context,
    canvas: firstCanvas,
    width: rendered.width,
    height: rendered.height,
  });
  encodeCurrentCanvas(holdDurationMs);

  for (let stepIndex = 1; stepIndex < rendered.steps.length; stepIndex++) {
    const fromStep = rendered.steps[stepIndex - 1];
    const toStep = rendered.steps[stepIndex];
    const fromCanvas = rendered.canvases.get(fromStep.step);
    const toCanvas = rendered.canvases.get(toStep.step);
    if (!fromCanvas || !toCanvas) {
      throw new Error("Failed to render build-up transition");
    }

    for (let frame = 1; frame <= transitionFramesPerStep; frame++) {
      renderBuildUpTransitionFrame({
        targetContext: context,
        fromCanvas,
        toCanvas,
        transition: toStep.transition,
        progress: frame / transitionFramesPerStep,
        width: rendered.width,
        height: rendered.height,
      });
      encodeCurrentCanvas(transitionFrameDelay);
    }

    renderBuildUpStillFrame({
      targetContext: context,
      canvas: toCanvas,
      width: rendered.width,
      height: rendered.height,
    });
    encodeCurrentCanvas(holdDurationMs);
  }

  gif.finish();

  const output = gif.bytesView();
  const outputCopy = new Uint8Array(output.length);
  outputCopy.set(output);
  const blob = new Blob([outputCopy], { type: MIME_TYPES.gif });
  await fileSave(blob, {
    description: "Export build-up animation as GIF",
    name: `${name || appState.name || DEFAULT_FILENAME}-build-up`,
    extension: "gif",
    mimeTypes: [MIME_TYPES.gif],
  });
};
