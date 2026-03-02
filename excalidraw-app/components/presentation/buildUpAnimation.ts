import { newElementWith } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

const BUILD_UP_ANIMATION_KEY = "buildUpAnimation";

export const DEFAULT_BUILD_UP_STEP = 0;
export const DEFAULT_BUILD_UP_TRANSITION = "fade" as const;

export const BUILD_UP_TRANSITIONS = ["cut", "fade", "slide-left"] as const;

export type BuildUpTransition = (typeof BUILD_UP_TRANSITIONS)[number];

type BuildUpAnimationData = {
  step?: number;
  transition?: BuildUpTransition;
};

export type BuildUpStepStats = {
  step: number;
  elementCount: number;
  transition: BuildUpTransition;
};

const isBuildUpTransition = (value: unknown): value is BuildUpTransition => {
  return (
    typeof value === "string" &&
    (BUILD_UP_TRANSITIONS as readonly string[]).includes(value)
  );
};

const normalizeStep = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(DEFAULT_BUILD_UP_STEP, Math.trunc(value));
};

const normalizeTransition = (value: unknown): BuildUpTransition | null => {
  return isBuildUpTransition(value) ? value : null;
};

const getRawBuildUpAnimationData = (
  element: Pick<ExcalidrawElement, "customData">,
): BuildUpAnimationData => {
  const data = element.customData?.[BUILD_UP_ANIMATION_KEY];
  if (!data || typeof data !== "object") {
    return {};
  }
  return data as BuildUpAnimationData;
};

export const getBuildUpTransition = (
  element: Pick<ExcalidrawElement, "customData">,
): BuildUpTransition | null => {
  return normalizeTransition(getRawBuildUpAnimationData(element).transition);
};

const getBuildUpStepInternal = (
  element: Pick<
    ExcalidrawElement,
    "id" | "type" | "customData" | "containerId"
  >,
  elementsMap?: ReadonlyMap<string, ExcalidrawElement>,
  visited?: Set<string>,
): number => {
  const ownStep = normalizeStep(getRawBuildUpAnimationData(element).step);
  if (ownStep !== null) {
    return ownStep;
  }

  if (!elementsMap || element.type !== "text" || !element.containerId) {
    return DEFAULT_BUILD_UP_STEP;
  }

  if (visited?.has(element.id)) {
    return DEFAULT_BUILD_UP_STEP;
  }

  const container = elementsMap.get(element.containerId);
  if (!container) {
    return DEFAULT_BUILD_UP_STEP;
  }

  const nextVisited = visited || new Set<string>();
  nextVisited.add(element.id);
  return getBuildUpStepInternal(container, elementsMap, nextVisited);
};

export const getBuildUpStep = (
  element: Pick<
    ExcalidrawElement,
    "id" | "type" | "customData" | "containerId"
  >,
  elementsMap?: ReadonlyMap<string, ExcalidrawElement>,
): number => {
  return getBuildUpStepInternal(element, elementsMap);
};

export const getBuildUpElementsMap = (
  elements: readonly ExcalidrawElement[],
): ReadonlyMap<string, ExcalidrawElement> =>
  new Map(elements.map((element) => [element.id, element]));

const getMostCommonTransition = (
  transitionCount: ReadonlyMap<BuildUpTransition, number>,
): BuildUpTransition => {
  let highestCount = -1;
  let transition: BuildUpTransition = DEFAULT_BUILD_UP_TRANSITION;

  for (const [candidate, count] of transitionCount.entries()) {
    if (count > highestCount) {
      highestCount = count;
      transition = candidate;
    }
  }

  return transition;
};

export const getBuildUpStepStats = (
  elements: readonly ExcalidrawElement[],
): BuildUpStepStats[] => {
  const elementsMap = getBuildUpElementsMap(elements);
  const stepToCount = new Map<number, number>();
  const stepToTransitionCount = new Map<number, Map<BuildUpTransition, number>>();

  for (const element of elements) {
    const step = getBuildUpStep(element, elementsMap);
    stepToCount.set(step, (stepToCount.get(step) || 0) + 1);

    const transition = getBuildUpTransition(element) || DEFAULT_BUILD_UP_TRANSITION;
    const transitionCount =
      stepToTransitionCount.get(step) || new Map<BuildUpTransition, number>();
    transitionCount.set(transition, (transitionCount.get(transition) || 0) + 1);
    stepToTransitionCount.set(step, transitionCount);
  }

  if (!stepToCount.size) {
    return [
      {
        step: DEFAULT_BUILD_UP_STEP,
        elementCount: 0,
        transition: DEFAULT_BUILD_UP_TRANSITION,
      },
    ];
  }

  return [...stepToCount.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, elementCount]) => ({
      step,
      elementCount,
      transition: getMostCommonTransition(
        stepToTransitionCount.get(step) || new Map(),
      ),
    }));
};

export const getBuildUpSteps = (
  elements: readonly ExcalidrawElement[],
): number[] => getBuildUpStepStats(elements).map((item) => item.step);

const withBuildUpAnimationData = <TElement extends ExcalidrawElement>(
  element: TElement,
  data: BuildUpAnimationData,
) => {
  const current = getRawBuildUpAnimationData(element);
  const nextStep = normalizeStep(data.step ?? current.step);
  const nextTransition = normalizeTransition(data.transition ?? current.transition);

  const currentStep = normalizeStep(current.step);
  const currentTransition = normalizeTransition(current.transition);

  if (nextStep === currentStep && nextTransition === currentTransition) {
    return element;
  }

  const nextCustomData = { ...(element.customData || {}) } as Record<string, unknown>;
  const shouldStripBuildUpData =
    nextStep === DEFAULT_BUILD_UP_STEP && nextTransition === null;

  if (shouldStripBuildUpData) {
    delete nextCustomData[BUILD_UP_ANIMATION_KEY];
  } else {
    const nextBuildUpData: BuildUpAnimationData = {};
    if (nextStep !== null) {
      nextBuildUpData.step = nextStep;
    }
    if (nextTransition !== null) {
      nextBuildUpData.transition = nextTransition;
    }
    nextCustomData[BUILD_UP_ANIMATION_KEY] = nextBuildUpData;
  }

  return newElementWith(element, {
    customData:
      Object.keys(nextCustomData).length > 0 ? nextCustomData : undefined,
  });
};

export const assignBuildUpStepToSelected = (
  elements: readonly NonDeletedExcalidrawElement[],
  selectedElementIds: Readonly<Record<string, true>>,
  step: number,
): readonly NonDeletedExcalidrawElement[] => {
  const normalizedStep = Math.max(DEFAULT_BUILD_UP_STEP, Math.trunc(step));

  return elements.map((element) => {
    if (!selectedElementIds[element.id]) {
      return element;
    }
    return withBuildUpAnimationData(element, { step: normalizedStep });
  });
};

export const assignBuildUpTransitionToStep = (
  elements: readonly NonDeletedExcalidrawElement[],
  step: number,
  transition: BuildUpTransition,
): readonly NonDeletedExcalidrawElement[] => {
  const normalizedStep = Math.max(DEFAULT_BUILD_UP_STEP, Math.trunc(step));
  const elementsMap = getBuildUpElementsMap(elements);

  return elements.map((element) => {
    if (getBuildUpStep(element, elementsMap) !== normalizedStep) {
      return element;
    }
    return withBuildUpAnimationData(element, { transition });
  });
};

export const getBuildUpTransitionForStep = (
  elements: readonly ExcalidrawElement[],
  step: number,
): BuildUpTransition => {
  const match = getBuildUpStepStats(elements).find((item) => item.step === step);
  return match?.transition || DEFAULT_BUILD_UP_TRANSITION;
};

export const parseBuildUpStep = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(DEFAULT_BUILD_UP_STEP, parsed);
};
