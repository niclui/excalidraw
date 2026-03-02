import React from "react";

import { getNonDeletedElements } from "@excalidraw/element";

import {
  actionAddSelectionToAnimationFlow,
  actionClearAnimationFlow,
  actionMoveAnimationFlowStep,
  actionRemoveAnimationFlowStep,
  actionUpdateAnimationFlowStep,
} from "../actions/actionAnimationFlow";
import { getAnimationFlowElements } from "../animation/flow";
import { t } from "../i18n";

import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";

import "./AnimationFlowDialog.scss";

import type { ActionManager } from "../actions/manager";
import type {
  AnimationTransitionType,
  AnimationFlowStep,
} from "../animation/flow";
import type {
  AppClassProperties,
  UIAppState,
} from "../types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

const STEP_TRANSITIONS: { value: AnimationTransitionType; label: string }[] = [
  { value: "fade", label: t("labels.animationFlowTransitionFade") },
  { value: "none", label: t("labels.animationFlowTransitionNone") },
];

const FlowStepRow = ({
  index,
  total,
  element,
  step,
  actionManager,
}: {
  index: number;
  total: number;
  element: ExcalidrawElement;
  step: AnimationFlowStep;
  actionManager: ActionManager;
}) => {
  return (
    <div className="AnimationFlowDialog__row">
      <div className="AnimationFlowDialog__step-label">
        <strong>{index + 1}.</strong>{" "}
        {`${t(`element.${element.type}` as any, undefined, element.type)} (${element.id.slice(0, 6)})`}
      </div>

      <div className="AnimationFlowDialog__step-settings">
        <label>
          {t("labels.animationFlowTransition")}
          <select
            value={step.transition}
            onChange={(event) =>
              actionManager.executeAction(actionUpdateAnimationFlowStep, "ui", {
                elementId: element.id,
                updates: {
                  transition: event.target.value as AnimationTransitionType,
                },
              })
            }
          >
            {STEP_TRANSITIONS.map((transition) => (
              <option value={transition.value} key={transition.value}>
                {transition.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("labels.animationFlowDuration")}
          <input
            type="number"
            min={100}
            step={50}
            value={step.durationMs}
            onChange={(event) =>
              actionManager.executeAction(actionUpdateAnimationFlowStep, "ui", {
                elementId: element.id,
                updates: {
                  durationMs: event.target.valueAsNumber,
                },
              })
            }
          />
        </label>

        <label>
          {t("labels.animationFlowHold")}
          <input
            type="number"
            min={100}
            step={50}
            value={step.holdMs}
            onChange={(event) =>
              actionManager.executeAction(actionUpdateAnimationFlowStep, "ui", {
                elementId: element.id,
                updates: {
                  holdMs: event.target.valueAsNumber,
                },
              })
            }
          />
        </label>
      </div>

      <div className="AnimationFlowDialog__row-actions">
        <button
          type="button"
          disabled={index === 0}
          onClick={() =>
            actionManager.executeAction(actionMoveAnimationFlowStep, "ui", {
              elementId: element.id,
              direction: "up",
            })
          }
        >
          ↑
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() =>
            actionManager.executeAction(actionMoveAnimationFlowStep, "ui", {
              elementId: element.id,
              direction: "down",
            })
          }
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() =>
            actionManager.executeAction(actionRemoveAnimationFlowStep, "ui", {
              elementId: element.id,
            })
          }
        >
          {t("buttons.remove")}
        </button>
      </div>
    </div>
  );
};

export const AnimationFlowDialog = ({
  elements,
  appState,
  actionManager,
  app,
  onCloseRequest,
}: {
  elements: readonly ExcalidrawElement[];
  appState: UIAppState;
  actionManager: ActionManager;
  app: AppClassProperties;
  onCloseRequest: () => void;
}) => {
  const nonDeletedElements = getNonDeletedElements(elements);
  const flowEntries = getAnimationFlowElements(nonDeletedElements);
  const selectedElements = Object.keys(appState.selectedElementIds).length;

  return (
    <Dialog
      size="wide"
      title={t("labels.animationFlow")}
      onCloseRequest={onCloseRequest}
    >
      <div className="AnimationFlowDialog">
        <div className="AnimationFlowDialog__top-actions">
          <FilledButton
            label={t("labels.animationFlowAddSelection")}
            icon={null}
            disabled={!selectedElements}
            onClick={() =>
              actionManager.executeAction(actionAddSelectionToAnimationFlow, "ui")
            }
          >
            {t("labels.animationFlowAddSelection")}
          </FilledButton>
          <button
            type="button"
            disabled={flowEntries.length === 0}
            onClick={() => actionManager.executeAction(actionClearAnimationFlow)}
          >
            {t("labels.animationFlowClear")}
          </button>
        </div>

        {flowEntries.length > 0 ? (
          <div className="AnimationFlowDialog__steps">
            {flowEntries.map(({ element, step }, index) => (
              <FlowStepRow
                key={element.id}
                index={index}
                total={flowEntries.length}
                element={element}
                step={step}
                actionManager={actionManager}
              />
            ))}
          </div>
        ) : (
          <div className="AnimationFlowDialog__empty">
            {t("labels.animationFlowEmpty")}
          </div>
        )}

        <div className="AnimationFlowDialog__bottom-actions">
          <FilledButton
            label={t("labels.animationFlowPresent")}
            icon={null}
            disabled={flowEntries.length === 0}
            onClick={() => {
              app.startAnimationPresentation?.();
              onCloseRequest();
            }}
          >
            {t("labels.animationFlowPresent")}
          </FilledButton>
        </div>
      </div>
    </Dialog>
  );
};
