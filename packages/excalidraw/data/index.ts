import {
  DEFAULT_EXPORT_PADDING,
  DEFAULT_FILENAME,
  IMAGE_MIME_TYPES,
  isFirefox,
  MIME_TYPES,
  cloneJSON,
  SVG_DOCUMENT_PREAMBLE,
} from "@excalidraw/common";

import { getNonDeletedElements } from "@excalidraw/element";

import { isFrameLikeElement } from "@excalidraw/element";

import { getElementsOverlappingFrame } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  getAnimationFlowElements,
  type AnimationFlowStep,
} from "../animation/flow";
import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
} from "../clipboard";

import { t } from "../i18n";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { exportToCanvas, exportToSvg } from "../scene/export";

import { canvasToBlob } from "./blob";
import { fileSave } from "./filesystem";
import { serializeAsJSON } from "./json";

import type { FileSystemHandle } from "./filesystem";

import type { ExportType } from "../scene/types";
import type { AppState, BinaryFiles } from "../types";

export { loadFromBlob } from "./blob";
export { loadFromJSON, saveAsJSON } from "./json";

export type ExportedElements = readonly NonDeletedExcalidrawElement[] & {
  _brand: "exportedElements";
};

const getAnimationGifFrameCount = (
  step: Pick<AnimationFlowStep, "durationMs">,
  fps: number,
) => {
  return Math.max(1, Math.round((step.durationMs / 1000) * fps));
};

const makeAnimationFlowFrameElements = (
  entries: ReturnType<typeof getAnimationFlowElements>,
  currentStepIndex: number,
  currentStepOpacityProgress: number,
) => {
  return entries.map(({ element, step }, index) => {
    if (index < currentStepIndex) {
      return element;
    }

    if (index > currentStepIndex) {
      return {
        ...element,
        opacity: 0,
      };
    }

    if (step.transition === "fade") {
      return {
        ...element,
        opacity: Math.max(
          0,
          Math.round(element.opacity * currentStepOpacityProgress),
        ),
      };
    }

    return element;
  }) as NonDeletedExcalidrawElement[];
};

const exportAnimationFlowToGif = async ({
  elements,
  appState,
  files,
  exportBackground,
  exportPadding,
  viewBackgroundColor,
  name,
  fileHandle,
  exportingFrame,
}: {
  elements: ExportedElements;
  appState: AppState;
  files: BinaryFiles;
  exportBackground: boolean;
  exportPadding: number;
  viewBackgroundColor: string;
  name: string;
  fileHandle?: FileSystemHandle | null;
  exportingFrame: ExcalidrawFrameLikeElement | null;
}) => {
  const flowEntries = getAnimationFlowElements(elements);
  if (!flowEntries.length) {
    throw new Error(t("alerts.animationFlowRequiredForGif"));
  }

  const fps = 12;
  const frames: { canvas: HTMLCanvasElement; delayMs: number }[] = [];

  for (let stepIndex = 0; stepIndex < flowEntries.length; stepIndex++) {
    const currentStep = flowEntries[stepIndex].step;

    if (currentStep.transition === "fade") {
      const transitionFrameCount = getAnimationGifFrameCount(currentStep, fps);
      const frameDelay = Math.max(
        10,
        Math.round(currentStep.durationMs / transitionFrameCount),
      );

      for (
        let transitionIndex = 1;
        transitionIndex <= transitionFrameCount;
        transitionIndex++
      ) {
        const opacityProgress = transitionIndex / transitionFrameCount;
        const frameElements = makeAnimationFlowFrameElements(
          flowEntries,
          stepIndex,
          opacityProgress,
        );

        const canvas = await exportToCanvas(frameElements, appState, files, {
          exportBackground,
          viewBackgroundColor,
          exportPadding,
          exportingFrame,
        });
        frames.push({ canvas, delayMs: frameDelay });
      }
    } else {
      const frameElements = makeAnimationFlowFrameElements(
        flowEntries,
        stepIndex,
        1,
      );
      const canvas = await exportToCanvas(frameElements, appState, files, {
        exportBackground,
        viewBackgroundColor,
        exportPadding,
        exportingFrame,
      });
      frames.push({
        canvas,
        delayMs: Math.max(10, currentStep.durationMs),
      });
    }

    const holdFrameElements = makeAnimationFlowFrameElements(
      flowEntries,
      stepIndex,
      1,
    );

    const holdCanvas = await exportToCanvas(holdFrameElements, appState, files, {
      exportBackground,
      viewBackgroundColor,
      exportPadding,
      exportingFrame,
    });
    frames.push({
      canvas: holdCanvas,
      delayMs: Math.max(10, currentStep.holdMs),
    });
  }

  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const gif = GIFEncoder();

  for (const frame of frames) {
    const width = frame.canvas.width;
    const height = frame.canvas.height;
    const ctx = frame.canvas.getContext("2d");
    if (!ctx) {
      continue;
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const palette = quantize(imageData.data, 256);
    const index = applyPalette(imageData.data, palette);

    gif.writeFrame(index, width, height, {
      palette,
      delay: Math.max(1, Math.round(frame.delayMs / 10)),
    });
  }

  gif.finish();
  const gifBytes = new Uint8Array(gif.bytesView());

  return fileSave(new Blob([gifBytes], { type: IMAGE_MIME_TYPES.gif }), {
    description: "Export to GIF",
    name,
    extension: "gif",
    mimeTypes: [IMAGE_MIME_TYPES.gif],
    fileHandle,
  });
};

export const prepareElementsForExport = (
  elements: readonly ExcalidrawElement[],
  { selectedElementIds }: Pick<AppState, "selectedElementIds">,
  exportSelectionOnly: boolean,
) => {
  elements = getNonDeletedElements(elements);

  const isExportingSelection =
    exportSelectionOnly &&
    isSomeElementSelected(elements, { selectedElementIds });

  let exportingFrame: ExcalidrawFrameLikeElement | null = null;
  let exportedElements = isExportingSelection
    ? getSelectedElements(
        elements,
        { selectedElementIds },
        {
          includeBoundTextElement: true,
        },
      )
    : elements;

  if (isExportingSelection) {
    if (
      exportedElements.length === 1 &&
      isFrameLikeElement(exportedElements[0])
    ) {
      exportingFrame = exportedElements[0];
      exportedElements = getElementsOverlappingFrame(elements, exportingFrame);
    } else if (exportedElements.length > 1) {
      exportedElements = getSelectedElements(
        elements,
        { selectedElementIds },
        {
          includeBoundTextElement: true,
          includeElementsInFrames: true,
        },
      );
    }
  }

  return {
    exportingFrame,
    exportedElements: cloneJSON(exportedElements) as ExportedElements,
  };
};

export const exportCanvas = async (
  type: Omit<ExportType, "backend">,
  elements: ExportedElements,
  appState: AppState,
  files: BinaryFiles,
  {
    exportBackground,
    exportPadding = DEFAULT_EXPORT_PADDING,
    viewBackgroundColor,
    name = appState.name || DEFAULT_FILENAME,
    fileHandle = null,
    exportingFrame = null,
  }: {
    exportBackground: boolean;
    exportPadding?: number;
    viewBackgroundColor: string;
    /** filename, if applicable */
    name?: string;
    fileHandle?: FileSystemHandle | null;
    exportingFrame: ExcalidrawFrameLikeElement | null;
  },
) => {
  if (elements.length === 0) {
    throw new Error(t("alerts.cannotExportEmptyCanvas"));
  }
  if (type === "svg" || type === "clipboard-svg") {
    const svgPromise = exportToSvg(
      elements,
      {
        exportBackground,
        exportWithDarkMode: appState.exportWithDarkMode,
        viewBackgroundColor,
        exportPadding,
        exportScale: appState.exportScale,
        exportEmbedScene: appState.exportEmbedScene && type === "svg",
      },
      files,
      { exportingFrame },
    );

    if (type === "svg") {
      return fileSave(
        svgPromise.then((svg) => {
          // adding SVG preamble so that older software parse the SVG file
          // properly
          return new Blob([SVG_DOCUMENT_PREAMBLE + svg.outerHTML], {
            type: MIME_TYPES.svg,
          });
        }),
        {
          description: "Export to SVG",
          name,
          extension: appState.exportEmbedScene ? "excalidraw.svg" : "svg",
          mimeTypes: [IMAGE_MIME_TYPES.svg],
          fileHandle,
        },
      );
    } else if (type === "clipboard-svg") {
      const svg = await svgPromise.then((svg) => svg.outerHTML);
      try {
        await copyTextToSystemClipboard(svg);
      } catch (e) {
        throw new Error(t("errors.copyToSystemClipboardFailed"));
      }
      return;
    }
  }

  if (type === "gif") {
    return exportAnimationFlowToGif({
      elements,
      appState,
      files,
      exportBackground,
      exportPadding,
      viewBackgroundColor,
      name,
      fileHandle,
      exportingFrame,
    });
  } else if (type === "png") {
    const tempCanvas = exportToCanvas(elements, appState, files, {
      exportBackground,
      viewBackgroundColor,
      exportPadding,
      exportingFrame,
    });
    let blob = canvasToBlob(tempCanvas);

    if (appState.exportEmbedScene) {
      blob = blob.then((blob) =>
        import("./image").then(({ encodePngMetadata }) =>
          encodePngMetadata({
            blob,
            metadata: serializeAsJSON(elements, appState, files, "local"),
          }),
        ),
      );
    }

    return fileSave(blob, {
      description: "Export to PNG",
      name,
      extension: appState.exportEmbedScene ? "excalidraw.png" : "png",
      mimeTypes: [IMAGE_MIME_TYPES.png],
      fileHandle,
    });
  } else if (type === "clipboard") {
    try {
      const tempCanvas = exportToCanvas(elements, appState, files, {
        exportBackground,
        viewBackgroundColor,
        exportPadding,
        exportingFrame,
      });
      const blob = canvasToBlob(tempCanvas);
      await copyBlobToClipboardAsPng(blob);
    } catch (error: any) {
      console.warn(error);
      if (error.name === "CANVAS_POSSIBLY_TOO_BIG") {
        throw new Error(t("canvasError.canvasTooBig"));
      }
      // TypeError *probably* suggests ClipboardItem not defined, which
      // people on Firefox can enable through a flag, so let's tell them.
      if (isFirefox && error.name === "TypeError") {
        throw new Error(
          `${t("alerts.couldNotCopyToClipboard")}\n\n${t(
            "hints.firefox_clipboard_write",
          )}`,
        );
      } else {
        throw new Error(t("alerts.couldNotCopyToClipboard"));
      }
    }
  } else {
    // shouldn't happen
    throw new Error("Unsupported export type");
  }
};
