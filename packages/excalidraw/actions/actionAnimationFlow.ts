import { KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import {
  addElementsToAnimationFlow,
  clearAnimationFlow,
  moveElementInAnimationFlow,
  removeElementFromAnimationFlow,
  updateElementAnimationFlowStep,
  type AnimationFlowStep,
} from "../animation/flow";
import { t } from "../i18n";
import { getSelectedElements } from "../scene";

import { register } from "./register";

import type { ExcalidrawElement } from "@excalidraw/element/types";

export const actionOpenAnimationFlow = register({
  name: "openAnimationFlow",
  label: "labels.animationFlow",
  trackEvent: { category: "menu", action: "openAnimationFlowDialog" },
  perform: (elements, appState) => {
    return {
      appState: {
        ...appState,
        openDialog:
          appState.openDialog?.name === "animationFlow"
            ? null
            : { name: "animationFlow" },
        openMenu: null,
        openPopup: null,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    event.shiftKey &&
    event.key.toLowerCase() === "m",
});

export const actionAddSelectionToAnimationFlow = register({
  name: "addSelectionToAnimationFlow",
  label: "labels.animationFlowAddSelection",
  trackEvent: { category: "element", action: "addSelectionToAnimationFlow" },
  perform: (elements, appState) => {
    const selectedElementIds = getSelectedElements(elements, appState, {
      includeBoundTextElement: true,
    }).map((element) => element.id);

    if (!selectedElementIds.length) {
      return false;
    }

    return {
      elements: addElementsToAnimationFlow(elements, selectedElementIds),
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

export const actionRemoveAnimationFlowStep = register<{
  elementId: ExcalidrawElement["id"];
}>({
  name: "removeAnimationFlowStep",
  label: "labels.animationFlowRemoveStep",
  trackEvent: { category: "element", action: "removeAnimationFlowStep" },
  perform: (elements, appState, value) => {
    if (!value?.elementId) {
      return false;
    }

    return {
      elements: removeElementFromAnimationFlow(elements, value.elementId),
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

export const actionMoveAnimationFlowStep = register<{
  elementId: ExcalidrawElement["id"];
  direction: "up" | "down";
}>({
  name: "moveAnimationFlowStep",
  label: "labels.animationFlowMoveStep",
  trackEvent: { category: "element", action: "moveAnimationFlowStep" },
  perform: (elements, appState, value) => {
    if (!value?.elementId || !value.direction) {
      return false;
    }
    return {
      elements: moveElementInAnimationFlow(
        elements,
        value.elementId,
        value.direction,
      ),
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

export const actionUpdateAnimationFlowStep = register<{
  elementId: ExcalidrawElement["id"];
  updates: Partial<Omit<AnimationFlowStep, "order">>;
}>({
  name: "updateAnimationFlowStep",
  label: "labels.animationFlowUpdateStep",
  trackEvent: { category: "element", action: "updateAnimationFlowStep" },
  perform: (elements, appState, value) => {
    if (!value?.elementId || !value.updates) {
      return false;
    }

    return {
      elements: updateElementAnimationFlowStep(
        elements,
        value.elementId,
        value.updates,
      ),
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});

export const actionClearAnimationFlow = register({
  name: "clearAnimationFlow",
  label: "labels.animationFlowClear",
  trackEvent: { category: "element", action: "clearAnimationFlow" },
  perform: (elements, appState) => {
    return {
      elements: clearAnimationFlow(elements),
      appState: {
        ...appState,
        toast: {
          message: t("toast.animationFlowCleared"),
        },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
});
