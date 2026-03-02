import { CaptureUpdateAction } from "@excalidraw/element";

import { t } from "../i18n";
import { getSelectedElements } from "../scene";
import { getLinkedComponentMetadata } from "../data/components";

import { register } from "./register";

export const actionDetachComponentInstance = register({
  name: "detachComponentInstance",
  label: "labels.detachComponent",
  trackEvent: { category: "element" },
  predicate: (elements, appState) => {
    return getSelectedElements(elements, appState).some((element) => {
      return !!getLinkedComponentMetadata(element)?.linked;
    });
  },
  perform: (elements, appState, value, app) => {
    const detachedCount = app.detachSelectedComponentInstances();
    if (!detachedCount) {
      return false;
    }
    return {
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
      appState: {
        ...appState,
        toast: { message: t("toast.detachedComponent") },
      },
    };
  },
});
