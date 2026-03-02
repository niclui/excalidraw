import { exportToCanvas } from "@excalidraw/utils/export";
import React, { useEffect, useRef, useState } from "react";

import {
  DEFAULT_EXPORT_PADDING,
  EXPORT_IMAGE_TYPES,
  isFirefox,
  EXPORT_SCALES,
  cloneJSON,
} from "@excalidraw/common";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import {
  actionExportWithDarkMode,
  actionChangeExportBackground,
  actionChangeExportEmbedScene,
  actionChangeExportScale,
  actionChangeProjectName,
} from "../actions/actionExport";
import {
  getBuildUpAnimationElementsForStep,
  getMaxBuildUpAnimationStep,
} from "../buildUpAnimation";
import { probablySupportsClipboardBlob } from "../clipboard";
import { prepareElementsForExport } from "../data";
import { canvasToBlob } from "../data/blob";
import { nativeFileSystemSupported } from "../data/filesystem";
import { useCopyStatus } from "../hooks/useCopiedIndicator";

import { t } from "../i18n";
import { isSomeElementSelected } from "../scene";

import {
  copyIcon,
  downloadIcon,
  helpIcon,
  playerPlayIcon,
  playerStopFilledIcon,
} from "./icons";
import { Dialog } from "./Dialog";
import { RadioGroup } from "./RadioGroup";
import { Switch } from "./Switch";
import { Tooltip } from "./Tooltip";
import { FilledButton } from "./FilledButton";

import "./ImageExportDialog.scss";

import type { ActionManager } from "../actions/manager";

import type { AppClassProperties, BinaryFiles, UIAppState } from "../types";

export const ErrorCanvasPreview = () => {
  return (
    <div>
      <h3>{t("canvasError.cannotShowPreview")}</h3>
      <p>
        <span>{t("canvasError.canvasTooBig")}</span>
      </p>
      <em>({t("canvasError.canvasTooBigTip")})</em>
    </div>
  );
};

type ImageExportModalProps = {
  appStateSnapshot: Readonly<UIAppState>;
  elementsSnapshot: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  actionManager: ActionManager;
  onExportImage: AppClassProperties["onExportImage"];
  name: string;
};

const ImageExportModal = ({
  appStateSnapshot,
  elementsSnapshot,
  files,
  actionManager,
  onExportImage,
  name,
}: ImageExportModalProps) => {
  const hasSelection = isSomeElementSelected(
    elementsSnapshot,
    appStateSnapshot,
  );

  const [projectName, setProjectName] = useState(name);
  const [exportSelectionOnly, setExportSelectionOnly] = useState(hasSelection);
  const [exportWithBackground, setExportWithBackground] = useState(
    appStateSnapshot.exportBackground,
  );
  const [exportDarkMode, setExportDarkMode] = useState(
    appStateSnapshot.exportWithDarkMode,
  );
  const [embedScene, setEmbedScene] = useState(
    appStateSnapshot.exportEmbedScene,
  );
  const [exportScale, setExportScale] = useState(appStateSnapshot.exportScale);

  const previewRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<Error | null>(null);

  const { onCopy, copyStatus, resetCopyStatus } = useCopyStatus();

  useEffect(() => {
    // if user changes setting right after export to clipboard, reset the status
    // so they don't have to wait for the timeout to click the button again
    resetCopyStatus();
  }, [
    projectName,
    exportWithBackground,
    exportDarkMode,
    exportScale,
    embedScene,
    resetCopyStatus,
  ]);

  const { exportedElements, exportingFrame } = prepareElementsForExport(
    elementsSnapshot,
    appStateSnapshot,
    exportSelectionOnly,
  );
  const maxBuildUpStep = getMaxBuildUpAnimationStep(exportedElements);
  const hasBuildUpAnimation = maxBuildUpStep > 0;
  const [buildUpPreviewStep, setBuildUpPreviewStep] = useState(0);
  const [isBuildUpPreviewPlaying, setIsBuildUpPreviewPlaying] = useState(false);

  useEffect(() => {
    setBuildUpPreviewStep((currentStep) => {
      return Math.max(0, Math.min(currentStep, maxBuildUpStep));
    });
    if (!hasBuildUpAnimation) {
      setIsBuildUpPreviewPlaying(false);
    }
  }, [hasBuildUpAnimation, maxBuildUpStep]);

  useEffect(() => {
    if (!hasBuildUpAnimation || !isBuildUpPreviewPlaying) {
      return;
    }

    const timeout = window.setInterval(() => {
      setBuildUpPreviewStep((currentStep) => {
        if (currentStep >= maxBuildUpStep) {
          return 0;
        }
        return currentStep + 1;
      });
    }, 800);

    return () => {
      clearInterval(timeout);
    };
  }, [hasBuildUpAnimation, isBuildUpPreviewPlaying, maxBuildUpStep]);

  const previewElements = hasBuildUpAnimation
    ? getBuildUpAnimationElementsForStep(exportedElements, buildUpPreviewStep)
    : exportedElements;

  useEffect(() => {
    const previewNode = previewRef.current;
    if (!previewNode) {
      return;
    }
    const maxWidth = previewNode.offsetWidth;
    const maxHeight = previewNode.offsetHeight;
    if (!maxWidth) {
      return;
    }

    exportToCanvas({
      elements: previewElements,
      appState: {
        ...appStateSnapshot,
        name: projectName,
        exportBackground: exportWithBackground,
        exportWithDarkMode: exportDarkMode,
        exportScale,
        exportEmbedScene: embedScene,
      },
      files,
      exportPadding: DEFAULT_EXPORT_PADDING,
      maxWidthOrHeight: Math.max(maxWidth, maxHeight),
      exportingFrame,
    })
      .then((canvas) => {
        setRenderError(null);
        // if converting to blob fails, there's some problem that will
        // likely prevent preview and export (e.g. canvas too big)
        return canvasToBlob(canvas)
          .then(() => {
            previewNode.replaceChildren(canvas);
          })
          .catch((e) => {
            if (e.name === "CANVAS_POSSIBLY_TOO_BIG") {
              throw new Error(t("canvasError.canvasTooBig"));
            }
            throw e;
          });
      })
      .catch((error) => {
        console.error(error);
        setRenderError(error);
      });
  }, [
    appStateSnapshot,
    files,
    previewElements,
    exportingFrame,
    projectName,
    exportWithBackground,
    exportDarkMode,
    exportScale,
    embedScene,
    buildUpPreviewStep,
  ]);

  return (
    <div className="ImageExportModal">
      <h3>{t("imageExportDialog.header")}</h3>
      <div className="ImageExportModal__preview">
        <div className="ImageExportModal__preview__canvas" ref={previewRef}>
          {renderError && <ErrorCanvasPreview />}
        </div>
        <div className="ImageExportModal__preview__filename">
          {!nativeFileSystemSupported && (
            <input
              type="text"
              className="TextInput"
              value={projectName}
              style={{ width: "30ch" }}
              onChange={(event) => {
                setProjectName(event.target.value);
                actionManager.executeAction(
                  actionChangeProjectName,
                  "ui",
                  event.target.value,
                );
              }}
            />
          )}
        </div>
      </div>
      <div className="ImageExportModal__settings">
        <h3>{t("imageExportDialog.header")}</h3>
        {hasSelection && (
          <ExportSetting
            label={t("imageExportDialog.label.onlySelected")}
            name="exportOnlySelected"
          >
            <Switch
              name="exportOnlySelected"
              checked={exportSelectionOnly}
              onChange={(checked) => {
                setExportSelectionOnly(checked);
              }}
            />
          </ExportSetting>
        )}
        <ExportSetting
          label={t("imageExportDialog.label.withBackground")}
          name="exportBackgroundSwitch"
        >
          <Switch
            name="exportBackgroundSwitch"
            checked={exportWithBackground}
            onChange={(checked) => {
              setExportWithBackground(checked);
              actionManager.executeAction(
                actionChangeExportBackground,
                "ui",
                checked,
              );
            }}
          />
        </ExportSetting>
        <ExportSetting
          label={t("imageExportDialog.label.darkMode")}
          name="exportDarkModeSwitch"
        >
          <Switch
            name="exportDarkModeSwitch"
            checked={exportDarkMode}
            onChange={(checked) => {
              setExportDarkMode(checked);
              actionManager.executeAction(
                actionExportWithDarkMode,
                "ui",
                checked,
              );
            }}
          />
        </ExportSetting>
        <ExportSetting
          label={t("imageExportDialog.label.embedScene")}
          tooltip={t("imageExportDialog.tooltip.embedScene")}
          name="exportEmbedSwitch"
        >
          <Switch
            name="exportEmbedSwitch"
            checked={embedScene}
            onChange={(checked) => {
              setEmbedScene(checked);
              actionManager.executeAction(
                actionChangeExportEmbedScene,
                "ui",
                checked,
              );
            }}
          />
        </ExportSetting>
        {hasBuildUpAnimation && (
          <ExportSetting
            label={t("imageExportDialog.label.buildUpPreview")}
            name="buildUpPreview"
          >
            <div className="ImageExportModal__build-up-preview">
              <button
                type="button"
                className="ImageExportModal__build-up-preview__button"
                title={
                  isBuildUpPreviewPlaying
                    ? t("imageExportDialog.button.stopPreview")
                    : t("imageExportDialog.button.playPreview")
                }
                aria-label={
                  isBuildUpPreviewPlaying
                    ? t("imageExportDialog.button.stopPreview")
                    : t("imageExportDialog.button.playPreview")
                }
                onClick={() => {
                  setIsBuildUpPreviewPlaying((isPlaying) => !isPlaying);
                }}
              >
                {isBuildUpPreviewPlaying
                  ? playerStopFilledIcon
                  : playerPlayIcon}
              </button>
              <input
                type="number"
                min={0}
                max={maxBuildUpStep}
                step={1}
                className="TextInput ImageExportModal__build-up-preview__input"
                value={buildUpPreviewStep}
                onChange={(event) => {
                  const parsedStep = Number(event.target.value);
                  if (!Number.isFinite(parsedStep)) {
                    return;
                  }
                  setBuildUpPreviewStep(
                    Math.max(0, Math.min(Math.trunc(parsedStep), maxBuildUpStep)),
                  );
                  setIsBuildUpPreviewPlaying(false);
                }}
              />
              <span className="ImageExportModal__build-up-preview__max-step">
                / {maxBuildUpStep}
              </span>
            </div>
          </ExportSetting>
        )}
        <ExportSetting
          label={t("imageExportDialog.label.scale")}
          name="exportScale"
        >
          <RadioGroup
            name="exportScale"
            value={exportScale}
            onChange={(scale) => {
              setExportScale(scale);
              actionManager.executeAction(actionChangeExportScale, "ui", scale);
            }}
            choices={EXPORT_SCALES.map((scale) => ({
              value: scale,
              label: `${scale}\u00d7`,
            }))}
          />
        </ExportSetting>

        <div className="ImageExportModal__settings__buttons">
          <FilledButton
            className="ImageExportModal__settings__buttons__button"
            label={t("imageExportDialog.title.exportToPng")}
            onClick={() =>
              onExportImage(EXPORT_IMAGE_TYPES.png, exportedElements, {
                exportingFrame,
              })
            }
            icon={downloadIcon}
          >
            {t("imageExportDialog.button.exportToPng")}
          </FilledButton>
          <FilledButton
            className="ImageExportModal__settings__buttons__button"
            label={t("imageExportDialog.title.exportToGif")}
            onClick={() =>
              onExportImage(EXPORT_IMAGE_TYPES.gif, exportedElements, {
                exportingFrame,
              })
            }
            icon={downloadIcon}
          >
            {t("imageExportDialog.button.exportToGif")}
          </FilledButton>
          <FilledButton
            className="ImageExportModal__settings__buttons__button"
            label={t("imageExportDialog.title.exportToSvg")}
            onClick={() =>
              onExportImage(EXPORT_IMAGE_TYPES.svg, exportedElements, {
                exportingFrame,
              })
            }
            icon={downloadIcon}
          >
            {t("imageExportDialog.button.exportToSvg")}
          </FilledButton>
          {(probablySupportsClipboardBlob || isFirefox) && (
            <FilledButton
              className="ImageExportModal__settings__buttons__button"
              label={t("imageExportDialog.title.copyPngToClipboard")}
              status={copyStatus}
              onClick={async () => {
                await onExportImage(
                  EXPORT_IMAGE_TYPES.clipboard,
                  exportedElements,
                  {
                    exportingFrame,
                  },
                );
                onCopy();
              }}
              icon={copyIcon}
            >
              {t("imageExportDialog.button.copyPngToClipboard")}
            </FilledButton>
          )}
        </div>
      </div>
    </div>
  );
};

type ExportSettingProps = {
  label: string;
  children: React.ReactNode;
  tooltip?: string;
  name?: string;
};

const ExportSetting = ({
  label,
  children,
  tooltip,
  name,
}: ExportSettingProps) => {
  return (
    <div className="ImageExportModal__settings__setting" title={label}>
      <label
        htmlFor={name}
        className="ImageExportModal__settings__setting__label"
      >
        {label}
        {tooltip && (
          <Tooltip label={tooltip} long={true}>
            {helpIcon}
          </Tooltip>
        )}
      </label>
      <div className="ImageExportModal__settings__setting__content">
        {children}
      </div>
    </div>
  );
};

export const ImageExportDialog = ({
  elements,
  appState,
  files,
  actionManager,
  onExportImage,
  onCloseRequest,
  name,
}: {
  appState: UIAppState;
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  actionManager: ActionManager;
  onExportImage: AppClassProperties["onExportImage"];
  onCloseRequest: () => void;
  name: string;
}) => {
  // we need to take a snapshot so that the exported state can't be modified
  // while the dialog is open
  const [{ appStateSnapshot, elementsSnapshot }] = useState(() => {
    return {
      appStateSnapshot: cloneJSON(appState),
      elementsSnapshot: cloneJSON(elements),
    };
  });

  return (
    <Dialog onCloseRequest={onCloseRequest} size="wide" title={false}>
      <ImageExportModal
        elementsSnapshot={elementsSnapshot}
        appStateSnapshot={appStateSnapshot}
        files={files}
        actionManager={actionManager}
        onExportImage={onExportImage}
        name={name}
      />
    </Dialog>
  );
};
