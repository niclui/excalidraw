import { rectangleFixture, textFixture } from "@excalidraw/excalidraw/tests/fixtures/elementFixture";

import {
  assignBuildUpStepToSelected,
  assignBuildUpTransitionToStep,
  DEFAULT_BUILD_UP_STEP,
  getBuildUpStep,
  getBuildUpStepStats,
  getBuildUpTransitionForStep,
  parseBuildUpStep,
} from "../components/presentation/buildUpAnimation";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

const createRectangle = (id: string, customData?: Record<string, unknown>) =>
  ({
    ...rectangleFixture,
    id,
    customData,
  }) as ExcalidrawElement;

const createText = ({
  id,
  containerId,
  customData,
}: {
  id: string;
  containerId?: string | null;
  customData?: Record<string, unknown>;
}) =>
  ({
    ...textFixture,
    id,
    containerId: containerId ?? null,
    customData,
  }) as ExcalidrawElement;

describe("buildUpAnimation helpers", () => {
  it("parses and clamps step input", () => {
    expect(parseBuildUpStep("3")).toBe(3);
    expect(parseBuildUpStep("-4")).toBe(0);
    expect(parseBuildUpStep("")).toBe(null);
    expect(parseBuildUpStep("abc")).toBe(null);
  });

  it("returns default step when metadata is absent", () => {
    const element = createRectangle("r-default");
    expect(getBuildUpStep(element)).toBe(DEFAULT_BUILD_UP_STEP);
  });

  it("inherits bound text step from container when text has no explicit step", () => {
    const container = createRectangle("r-step-2", {
      buildUpAnimation: { step: 2 },
    });
    const boundText = createText({
      id: "t-bound",
      containerId: container.id,
    });

    const elements = [container, boundText];
    const map = new Map(elements.map((element) => [element.id, element]));

    expect(getBuildUpStep(boundText, map)).toBe(2);
  });

  it("prefers explicit text step over inherited container step", () => {
    const container = createRectangle("r-step-2", {
      buildUpAnimation: { step: 2 },
    });
    const boundText = createText({
      id: "t-bound",
      containerId: container.id,
      customData: { buildUpAnimation: { step: 1 } },
    });
    const elements = [container, boundText];
    const map = new Map(elements.map((element) => [element.id, element]));

    expect(getBuildUpStep(boundText, map)).toBe(1);
  });

  it("builds sorted step stats and resolves transitions", () => {
    const elements = [
      createRectangle("r-step-0"),
      createRectangle("r-step-1-a", {
        buildUpAnimation: { step: 1, transition: "slide-left" },
      }),
      createRectangle("r-step-1-b", {
        buildUpAnimation: { step: 1, transition: "slide-left" },
      }),
      createRectangle("r-step-2", {
        buildUpAnimation: { step: 2, transition: "cut" },
      }),
    ];

    expect(getBuildUpStepStats(elements)).toEqual([
      { step: 0, elementCount: 1, transition: "fade" },
      { step: 1, elementCount: 2, transition: "slide-left" },
      { step: 2, elementCount: 1, transition: "cut" },
    ]);

    expect(getBuildUpTransitionForStep(elements, 1)).toBe("slide-left");
    expect(getBuildUpTransitionForStep(elements, 999)).toBe("fade");
  });

  it("assigns build-up step to selected elements", () => {
    const elements = [
      createRectangle("r-1"),
      createRectangle("r-2"),
    ] as NonDeletedExcalidrawElement[];

    const nextElements = assignBuildUpStepToSelected(
      elements,
      { "r-2": true },
      4,
    );

    const unchanged = nextElements[0];
    const changed = nextElements[1];

    expect(unchanged.customData?.buildUpAnimation).toBeUndefined();
    expect(changed.customData?.buildUpAnimation).toEqual({ step: 4 });
  });

  it("assigns transition to all elements in a step", () => {
    const elements = [
      createRectangle("r-step-0"),
      createRectangle("r-step-1", {
        buildUpAnimation: { step: 1, transition: "fade" },
      }),
      createText({
        id: "t-step-1",
        customData: { buildUpAnimation: { step: 1 } },
      }),
    ] as NonDeletedExcalidrawElement[];

    const nextElements = assignBuildUpTransitionToStep(elements, 1, "cut");

    expect(nextElements[0].customData?.buildUpAnimation).toBeUndefined();
    expect(nextElements[1].customData?.buildUpAnimation).toEqual({
      step: 1,
      transition: "cut",
    });
    expect(nextElements[2].customData?.buildUpAnimation).toEqual({
      step: 1,
      transition: "cut",
    });
  });
});
