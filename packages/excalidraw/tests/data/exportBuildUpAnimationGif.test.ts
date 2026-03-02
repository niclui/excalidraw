import { EXPORT_IMAGE_TYPES } from "@excalidraw/common";
import { newElement } from "@excalidraw/element";
import { vi } from "vitest";

import { getDefaultAppState } from "../../appState";
import { BUILD_UP_ANIMATION_STEP_KEY } from "../../buildUpAnimation";
import { exportBuildUpAnimationGif } from "../../data";

import type { AppState } from "../../types";
import type { ExportedElements } from "../../data";

const mocks = vi.hoisted(() => {
  return {
    exportToCanvas: vi.fn(),
    fileSave: vi.fn(),
    canvasesToGifBlob: vi.fn(),
  };
});

vi.mock("../../scene/export", async (importOriginal) => {
  const module = await importOriginal<typeof import("../../scene/export")>();
  return {
    ...module,
    exportToCanvas: mocks.exportToCanvas,
  };
});

vi.mock("../../data/filesystem", async (importOriginal) => {
  const module =
    await importOriginal<typeof import("../../data/filesystem")>();
  return {
    ...module,
    fileSave: mocks.fileSave,
  };
});

vi.mock("../../data/gif", async (importOriginal) => {
  const module = await importOriginal<typeof import("../../data/gif")>();
  return {
    ...module,
    canvasesToGifBlob: mocks.canvasesToGifBlob,
  };
});

describe("exportBuildUpAnimationGif", () => {
  beforeEach(() => {
    mocks.exportToCanvas.mockReset();
    mocks.fileSave.mockReset();
    mocks.canvasesToGifBlob.mockReset();
  });

  it("exports one GIF frame per build-up step", async () => {
    const step0Element = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      opacity: 100,
    });
    const step2Element = newElement({
      type: "rectangle",
      x: 120,
      y: 0,
      width: 100,
      height: 100,
      opacity: 80,
      customData: {
        [BUILD_UP_ANIMATION_STEP_KEY]: 2,
      },
    });

    mocks.exportToCanvas.mockImplementation(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 200;
      return canvas;
    });
    const gifBlob = new Blob(["gif"], { type: "image/gif" });
    mocks.canvasesToGifBlob.mockResolvedValue(gifBlob);
    mocks.fileSave.mockResolvedValue({
      name: "build-up.gif",
    });

    const appState = {
      ...getDefaultAppState(),
      width: 1280,
      height: 720,
      offsetTop: 0,
      offsetLeft: 0,
      name: "build-up-animation",
    } as AppState;

    await exportBuildUpAnimationGif(
      [step0Element, step2Element] as unknown as ExportedElements,
      appState,
      {},
      {
        exportBackground: appState.exportBackground,
        viewBackgroundColor: appState.viewBackgroundColor,
        exportingFrame: null,
      },
    );

    expect(mocks.exportToCanvas).toHaveBeenCalledTimes(3);

    const firstFrameElements = mocks.exportToCanvas.mock.calls[0][0] as typeof step0Element[];
    const lastFrameElements = mocks.exportToCanvas.mock.calls[2][0] as typeof step0Element[];

    const firstFrameStep2 = firstFrameElements.find(
      (element) => element.id === step2Element.id,
    );
    const lastFrameStep2 = lastFrameElements.find(
      (element) => element.id === step2Element.id,
    );

    expect(firstFrameStep2?.opacity).toBe(0);
    expect(lastFrameStep2?.opacity).toBe(step2Element.opacity);

    expect(mocks.canvasesToGifBlob).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ width: 320, height: 200 }),
      ]),
      expect.objectContaining({ frameDelay: 800 }),
    );

    expect(mocks.fileSave).toHaveBeenCalledWith(
      gifBlob,
      expect.objectContaining({
        extension: EXPORT_IMAGE_TYPES.gif,
      }),
    );
  });
});
