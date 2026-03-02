import React from "react";

import { isFirefox, isWindows } from "@excalidraw/common";

import { KEYS } from "@excalidraw/common";

import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { shortcutMap } from "../actions/shortcuts";
import { probablySupportsClipboardBlob } from "../clipboard";
import { t } from "../i18n";
import { getShortcutKey } from "../shortcut";

import { Dialog } from "./Dialog";
import { ExternalLinkIcon, GithubIcon, youtubeIcon } from "./icons";
import { SHAPES } from "./shapes";

import "./HelpDialog.scss";

import type { ShortcutName } from "../actions/shortcuts";
import type { JSX } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShortcutCategory =
  | "tools"
  | "canvasNavigation"
  | "elementActions"
  | "fileOperations";

interface ShortcutEntry {
  label: string;
  shortcuts: string[];
  isOr?: boolean;
}

const CATEGORY_ORDER: ShortcutCategory[] = [
  "tools",
  "canvasNavigation",
  "elementActions",
  "fileOperations",
];

const CATEGORY_I18N = {
  tools: "helpDialog.tools",
  canvasNavigation: "helpDialog.canvasNavigation",
  elementActions: "helpDialog.elementActions",
  fileOperations: "helpDialog.fileOperations",
} as const;

const CATEGORY_CSS: Record<ShortcutCategory, string> = {
  tools: "HelpDialog__island--tools",
  canvasNavigation: "HelpDialog__island--canvas-navigation",
  elementActions: "HelpDialog__island--element-actions",
  fileOperations: "HelpDialog__island--file-operations",
};

// ---------------------------------------------------------------------------
// Dynamic shortcut helpers
// ---------------------------------------------------------------------------

const fromMap = (name: ShortcutName): string[] => shortcutMap[name] ?? [];

/**
 * Builds tool shortcuts dynamically from the SHAPES registry so that any
 * addition / removal / key-change in SHAPES is automatically reflected.
 */
const buildToolShortcutsFromShapes = (): ShortcutEntry[] => {
  const entries: ShortcutEntry[] = [];

  for (const shape of SHAPES) {
    const shortcuts: string[] = [];
    if (shape.key) {
      if (typeof shape.key === "string") {
        shortcuts.push(shape.key);
      } else {
        shortcuts.push(...shape.key);
      }
    }
    if (shape.numericKey) {
      shortcuts.push(shape.numericKey);
    }
    if (shortcuts.length > 0) {
      entries.push({
        label: t(`toolBar.${shape.value}`),
        shortcuts,
      });
    }
  }

  return entries;
};

/**
 * Assembles all keyboard shortcuts, grouped into four categories.
 *
 * Tool key-bindings are parsed from the SHAPES array. Action key-bindings
 * are pulled from the shortcutMap (which itself derives from getShortcutKey
 * at load time). Gesture / interaction shortcuts that have no declarative
 * data source use getShortcutKey for platform-correct formatting.
 */
const getKeyboardShortcutGroups = (): Record<
  ShortcutCategory,
  ShortcutEntry[]
> => {
  // ── Tools ───────────────────────────────────────────────────────────────
  const tools: ShortcutEntry[] = [
    ...buildToolShortcutsFromShapes(),
    { label: t("toolBar.frame"), shortcuts: fromMap("setFrameAsActiveTool") },
    {
      label: t("labels.eyeDropper"),
      shortcuts: [KEYS.I, "Shift+S", "Shift+G"],
    },
    {
      label: t("helpDialog.editLineArrowPoints"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Enter")],
    },
    {
      label: t("helpDialog.editText"),
      shortcuts: [getShortcutKey("Enter")],
    },
    {
      label: t("helpDialog.textNewLine"),
      shortcuts: [getShortcutKey("Enter"), getShortcutKey("Shift+Enter")],
    },
    {
      label: t("helpDialog.textFinish"),
      shortcuts: [getShortcutKey("Esc"), getShortcutKey("CtrlOrCmd+Enter")],
    },
    {
      label: t("helpDialog.curvedArrow"),
      shortcuts: [
        "A",
        t("helpDialog.click"),
        t("helpDialog.click"),
        t("helpDialog.click"),
      ],
      isOr: false,
    },
    {
      label: t("helpDialog.curvedLine"),
      shortcuts: [
        "L",
        t("helpDialog.click"),
        t("helpDialog.click"),
        t("helpDialog.click"),
      ],
      isOr: false,
    },
    {
      label: t("helpDialog.cropStart"),
      shortcuts: [t("helpDialog.doubleClick"), getShortcutKey("Enter")],
    },
    {
      label: t("helpDialog.cropFinish"),
      shortcuts: [getShortcutKey("Enter"), getShortcutKey("Escape")],
    },
    { label: t("toolBar.lock"), shortcuts: fromMap("toolLock") },
    {
      label: t("helpDialog.preventBinding"),
      shortcuts: [getShortcutKey("CtrlOrCmd")],
    },
    { label: t("toolBar.link"), shortcuts: fromMap("hyperlink") },
    {
      label: t("toolBar.convertElementType"),
      shortcuts: ["Tab", "Shift+Tab"],
    },
  ];

  // ── Canvas Navigation ───────────────────────────────────────────────────
  const canvasNavigation: ShortcutEntry[] = [
    { label: t("buttons.zoomIn"), shortcuts: fromMap("zoomIn") },
    { label: t("buttons.zoomOut"), shortcuts: fromMap("zoomOut") },
    { label: t("buttons.resetZoom"), shortcuts: fromMap("resetZoom") },
    { label: t("helpDialog.zoomToFit"), shortcuts: fromMap("zoomToFit") },
    {
      label: t("helpDialog.zoomToSelection"),
      shortcuts: fromMap("zoomToFitSelectionInViewport"),
    },
    {
      label: t("helpDialog.movePageUpDown"),
      shortcuts: ["PgUp/PgDn"],
    },
    {
      label: t("helpDialog.movePageLeftRight"),
      shortcuts: ["Shift+PgUp/PgDn"],
    },
    {
      label: t("labels.moveCanvas"),
      shortcuts: [
        getShortcutKey(`Space+${t("helpDialog.drag")}`),
        getShortcutKey(`Wheel+${t("helpDialog.drag")}`),
      ],
    },
    {
      label: t("helpDialog.createFlowchart"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Arrow Key")],
    },
    {
      label: t("helpDialog.navigateFlowchart"),
      shortcuts: [getShortcutKey("Alt+Arrow Key")],
    },
    { label: t("buttons.zenMode"), shortcuts: fromMap("zenMode") },
    {
      label: t("buttons.objectsSnapMode"),
      shortcuts: fromMap("objectsSnapMode"),
    },
    { label: t("labels.toggleGrid"), shortcuts: fromMap("gridMode") },
    { label: t("labels.viewMode"), shortcuts: fromMap("viewMode") },
    { label: t("labels.toggleTheme"), shortcuts: fromMap("toggleTheme") },
    { label: t("stats.fullTitle"), shortcuts: fromMap("stats") },
    { label: t("search.title"), shortcuts: fromMap("searchMenu") },
    {
      label: t("commandPalette.title"),
      shortcuts: isFirefox
        ? [getShortcutFromShortcutName("commandPalette")]
        : [
            getShortcutFromShortcutName("commandPalette"),
            getShortcutFromShortcutName("commandPalette", 1),
          ],
    },
  ];

  // ── Element Actions ─────────────────────────────────────────────────────
  const elementActions: ShortcutEntry[] = [
    { label: t("labels.delete"), shortcuts: fromMap("deleteSelectedElements") },
    { label: t("labels.cut"), shortcuts: fromMap("cut") },
    { label: t("labels.copy"), shortcuts: fromMap("copy") },
    { label: t("labels.paste"), shortcuts: fromMap("paste") },
    {
      label: t("labels.pasteAsPlaintext"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+V")],
    },
    { label: t("labels.selectAll"), shortcuts: fromMap("selectAll") },
    {
      label: t("labels.multiSelect"),
      shortcuts: [getShortcutKey(`Shift+${t("helpDialog.click")}`)],
    },
    {
      label: t("helpDialog.deepSelect"),
      shortcuts: [getShortcutKey(`CtrlOrCmd+${t("helpDialog.click")}`)],
    },
    {
      label: t("helpDialog.deepBoxSelect"),
      shortcuts: [getShortcutKey(`CtrlOrCmd+${t("helpDialog.drag")}`)],
    },
  ];

  if (probablySupportsClipboardBlob || isFirefox) {
    elementActions.push({
      label: t("labels.copyAsPng"),
      shortcuts: fromMap("copyAsPng"),
    });
  }

  elementActions.push(
    { label: t("labels.copyStyles"), shortcuts: fromMap("copyStyles") },
    { label: t("labels.pasteStyles"), shortcuts: fromMap("pasteStyles") },
    { label: t("labels.sendToBack"), shortcuts: fromMap("sendToBack") },
    { label: t("labels.bringToFront"), shortcuts: fromMap("bringToFront") },
    { label: t("labels.sendBackward"), shortcuts: fromMap("sendBackward") },
    { label: t("labels.bringForward"), shortcuts: fromMap("bringForward") },
    {
      label: t("labels.alignTop"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Up")],
    },
    {
      label: t("labels.alignBottom"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Down")],
    },
    {
      label: t("labels.alignLeft"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Left")],
    },
    {
      label: t("labels.alignRight"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+Right")],
    },
    {
      label: t("labels.duplicateSelection"),
      shortcuts: fromMap("duplicateSelection"),
    },
    {
      label: t("helpDialog.toggleElementLock"),
      shortcuts: fromMap("toggleElementLock"),
    },
    { label: t("buttons.undo"), shortcuts: [getShortcutKey("CtrlOrCmd+Z")] },
    {
      label: t("buttons.redo"),
      shortcuts: isWindows
        ? [getShortcutKey("CtrlOrCmd+Y"), getShortcutKey("CtrlOrCmd+Shift+Z")]
        : [getShortcutKey("CtrlOrCmd+Shift+Z")],
    },
    { label: t("labels.group"), shortcuts: fromMap("group") },
    { label: t("labels.ungroup"), shortcuts: fromMap("ungroup") },
    {
      label: t("labels.flipHorizontal"),
      shortcuts: fromMap("flipHorizontal"),
    },
    { label: t("labels.flipVertical"), shortcuts: fromMap("flipVertical") },
    { label: t("labels.showStroke"), shortcuts: [getShortcutKey("S")] },
    { label: t("labels.showBackground"), shortcuts: [getShortcutKey("G")] },
    { label: t("labels.showFonts"), shortcuts: [getShortcutKey("Shift+F")] },
    {
      label: t("labels.decreaseFontSize"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+<")],
    },
    {
      label: t("labels.increaseFontSize"),
      shortcuts: [getShortcutKey("CtrlOrCmd+Shift+>")],
    },
  );

  // ── File Operations ─────────────────────────────────────────────────────
  const fileOperations: ShortcutEntry[] = [
    { label: t("helpDialog.saveFile"), shortcuts: fromMap("saveScene") },
    { label: t("helpDialog.openFile"), shortcuts: fromMap("loadScene") },
    {
      label: t("buttons.clearReset"),
      shortcuts: fromMap("clearCanvas"),
    },
    {
      label: t("helpDialog.exportImage"),
      shortcuts: fromMap("imageExport"),
    },
  ];

  return { tools, canvasNavigation, elementActions, fileOperations };
};

// ---------------------------------------------------------------------------
// Presentational components
// ---------------------------------------------------------------------------

const Header = () => (
  <div className="HelpDialog__header">
    <a
      className="HelpDialog__btn"
      href="https://docs.excalidraw.com"
      target="_blank"
      rel="noopener"
    >
      <div className="HelpDialog__link-icon">{ExternalLinkIcon}</div>
      {t("helpDialog.documentation")}
    </a>
    <a
      className="HelpDialog__btn"
      href="https://plus.excalidraw.com/blog"
      target="_blank"
      rel="noopener"
    >
      <div className="HelpDialog__link-icon">{ExternalLinkIcon}</div>
      {t("helpDialog.blog")}
    </a>
    <a
      className="HelpDialog__btn"
      href="https://github.com/excalidraw/excalidraw/issues"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="HelpDialog__link-icon">{GithubIcon}</div>
      {t("helpDialog.github")}
    </a>
    <a
      className="HelpDialog__btn"
      href="https://youtube.com/@excalidraw"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="HelpDialog__link-icon">{youtubeIcon}</div>
      YouTube
    </a>
  </div>
);

const Section = (props: { title: string; children: React.ReactNode }) => (
  <>
    <h3>{props.title}</h3>
    <div className="HelpDialog__islands-container">{props.children}</div>
  </>
);

const ShortcutIsland = (props: {
  caption: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`HelpDialog__island ${props.className}`}>
    <h4 className="HelpDialog__island-title">{props.caption}</h4>
    <div className="HelpDialog__island-content">{props.children}</div>
  </div>
);

function* intersperse(as: JSX.Element[][], delim: string | null) {
  let first = true;
  for (const x of as) {
    if (!first) {
      yield delim;
    }
    first = false;
    yield x;
  }
}

const upperCaseSingleChars = (str: string) => {
  return str.replace(/\b[a-z]\b/, (c) => c.toUpperCase());
};

const Shortcut = ({
  label,
  shortcuts,
  isOr = true,
}: {
  label: string;
  shortcuts: string[];
  isOr?: boolean;
}) => {
  const splitShortcutKeys = shortcuts.map((shortcut) => {
    const keys = shortcut.endsWith("++")
      ? [...shortcut.slice(0, -2).split("+"), "+"]
      : shortcut.split("+");

    return keys.map((key) => (
      <ShortcutKey key={key}>{upperCaseSingleChars(key)}</ShortcutKey>
    ));
  });

  return (
    <div className="HelpDialog__shortcut">
      <div>{label}</div>
      <div className="HelpDialog__key-container">
        {[...intersperse(splitShortcutKeys, isOr ? t("helpDialog.or") : null)]}
      </div>
    </div>
  );
};

const ShortcutKey = (props: { children: React.ReactNode }) => (
  <kbd className="HelpDialog__key" {...props} />
);

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export const HelpDialog = ({ onClose }: { onClose?: () => void }) => {
  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const groups = getKeyboardShortcutGroups();

  return (
    <>
      <Dialog
        onCloseRequest={handleClose}
        title={t("helpDialog.title")}
        className={"HelpDialog"}
      >
        <Header />
        <Section title={t("helpDialog.shortcuts")}>
          {CATEGORY_ORDER.map((category) => (
            <ShortcutIsland
              key={category}
              className={CATEGORY_CSS[category]}
              caption={t(CATEGORY_I18N[category])}
            >
              {groups[category]
                .filter((entry) => entry.shortcuts.length > 0)
                .map((entry, i) => (
                  <Shortcut
                    key={i}
                    label={entry.label}
                    shortcuts={entry.shortcuts}
                    isOr={entry.isOr}
                  />
                ))}
            </ShortcutIsland>
          ))}
        </Section>
      </Dialog>
    </>
  );
};
