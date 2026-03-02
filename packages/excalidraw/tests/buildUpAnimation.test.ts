import { newElement } from "@excalidraw/element";

import {
  BUILD_UP_ANIMATION_STEP_KEY,
  getBuildUpAnimationCustomData,
  getBuildUpAnimationElementsForStep,
  getBuildUpAnimationStep,
  getMaxBuildUpAnimationStep,
  normalizeBuildUpAnimationStep,
} from "../buildUpAnimation";

describe("build-up animation helpers", () => {
  it("normalizes invalid or non-integer step values", () => {
    expect(normalizeBuildUpAnimationStep(undefined)).toBe(0);
    expect(normalizeBuildUpAnimationStep(-2)).toBe(0);
    expect(normalizeBuildUpAnimationStep(2.8)).toBe(2);
    expect(normalizeBuildUpAnimationStep("3")).toBe(3);
    expect(normalizeBuildUpAnimationStep("invalid", 2)).toBe(2);
  });

  it("reads build step from customData with default 0", () => {
    const withoutStep = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
    });
    const withStep = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      customData: { [BUILD_UP_ANIMATION_STEP_KEY]: 4 },
    });
    const withInvalidStep = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      customData: { [BUILD_UP_ANIMATION_STEP_KEY]: -10 },
    });

    expect(getBuildUpAnimationStep(withoutStep)).toBe(0);
    expect(getBuildUpAnimationStep(withStep)).toBe(4);
    expect(getBuildUpAnimationStep(withInvalidStep)).toBe(0);
  });

  it("merges and removes build step key in customData safely", () => {
    const element = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      customData: { foo: "bar", [BUILD_UP_ANIMATION_STEP_KEY]: 1 },
    });

    expect(getBuildUpAnimationCustomData(element, 3)).toEqual({
      foo: "bar",
      [BUILD_UP_ANIMATION_STEP_KEY]: 3,
    });
    expect(getBuildUpAnimationCustomData(element, 0)).toEqual({
      foo: "bar",
    });

    const onlyBuildStep = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      customData: { [BUILD_UP_ANIMATION_STEP_KEY]: 2 },
    });
    expect(getBuildUpAnimationCustomData(onlyBuildStep, 0)).toBeUndefined();
  });

  it("computes max build step from elements", () => {
    const elements = [
      newElement({
        type: "rectangle",
        x: 0,
        y: 0,
      }),
      newElement({
        type: "rectangle",
        x: 0,
        y: 0,
        customData: { [BUILD_UP_ANIMATION_STEP_KEY]: 2 },
      }),
      newElement({
        type: "rectangle",
        x: 0,
        y: 0,
        customData: { [BUILD_UP_ANIMATION_STEP_KEY]: 4 },
      }),
    ];

    expect(getMaxBuildUpAnimationStep(elements)).toBe(4);
  });

  it("hides future-step elements by forcing opacity to 0", () => {
    const step0 = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      opacity: 80,
      customData: { [BUILD_UP_ANIMATION_STEP_KEY]: 0 },
    });
    const step2 = newElement({
      type: "rectangle",
      x: 0,
      y: 0,
      opacity: 70,
      customData: { [BUILD_UP_ANIMATION_STEP_KEY]: 2 },
    });

    const step1Frame = getBuildUpAnimationElementsForStep([step0, step2], 1);

    expect(step1Frame[0]).toBe(step0);
    expect(step1Frame[1]).not.toBe(step2);
    expect(step1Frame[1].opacity).toBe(0);

    const step2Frame = getBuildUpAnimationElementsForStep([step0, step2], 2);
    expect(step2Frame[1]).toBe(step2);
  });
});
