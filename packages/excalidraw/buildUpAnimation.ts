import { newElementWith } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

export const BUILD_UP_ANIMATION_STEP_KEY = "buildUpAnimationStep";

const DEFAULT_BUILD_UP_ANIMATION_STEP = 0;

export const normalizeBuildUpAnimationStep = (
  value: unknown,
  fallbackStep = DEFAULT_BUILD_UP_ANIMATION_STEP,
) => {
  const normalizedFallbackStep = Math.max(0, Math.trunc(fallbackStep));
  const step = Number(value);

  if (!Number.isFinite(step)) {
    return normalizedFallbackStep;
  }

  return Math.max(0, Math.trunc(step));
};

export const getBuildUpAnimationStep = (
  element: Pick<ExcalidrawElement, "customData">,
) => {
  return normalizeBuildUpAnimationStep(
    element.customData?.[BUILD_UP_ANIMATION_STEP_KEY],
  );
};

export const getBuildUpAnimationCustomData = (
  element: Pick<ExcalidrawElement, "customData">,
  step: unknown,
): ExcalidrawElement["customData"] => {
  const normalizedStep = normalizeBuildUpAnimationStep(step);
  const currentStep = getBuildUpAnimationStep(element);

  if (currentStep === normalizedStep) {
    return element.customData;
  }

  if (normalizedStep === DEFAULT_BUILD_UP_ANIMATION_STEP) {
    if (!element.customData?.[BUILD_UP_ANIMATION_STEP_KEY]) {
      return element.customData;
    }

    const { [BUILD_UP_ANIMATION_STEP_KEY]: _ignored, ...customData } =
      element.customData;

    return Object.keys(customData).length ? customData : undefined;
  }

  return {
    ...(element.customData || {}),
    [BUILD_UP_ANIMATION_STEP_KEY]: normalizedStep,
  };
};

export const getMaxBuildUpAnimationStep = (
  elements: readonly Pick<ExcalidrawElement, "customData">[],
) => {
  return elements.reduce((maxStep, element) => {
    return Math.max(maxStep, getBuildUpAnimationStep(element));
  }, DEFAULT_BUILD_UP_ANIMATION_STEP);
};

export const getBuildUpAnimationElementsForStep = <
  TElement extends ExcalidrawElement & { opacity: number },
>(
  elements: readonly TElement[],
  step: number,
) => {
  const normalizedStep = normalizeBuildUpAnimationStep(step);

  return elements.map((element) => {
    const shouldHide = getBuildUpAnimationStep(element) > normalizedStep;

    if (shouldHide && element.opacity !== 0) {
      return newElementWith(element, { opacity: 0 } as any);
    }

    return element;
  });
};
