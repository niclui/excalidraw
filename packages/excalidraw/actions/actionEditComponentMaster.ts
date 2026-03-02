import { CaptureUpdateAction } from "@excalidraw/element";

import { getLinkedComponentMetadata } from "../data/components";
import { getSelectedElements } from "../scene";

import { register } from "./register";

export const actionEditComponentMaster = register({
  name: "editComponentMaster",
  label: "labels.editComponentMaster",
  trackEvent: { category: "element" },
  predicate: (elements, appState) => {
    return getSelectedElements(elements, appState).some((element) => {
      return !!getLinkedComponentMetadata(element)?.linked;
    });
  },
  perform: async (elements, appState, value, app) => {
    const didEnter = await app.editComponentFromSelectedInstance();
    if (!didEnter) {
      return false;
    }
    return {
      captureUpdate: CaptureUpdateAction.NEVER,
      appState,
    };
  },
});
