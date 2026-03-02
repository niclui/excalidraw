import { CaptureUpdateAction } from "@excalidraw/element";

import { t } from "../i18n";
import { getSelectedElements } from "../scene";

import { register } from "./register";

export const actionAddToComponents = register({
  name: "addToComponents",
  label: "labels.addToComponents",
  trackEvent: { category: "element" },
  predicate: (elements, appState) => {
    return getSelectedElements(elements, appState).length > 0;
  },
  perform: async (elements, appState, value, app) => {
    const result = await app.createComponentFromSelection({
      scope: "document",
    });

    if (!result.success) {
      return {
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
        appState: {
          ...appState,
          errorMessage: result.errorMessage || appState.errorMessage,
        },
      };
    }

    return {
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
      appState: {
        ...appState,
        toast: { message: t("toast.addedToComponents") },
      },
    };
  },
});
