import { MIME_TYPES } from "@excalidraw/common";

import { Excalidraw } from "..";

import { API } from "./helpers/api";
import { render, waitFor } from "./test-utils";

const { h } = window;

describe("components", () => {
  beforeEach(async () => {
    delete (window as any).EXCALIDRAW_COMPONENTS_USER_ID;
    await render(<Excalidraw />);
    await h.app.components.resetComponents();
  });

  it("drops component ids onto canvas as linked instance", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 60,
      height: 40,
    });
    await h.app.components.addComponent({
      name: "CardComponent",
      scope: "document",
      ownerId: null,
      elements: [rectangle],
    });

    const [component] = await h.app.components.getLatestComponents();
    await API.drop([
      {
        kind: "string",
        type: MIME_TYPES.excalidrawcomponentIds,
        value: JSON.stringify({ itemIds: [component.id] }),
      },
    ]);

    await waitFor(() => {
      expect(h.elements).toHaveLength(1);
      expect(h.elements[0].customData?.component?.definitionId).toBe(
        component.id,
      );
      expect(h.elements[0].customData?.component?.linked).toBe(true);
    });
  });

  it("propagates master edits to linked instance", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 60,
      height: 40,
      backgroundColor: "transparent",
    });
    await h.app.components.addComponent({
      name: "CardComponent",
      scope: "document",
      ownerId: null,
      elements: [rectangle],
    });

    const [component] = await h.app.components.getLatestComponents();
    await API.drop([
      {
        kind: "string",
        type: MIME_TYPES.excalidrawcomponentIds,
        value: JSON.stringify({ itemIds: [component.id] }),
      },
    ]);

    await waitFor(() => {
      expect(h.elements).toHaveLength(1);
      expect(h.elements[0].customData?.component?.linked).toBe(true);
    });

    await h.app.enterComponentEditMode(component.id);
    const [editableRectangle] = h.elements;
    h.app.scene.mutateElement(editableRectangle, {
      backgroundColor: "#82c91e",
    });
    await h.app.saveComponentEditMode();

    await waitFor(() => {
      expect(h.elements).toHaveLength(1);
      expect(h.elements[0].backgroundColor).toBe("#82c91e");
      expect(h.elements[0].customData?.component?.linked).toBe(true);
    });
  });

  it("propagates edits for multi-element component instances", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 120,
      height: 80,
      backgroundColor: "transparent",
    });
    const text = API.createElement({
      type: "text",
      text: "Card Title",
      x: rectangle.x + 10,
      y: rectangle.y + 10,
    });

    await h.app.components.addComponent({
      name: "CardComponent",
      scope: "document",
      ownerId: null,
      elements: [rectangle, text],
    });

    const [component] = await h.app.components.getLatestComponents();
    await API.drop([
      {
        kind: "string",
        type: MIME_TYPES.excalidrawcomponentIds,
        value: JSON.stringify({ itemIds: [component.id] }),
      },
    ]);

    await waitFor(() => {
      expect(h.elements).toHaveLength(2);
    });

    const instanceRectBefore = h.elements.find(
      (el) => el.type === "rectangle",
    )!;
    expect(instanceRectBefore.backgroundColor).toBe("transparent");

    await h.app.enterComponentEditMode(component.id);
    const editableRect = h.elements.find((el) => el.type === "rectangle")!;
    h.app.scene.mutateElement(editableRect, { backgroundColor: "#82c91e" });
    await h.app.saveComponentEditMode();

    await waitFor(() => {
      const instanceRectAfter = h.elements.find(
        (el) => el.type === "rectangle",
      )!;
      expect(instanceRectAfter.backgroundColor).toBe("#82c91e");
      expect(instanceRectAfter.customData?.component?.linked).toBe(true);
    });
  });

  it("detaches linked instances when document component is remotely updated", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      width: 60,
      height: 40,
      backgroundColor: "transparent",
    });
    await h.app.components.addComponent({
      name: "CardComponent",
      scope: "document",
      ownerId: null,
      elements: [rectangle],
    });

    const [component] = await h.app.components.getLatestComponents();
    await API.drop([
      {
        kind: "string",
        type: MIME_TYPES.excalidrawcomponentIds,
        value: JSON.stringify({ itemIds: [component.id] }),
      },
    ]);

    await waitFor(() => {
      expect(h.elements).toHaveLength(1);
      expect(h.elements[0].customData?.component?.linked).toBe(true);
      expect(h.elements[0].backgroundColor).toBe("transparent");
    });

    h.app.updateScene({
      components: [
        {
          ...component,
          elements: [
            {
              ...component.elements[0],
              backgroundColor: "#fab005",
            },
          ],
        },
      ],
    });

    await waitFor(() => {
      expect(h.elements[0].customData?.component?.linked).toBe(false);
      expect(h.elements[0].backgroundColor).toBe("transparent");
    });
  });

  it("prevents editing component masters for non-owners", async () => {
    (window as any).EXCALIDRAW_COMPONENTS_USER_ID = "viewer-user-id";
    const rectangle = API.createElement({
      type: "rectangle",
      width: 60,
      height: 40,
    });
    await h.app.components.addComponent({
      name: "SharedComponent",
      scope: "document",
      ownerId: "owner-user-id",
      elements: [rectangle],
    });

    const [component] = await h.app.components.getLatestComponents();
    await h.app.enterComponentEditMode(component.id);

    await waitFor(() => {
      expect(h.state.editingComponentId).toBeNull();
      expect(h.state.errorMessage).toBe(
        "Only the component creator can edit this shared component.",
      );
    });
  });
});
