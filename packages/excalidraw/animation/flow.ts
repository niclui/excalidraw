import { newElementWith } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

export const ANIMATION_FLOW_KEY = "animationFlow";
export const DEFAULT_ANIMATION_TRANSITION = "fade";
export const DEFAULT_ANIMATION_DURATION_MS = 500;
export const DEFAULT_ANIMATION_HOLD_MS = 700;

export type AnimationTransitionType = "none" | "fade";

export type AnimationFlowStep = {
  order: number;
  transition: AnimationTransitionType;
  durationMs: number;
  holdMs: number;
};

type ElementWithStep = {
  element: ExcalidrawElement;
  step: AnimationFlowStep;
};

const toFinitePositive = (value: unknown, fallback: number) => {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
};

const normalizeStep = (step: unknown): AnimationFlowStep | null => {
  if (!step || typeof step !== "object") {
    return null;
  }

  const _step = step as Partial<AnimationFlowStep>;
  const transition =
    _step.transition === "none" || _step.transition === "fade"
      ? _step.transition
      : DEFAULT_ANIMATION_TRANSITION;

  const order =
    typeof _step.order === "number" && Number.isFinite(_step.order)
      ? Math.max(0, Math.round(_step.order))
      : null;

  if (order == null) {
    return null;
  }

  return {
    order,
    transition,
    durationMs: toFinitePositive(_step.durationMs, DEFAULT_ANIMATION_DURATION_MS),
    holdMs: toFinitePositive(_step.holdMs, DEFAULT_ANIMATION_HOLD_MS),
  };
};

export const getAnimationFlowStep = (
  element: ExcalidrawElement,
): AnimationFlowStep | null => {
  return normalizeStep(
    (element.customData as Record<string, unknown> | undefined)?.[
      ANIMATION_FLOW_KEY
    ],
  );
};

const setAnimationFlowStep = (
  element: ExcalidrawElement,
  step: AnimationFlowStep | null,
) => {
  const customData = { ...(element.customData || {}) };
  if (!step) {
    delete customData[ANIMATION_FLOW_KEY];
  } else {
    customData[ANIMATION_FLOW_KEY] = step;
  }

  const hasCustomData = Object.keys(customData).length > 0;

  return newElementWith(
    element,
    {
      customData: hasCustomData ? customData : undefined,
    },
    !hasCustomData,
  );
};

const getNormalizedFlowEntries = (
  elements: readonly ExcalidrawElement[],
): ElementWithStep[] => {
  return elements
    .map((element) => ({
      element,
      step: getAnimationFlowStep(element),
    }))
    .filter(
      (entry): entry is ElementWithStep =>
        !!entry.step && entry.element.isDeleted === false,
    )
    .sort((a, b) => {
      if (a.step.order !== b.step.order) {
        return a.step.order - b.step.order;
      }
      return 0;
    })
    .map((entry, index) => ({
      ...entry,
      step: { ...entry.step, order: index },
    }));
};

const applyFlowEntries = (
  elements: readonly ExcalidrawElement[],
  entries: readonly ElementWithStep[],
) => {
  const stepById = new Map(entries.map((entry) => [entry.element.id, entry.step]));

  return elements.map((element) => {
    const nextStep = stepById.get(element.id) || null;
    const currentStep = getAnimationFlowStep(element);

    if (!nextStep && !currentStep) {
      return element;
    }

    if (
      nextStep &&
      currentStep &&
      nextStep.order === currentStep.order &&
      nextStep.transition === currentStep.transition &&
      nextStep.durationMs === currentStep.durationMs &&
      nextStep.holdMs === currentStep.holdMs
    ) {
      return element;
    }

    return setAnimationFlowStep(element, nextStep);
  });
};

export const getAnimationFlowElements = (
  elements: readonly ExcalidrawElement[],
) => {
  return getNormalizedFlowEntries(elements);
};

export const addElementsToAnimationFlow = (
  elements: readonly ExcalidrawElement[],
  elementIds: readonly string[],
) => {
  const existing = getNormalizedFlowEntries(elements);
  const existingIds = new Set(existing.map((entry) => entry.element.id));

  if (!elementIds.length) {
    return elements;
  }

  let nextOrder = existing.length;
  const toAppend = elementIds
    .map((id) => elements.find((element) => element.id === id))
    .filter(
      (element): element is ExcalidrawElement =>
        !!element && !element.isDeleted && !existingIds.has(element.id),
    )
    .map((element) => ({
      element,
      step: {
        order: nextOrder++,
        transition: DEFAULT_ANIMATION_TRANSITION as AnimationTransitionType,
        durationMs: DEFAULT_ANIMATION_DURATION_MS,
        holdMs: DEFAULT_ANIMATION_HOLD_MS,
      },
    }));

  if (!toAppend.length) {
    return elements;
  }

  return applyFlowEntries(elements, [...existing, ...toAppend]);
};

export const removeElementFromAnimationFlow = (
  elements: readonly ExcalidrawElement[],
  elementId: ExcalidrawElement["id"],
) => {
  const nextEntries = getNormalizedFlowEntries(elements).filter(
    (entry) => entry.element.id !== elementId,
  );

  return applyFlowEntries(
    elements,
    nextEntries.map((entry, index) => ({
      ...entry,
      step: { ...entry.step, order: index },
    })),
  );
};

export const updateElementAnimationFlowStep = (
  elements: readonly ExcalidrawElement[],
  elementId: ExcalidrawElement["id"],
  updates: Partial<Omit<AnimationFlowStep, "order">>,
) => {
  const nextEntries = getNormalizedFlowEntries(elements).map((entry) => {
    if (entry.element.id !== elementId) {
      return entry;
    }

    const transition =
      updates.transition === "none" || updates.transition === "fade"
        ? updates.transition
        : entry.step.transition;

    return {
      ...entry,
      step: {
        ...entry.step,
        transition,
        durationMs: toFinitePositive(updates.durationMs, entry.step.durationMs),
        holdMs: toFinitePositive(updates.holdMs, entry.step.holdMs),
      },
    };
  });

  return applyFlowEntries(elements, nextEntries);
};

export const moveElementInAnimationFlow = (
  elements: readonly ExcalidrawElement[],
  elementId: ExcalidrawElement["id"],
  direction: "up" | "down",
) => {
  const entries = getNormalizedFlowEntries(elements);
  const index = entries.findIndex((entry) => entry.element.id === elementId);

  if (index < 0) {
    return elements;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= entries.length) {
    return elements;
  }

  const nextEntries = [...entries];
  const [entry] = nextEntries.splice(index, 1);
  nextEntries.splice(targetIndex, 0, entry);

  return applyFlowEntries(
    elements,
    nextEntries.map((item, order) => ({
      ...item,
      step: { ...item.step, order },
    })),
  );
};

export const clearAnimationFlow = (
  elements: readonly ExcalidrawElement[],
) => {
  const hasFlow = elements.some((element) => !!getAnimationFlowStep(element));
  if (!hasFlow) {
    return elements;
  }
  return applyFlowEntries(elements, []);
};
