import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  allowFullScreen,
  exitFullScreen,
  isFullScreen,
} from "@excalidraw/common";

import {
  chevronLeftIcon,
  chevronRight,
  playerPlayIcon,
  playerStopFilledIcon,
} from "@excalidraw/excalidraw/components/icons";

import { t } from "@excalidraw/excalidraw/i18n";

import {
  renderBuildUpStepCanvases,
  renderBuildUpStillFrame,
  renderBuildUpTransitionFrame,
} from "./buildUpRender";

import "./BuildUpPlayerOverlay.scss";

import type {
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

type BuildUpPlayerOverlayProps = {
  mode: "preview" | "present";
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
  transitionDurationMs: number;
  holdDurationMs: number;
  onClose: () => void;
};

export const BuildUpPlayerOverlay = ({
  mode,
  elements,
  appState,
  files,
  transitionDurationMs,
  holdDurationMs,
  onClose,
}: BuildUpPlayerOverlayProps) => {
  const [isPreparing, setIsPreparing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderedSteps, setRenderedSteps] = useState<Awaited<
    ReturnType<typeof renderBuildUpStepCanvases>
  > | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const timelineRef = useRef({
    mode: "hold" as "hold" | "transition",
    startedAt: 0,
    stepIndex: 0,
  });

  const closeAndStop = useCallback(() => {
    setIsPlaying(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    let isCancelled = false;
    setIsPreparing(true);
    setError(null);
    setRenderedSteps(null);
    setCurrentStepIndex(0);

    renderBuildUpStepCanvases({
      elements,
      appState,
      files,
    })
      .then((data) => {
        if (isCancelled) {
          return;
        }
        setRenderedSteps(data);
      })
      .catch((err: Error) => {
        if (isCancelled) {
          return;
        }
        setError(err.message || t("alerts.cannotExportEmptyCanvas"));
      })
      .finally(() => {
        if (!isCancelled) {
          setIsPreparing(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [elements, appState, files]);

  useEffect(() => {
    if (!renderedSteps || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    canvas.width = renderedSteps.width;
    canvas.height = renderedSteps.height;
  }, [renderedSteps]);

  const drawStillStep = useCallback(
    (stepIndex: number) => {
      if (!renderedSteps || !canvasRef.current) {
        return;
      }
      const step = renderedSteps.steps[stepIndex];
      const frameCanvas = renderedSteps.canvases.get(step.step);
      const context = canvasRef.current.getContext("2d");
      if (!frameCanvas || !context) {
        return;
      }
      renderBuildUpStillFrame({
        targetContext: context,
        canvas: frameCanvas,
        width: renderedSteps.width,
        height: renderedSteps.height,
      });
    },
    [renderedSteps],
  );

  useEffect(() => {
    if (!isPlaying) {
      drawStillStep(currentStepIndex);
    }
  }, [drawStillStep, currentStepIndex, isPlaying]);

  const maxStepIndex = Math.max(0, (renderedSteps?.steps.length || 1) - 1);

  const goToStep = useCallback(
    (nextStepIndex: number) => {
      if (!renderedSteps) {
        return;
      }

      const clamped = Math.max(0, Math.min(maxStepIndex, nextStepIndex));
      timelineRef.current.mode = "hold";
      timelineRef.current.startedAt = performance.now();
      timelineRef.current.stepIndex = clamped;
      setCurrentStepIndex(clamped);
    },
    [maxStepIndex, renderedSteps],
  );

  const goToNextStep = useCallback(() => {
    goToStep(currentStepIndex + 1);
  }, [currentStepIndex, goToStep]);

  const goToPrevStep = useCallback(() => {
    goToStep(currentStepIndex - 1);
  }, [currentStepIndex, goToStep]);

  useEffect(() => {
    if (mode !== "present") {
      return;
    }

    allowFullScreen().catch((error) => {
      console.warn("Failed to enter fullscreen presentation mode", error);
    });

    return () => {
      if (isFullScreen()) {
        exitFullScreen().catch((error) => {
          console.warn("Failed to exit fullscreen presentation mode", error);
        });
      }
    };
  }, [mode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndStop();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNextStep();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPrevStep();
      } else if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeAndStop, goToNextStep, goToPrevStep]);

  useEffect(() => {
    if (!renderedSteps || !canvasRef.current) {
      return;
    }

    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      return;
    }

    timelineRef.current = {
      mode: "hold",
      startedAt: performance.now(),
      stepIndex: currentStepIndex,
    };

    const animate = (time: number) => {
      if (!isPlayingRef.current || !canvasRef.current) {
        return;
      }

      const context = canvasRef.current.getContext("2d");
      if (!context) {
        return;
      }

      const { mode, stepIndex, startedAt } = timelineRef.current;
      const fromStep = renderedSteps.steps[stepIndex];
      const toStep = renderedSteps.steps[stepIndex + 1];
      const fromCanvas = renderedSteps.canvases.get(fromStep.step);

      if (!fromCanvas) {
        setIsPlaying(false);
        return;
      }

      if (!toStep) {
        renderBuildUpStillFrame({
          targetContext: context,
          canvas: fromCanvas,
          width: renderedSteps.width,
          height: renderedSteps.height,
        });

        if (time - startedAt >= holdDurationMs) {
          setIsPlaying(false);
          return;
        }
      } else if (mode === "hold") {
        renderBuildUpStillFrame({
          targetContext: context,
          canvas: fromCanvas,
          width: renderedSteps.width,
          height: renderedSteps.height,
        });

        if (time - startedAt >= holdDurationMs) {
          timelineRef.current.mode = "transition";
          timelineRef.current.startedAt = time;
        }
      } else {
        const toCanvas = renderedSteps.canvases.get(toStep.step);
        if (!toCanvas) {
          setIsPlaying(false);
          return;
        }

        const progress = Math.min(
          1,
          (time - startedAt) / Math.max(1, transitionDurationMs),
        );
        renderBuildUpTransitionFrame({
          targetContext: context,
          fromCanvas,
          toCanvas,
          transition: toStep.transition,
          progress,
          width: renderedSteps.width,
          height: renderedSteps.height,
        });

        if (progress >= 1) {
          const nextStepIndex = Math.min(maxStepIndex, stepIndex + 1);
          timelineRef.current.stepIndex = nextStepIndex;
          timelineRef.current.mode = "hold";
          timelineRef.current.startedAt = time;
          setCurrentStepIndex(nextStepIndex);
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
    };
  }, [
    currentStepIndex,
    holdDurationMs,
    isPlaying,
    maxStepIndex,
    renderedSteps,
    transitionDurationMs,
  ]);

  const headerText = useMemo(
    () =>
      mode === "present"
        ? "Build-Up Present Mode"
        : "Build-Up Animation Preview",
    [mode],
  );

  return (
    <div className="build-up-player-overlay" role="dialog" aria-modal="true">
      <div className="build-up-player-overlay__backdrop" />
      <div className="build-up-player-overlay__content">
        <div className="build-up-player-overlay__header">
          <div className="build-up-player-overlay__title">{headerText}</div>
          <div className="build-up-player-overlay__step">
            Step {currentStepIndex + 1} / {(renderedSteps?.steps.length || 1)}
          </div>
        </div>

        <div className="build-up-player-overlay__canvas-wrapper">
          {isPreparing && (
            <div className="build-up-player-overlay__loading">
              Preparing build-up animation…
            </div>
          )}
          {!isPreparing && error && (
            <div className="build-up-player-overlay__loading">{error}</div>
          )}
          {!isPreparing && !error && <canvas ref={canvasRef} />}
        </div>

        <div className="build-up-player-overlay__controls">
          <button
            type="button"
            onClick={goToPrevStep}
            disabled={currentStepIndex === 0}
            title="Previous step"
          >
            {chevronLeftIcon}
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying((prev) => !prev)}
            disabled={!renderedSteps || renderedSteps.steps.length <= 1}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? playerStopFilledIcon : playerPlayIcon}
          </button>
          <button
            type="button"
            onClick={goToNextStep}
            disabled={currentStepIndex >= maxStepIndex}
            title="Next step"
          >
            {chevronRight}
          </button>
          <button type="button" onClick={closeAndStop} title="Close player">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
