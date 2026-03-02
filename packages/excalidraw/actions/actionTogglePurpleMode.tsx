import { CODES, KEYS } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

export const actionTogglePurpleMode = register({
  name: "purpleMode",
  label: "buttons.purpleMode",
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.purpleModeEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        purpleModeEnabled: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.purpleModeEnabled,
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.P,
});
