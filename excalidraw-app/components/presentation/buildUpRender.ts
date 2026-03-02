import { newElementWith } from "@excalidraw/element";
import { exportToCanvas } from "@excalidraw/utils/export";

import {
  getBuildUpElementsMap,
  getBuildUpStep,
  getBuildUpSteps,
  getBuildUpTransitionForStep,
} from "./buildUpAnimation";

import type { ExcalidrawElement, NonDeleted } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { BuildUpTransition } from "./buildUpAnimation";

export type BuildUpStepTransition = {
  step: number;
  transition: BuildUpTransition;
};

export type BuildUpRenderedSteps = {
  steps: readonly BuildUpStepTransition[];
  canvases: ReadonlyMap<number, HTMLCanvasElement>;
  width: number;
  height: number;
};

const createElementsForStep = (
  elements: readonly NonDeleted<ExcalidrawElement>[],
  step: number,
) => {
  const elementsMap = getBuildUpElementsMap(elements);
  return elements.map((element) => {
    if (getBuildUpStep(element, elementsMap) <= step) {
      return element;
    }
    return newElementWith(element, {
      opacity: 0,
    });
  });
};

export const renderBuildUpStepCanvases = async ({
  elements,
  appState,
  files,
}: {
  elements: readonly NonDeleted<ExcalidrawElement>[];
  appState: AppState;
  files: BinaryFiles;
}): Promise<BuildUpRenderedSteps> => {
  if (!elements.length) {
    throw new Error("Cannot animate an empty scene");
  }

  const steps = getBuildUpSteps(elements).map((step) => ({
    step,
    transition: getBuildUpTransitionForStep(elements, step),
  }));

  const canvases = new Map<number, HTMLCanvasElement>();
  for (const step of steps) {
    const canvas = await exportToCanvas({
      elements: createElementsForStep(elements, step.step),
      appState,
      files,
    });
    canvases.set(step.step, canvas);
  }

  const firstCanvas = canvases.get(steps[0].step);
  if (!firstCanvas) {
    throw new Error("Failed to prepare build-up animation");
  }

  return {
    steps,
    canvases,
    width: firstCanvas.width,
    height: firstCanvas.height,
  };
};

const drawCanvasCover = ({
  targetContext,
  sourceCanvas,
  width,
  height,
  alpha = 1,
  translateX = 0,
}: {
  targetContext: CanvasRenderingContext2D;
  sourceCanvas: HTMLCanvasElement;
  width: number;
  height: number;
  alpha?: number;
  translateX?: number;
}) => {
  targetContext.save();
  targetContext.globalAlpha = alpha;
  targetContext.translate(translateX, 0);
  targetContext.drawImage(sourceCanvas, 0, 0, width, height);
  targetContext.restore();
};

export const renderBuildUpTransitionFrame = ({
  targetContext,
  fromCanvas,
  toCanvas,
  transition,
  progress,
  width,
  height,
}: {
  targetContext: CanvasRenderingContext2D;
  fromCanvas: HTMLCanvasElement;
  toCanvas: HTMLCanvasElement;
  transition: BuildUpTransition;
  progress: number;
  width: number;
  height: number;
}) => {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  targetContext.clearRect(0, 0, width, height);

  if (transition === "cut") {
    drawCanvasCover({
      targetContext,
      sourceCanvas: clampedProgress >= 1 ? toCanvas : fromCanvas,
      width,
      height,
    });
    return;
  }

  if (transition === "slide-left") {
    drawCanvasCover({
      targetContext,
      sourceCanvas: fromCanvas,
      width,
      height,
      translateX: -clampedProgress * width,
    });
    drawCanvasCover({
      targetContext,
      sourceCanvas: toCanvas,
      width,
      height,
      translateX: (1 - clampedProgress) * width,
    });
    return;
  }

  drawCanvasCover({
    targetContext,
    sourceCanvas: fromCanvas,
    width,
    height,
    alpha: 1 - clampedProgress,
  });
  drawCanvasCover({
    targetContext,
    sourceCanvas: toCanvas,
    width,
    height,
    alpha: clampedProgress,
  });
};

export const renderBuildUpStillFrame = ({
  targetContext,
  canvas,
  width,
  height,
}: {
  targetContext: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}) => {
  targetContext.clearRect(0, 0, width, height);
  targetContext.drawImage(canvas, 0, 0, width, height);
};
