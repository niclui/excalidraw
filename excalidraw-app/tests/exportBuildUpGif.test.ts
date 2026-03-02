import { exportBuildUpGif } from "../components/presentation/exportBuildUpGif";

import type { AppState } from "@excalidraw/excalidraw/types";

const { writeFrameMock, finishMock, bytesViewMock, fileSaveMock } = vi.hoisted(
  () => ({
    writeFrameMock: vi.fn(),
    finishMock: vi.fn(),
    bytesViewMock: vi.fn(() => new Uint8Array([1, 2, 3, 4])),
    fileSaveMock: vi.fn(async () => null),
  }),
);

vi.mock("gifenc", () => ({
  GIFEncoder: () => ({
    writeFrame: writeFrameMock,
    finish: finishMock,
    bytesView: bytesViewMock,
  }),
  quantize: () => [[0, 0, 0]],
  applyPalette: () => new Uint8Array([0, 0, 0, 0]),
}));

vi.mock("@excalidraw/excalidraw/data/filesystem", () => ({
  fileSave: fileSaveMock,
}));

vi.mock("../components/presentation/buildUpRender", () => ({
  renderBuildUpStepCanvases: async () => {
    const fromCanvas = document.createElement("canvas");
    fromCanvas.width = 8;
    fromCanvas.height = 8;

    const toCanvas = document.createElement("canvas");
    toCanvas.width = 8;
    toCanvas.height = 8;

    return {
      steps: [
        { step: 0, transition: "fade" as const },
        { step: 1, transition: "slide-left" as const },
      ],
      canvases: new Map([
        [0, fromCanvas],
        [1, toCanvas],
      ]),
      width: 8,
      height: 8,
    };
  },
  renderBuildUpStillFrame: ({ targetContext }: { targetContext: CanvasRenderingContext2D }) => {
    targetContext.clearRect(0, 0, 8, 8);
  },
  renderBuildUpTransitionFrame: ({
    targetContext,
  }: {
    targetContext: CanvasRenderingContext2D;
  }) => {
    targetContext.clearRect(0, 0, 8, 8);
  },
}));

describe("exportBuildUpGif", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("encodes frames and saves a GIF file", async () => {
    const onProgress = vi.fn();
    await exportBuildUpGif({
      elements: [] as any,
      appState: { name: "Demo scene" } as AppState,
      files: {},
      holdDurationMs: 500,
      transitionDurationMs: 500,
      fps: 10,
      onProgress,
    });

    expect(writeFrameMock).toHaveBeenCalled();
    expect(finishMock).toHaveBeenCalledTimes(1);
    expect(fileSaveMock).toHaveBeenCalledTimes(1);
    expect(fileSaveMock).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({
        extension: "gif",
        name: "Demo scene-build-up",
      }),
    );
    expect(onProgress).toHaveBeenCalled();
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });
});
