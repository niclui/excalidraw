import { useEffect, useMemo, useState } from "react";

import {
  CaptureUpdateAction,
  DefaultSidebar,
  Sidebar,
  THEME,
} from "@excalidraw/excalidraw";
import {
  messageCircleIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { LinkButton } from "@excalidraw/excalidraw/components/LinkButton";
import { useExcalidrawElements } from "@excalidraw/excalidraw/components/App";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

import { BuildUpPlayerOverlay } from "./presentation/BuildUpPlayerOverlay";
import {
  BUILD_UP_TRANSITIONS,
  assignBuildUpStepToSelected,
  assignBuildUpTransitionToStep,
  getBuildUpStep,
  getBuildUpStepStats,
  parseBuildUpStep,
} from "./presentation/buildUpAnimation";
import { exportBuildUpGif } from "./presentation/exportBuildUpGif";

import "./AppSidebar.scss";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

const BuildUpPresentationTab = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const appState = useUIAppState();
  const elements = useExcalidrawElements();

  const [stepInput, setStepInput] = useState("0");
  const [holdDurationMs, setHoldDurationMs] = useState(900);
  const [transitionDurationMs, setTransitionDurationMs] = useState(500);
  const [gifFps, setGifFps] = useState(12);
  const [gifProgress, setGifProgress] = useState<number | null>(null);
  const [isExportingGif, setIsExportingGif] = useState(false);
  const [playerSession, setPlayerSession] = useState<{
    mode: "preview" | "present";
    elements: readonly NonDeletedExcalidrawElement[];
    appState: AppState;
    files: BinaryFiles;
  } | null>(null);

  const selectedElements = useMemo(
    () =>
      elements.filter((element) => !!appState.selectedElementIds[element.id]),
    [appState.selectedElementIds, elements],
  );

  const selectedStep = useMemo(() => {
    if (!selectedElements.length) {
      return null;
    }
    const elementsMap = new Map(elements.map((element) => [element.id, element]));
    const firstStep = getBuildUpStep(selectedElements[0], elementsMap);
    return selectedElements.every(
      (element) => getBuildUpStep(element, elementsMap) === firstStep,
    )
      ? firstStep
      : null;
  }, [elements, selectedElements]);

  useEffect(() => {
    if (selectedStep !== null) {
      setStepInput(String(selectedStep));
    } else if (!selectedElements.length) {
      setStepInput("0");
    }
  }, [selectedElements.length, selectedStep]);

  const stepStats = useMemo(() => getBuildUpStepStats(elements), [elements]);

  const applyStepToSelection = () => {
    if (!excalidrawAPI || !selectedElements.length) {
      return;
    }

    const step = parseBuildUpStep(stepInput);
    if (step === null) {
      return;
    }

    const nextElements = assignBuildUpStepToSelected(
      elements,
      appState.selectedElementIds,
      step,
    );
    excalidrawAPI.updateScene({
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const applyTransitionForStep = (
    step: number,
    transition: (typeof BUILD_UP_TRANSITIONS)[number],
  ) => {
    if (!excalidrawAPI) {
      return;
    }

    const nextElements = assignBuildUpTransitionToStep(elements, step, transition);
    excalidrawAPI.updateScene({
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const openPlayer = (mode: "preview" | "present") => {
    if (!excalidrawAPI || !elements.length) {
      return;
    }
    setPlayerSession({
      mode,
      elements: excalidrawAPI.getSceneElements(),
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
    });
  };

  const onExportGif = async () => {
    if (!excalidrawAPI || !elements.length) {
      return;
    }
    setIsExportingGif(true);
    setGifProgress(0);

    try {
      await exportBuildUpGif({
        elements: excalidrawAPI.getSceneElements(),
        appState: excalidrawAPI.getAppState(),
        files: excalidrawAPI.getFiles(),
        holdDurationMs,
        transitionDurationMs,
        fps: gifFps,
        name: excalidrawAPI.getName(),
        onProgress: setGifProgress,
      });
      excalidrawAPI.setToast({
        message: "Build-up animation exported as GIF",
      });
    } catch (error: any) {
      excalidrawAPI.setToast({
        message: error?.message || "Failed to export GIF",
      });
    } finally {
      setIsExportingGif(false);
      setGifProgress(null);
    }
  };

  return (
    <div className="build-up-sidebar">
      <h3>Build-Up Animation</h3>
      <p className="build-up-sidebar__hint">
        Assign selected elements to numbered reveal steps.
      </p>
      <div className="build-up-sidebar__row">
        <label htmlFor="build-up-step-input">Selected step</label>
        <div className="build-up-sidebar__inline-controls">
          <input
            id="build-up-step-input"
            type="number"
            min={0}
            step={1}
            value={stepInput}
            onChange={(event) => setStepInput(event.target.value)}
            disabled={!selectedElements.length}
          />
          <button
            type="button"
            disabled={!selectedElements.length}
            onClick={applyStepToSelection}
          >
            Assign ({selectedElements.length})
          </button>
        </div>
      </div>

      <div className="build-up-sidebar__steps">
        <h4>Steps</h4>
        {stepStats.map((stepStat) => (
          <div key={stepStat.step} className="build-up-sidebar__step-row">
            <div className="build-up-sidebar__step-meta">
              <strong>Step {stepStat.step}</strong>
              <span>{stepStat.elementCount} elements</span>
            </div>
            {stepStat.step > 0 ? (
              <select
                value={stepStat.transition}
                onChange={(event) =>
                  applyTransitionForStep(
                    stepStat.step,
                    event.target.value as (typeof BUILD_UP_TRANSITIONS)[number],
                  )
                }
              >
                {BUILD_UP_TRANSITIONS.map((transition) => (
                  <option key={transition} value={transition}>
                    {transition}
                  </option>
                ))}
              </select>
            ) : (
              <span className="build-up-sidebar__step-background">Background</span>
            )}
          </div>
        ))}
      </div>

      <div className="build-up-sidebar__settings">
        <h4>Playback</h4>
        <label>
          Hold per step (ms)
          <input
            type="number"
            min={100}
            step={50}
            value={holdDurationMs}
            onChange={(event) =>
              setHoldDurationMs(Math.max(100, Number(event.target.value) || 0))
            }
          />
        </label>
        <label>
          Transition duration (ms)
          <input
            type="number"
            min={100}
            step={50}
            value={transitionDurationMs}
            onChange={(event) =>
              setTransitionDurationMs(
                Math.max(100, Number(event.target.value) || 0),
              )
            }
          />
        </label>
        <label>
          GIF FPS
          <input
            type="number"
            min={1}
            max={30}
            step={1}
            value={gifFps}
            onChange={(event) =>
              setGifFps(Math.max(1, Math.min(30, Number(event.target.value) || 1)))
            }
          />
        </label>
      </div>

      <div className="build-up-sidebar__actions">
        <button
          type="button"
          disabled={!elements.length}
          onClick={() => openPlayer("preview")}
        >
          Preview
        </button>
        <button
          type="button"
          disabled={!elements.length}
          onClick={() => openPlayer("present")}
        >
          Present
        </button>
        <button
          type="button"
          disabled={!elements.length || isExportingGif}
          onClick={onExportGif}
        >
          {isExportingGif
            ? `Exporting GIF${
                gifProgress !== null ? ` (${Math.round(gifProgress * 100)}%)` : ""
              }…`
            : "Export GIF"}
        </button>
      </div>

      {playerSession && (
        <BuildUpPlayerOverlay
          mode={playerSession.mode}
          elements={playerSession.elements}
          appState={playerSession.appState}
          files={playerSession.files}
          holdDurationMs={holdDurationMs}
          transitionDurationMs={transitionDurationMs}
          onClose={() => setPlayerSession(null)}
        />
      )}
    </div>
  );
};

export const AppSidebar = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}) => {
  const { theme, openSidebar } = useUIAppState();

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger
          tab="comments"
          style={{ opacity: openSidebar?.tab === "comments" ? 1 : 0.4 }}
        >
          {messageCircleIcon}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger
          tab="presentation"
          style={{ opacity: openSidebar?.tab === "presentation" ? 1 : 0.4 }}
        >
          {presentationIcon}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab="comments">
        <div className="app-sidebar-promo-container">
          <div
            className="app-sidebar-promo-image"
            style={{
              ["--image-source" as any]: `url(/oss_promo_comments_${
                theme === THEME.DARK ? "dark" : "light"
              }.jpg)`,
              opacity: 0.7,
            }}
          />
          <div className="app-sidebar-promo-text">
            Make comments with Excalidraw+
          </div>
          <LinkButton
            href={`${
              import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=comments_promo#excalidraw-redirect`}
          >
            Sign up now
          </LinkButton>
        </div>
      </Sidebar.Tab>
      <Sidebar.Tab tab="presentation" className="px-3">
        <BuildUpPresentationTab excalidrawAPI={excalidrawAPI} />
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
