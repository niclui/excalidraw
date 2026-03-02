import { getDefaultAppState } from "../appState";
import {
  addElementsToAnimationFlow,
  clearAnimationFlow,
  getAnimationFlowElements,
  moveElementInAnimationFlow,
  removeElementFromAnimationFlow,
  updateElementAnimationFlowStep,
} from "../animation/flow";
import { exportCanvas } from "../data";
import { rectangleFixture } from "./fixtures/elementFixture";

import type { ExcalidrawElement } from "@excalidraw/element/types";

const makeRectangle = (id: string): ExcalidrawElement => ({
  ...rectangleFixture,
  id,
});

describe("animation flow helpers", () => {
  it("adds selected elements and keeps sequential order", () => {
    const e1 = makeRectangle("e1");
    const e2 = makeRectangle("e2");
    const e3 = makeRectangle("e3");

    const withFlow = addElementsToAnimationFlow([e1, e2, e3], [e2.id, e1.id]);
    const flow = getAnimationFlowElements(withFlow);

    expect(flow.map((entry) => entry.element.id)).toEqual([e2.id, e1.id]);
    expect(flow.map((entry) => entry.step.order)).toEqual([0, 1]);
  });

  it("moves, updates, removes and clears steps", () => {
    const e1 = makeRectangle("e1");
    const e2 = makeRectangle("e2");
    const e3 = makeRectangle("e3");

    const withFlow = addElementsToAnimationFlow([e1, e2, e3], [
      e1.id,
      e2.id,
      e3.id,
    ]);
    const moved = moveElementInAnimationFlow(withFlow, e3.id, "up");
    expect(getAnimationFlowElements(moved).map((entry) => entry.element.id)).toEqual([
      e1.id,
      e3.id,
      e2.id,
    ]);

    const updated = updateElementAnimationFlowStep(moved, e3.id, {
      transition: "none",
      durationMs: 900,
      holdMs: 1200,
    });
    const updatedStep = getAnimationFlowElements(updated).find(
      (entry) => entry.element.id === e3.id,
    )!.step;
    expect(updatedStep.transition).toBe("none");
    expect(updatedStep.durationMs).toBe(900);
    expect(updatedStep.holdMs).toBe(1200);

    const removed = removeElementFromAnimationFlow(updated, e1.id);
    expect(
      getAnimationFlowElements(removed).map((entry) => entry.step.order),
    ).toEqual([0, 1]);

    const cleared = clearAnimationFlow(removed);
    expect(getAnimationFlowElements(cleared)).toEqual([]);
  });
});

describe("GIF export", () => {
  it("throws when trying to export GIF without animation flow", async () => {
    const element = makeRectangle("e1");
    const appState = {
      ...getDefaultAppState(),
      width: 100,
      height: 100,
      offsetTop: 0,
      offsetLeft: 0,
    } as any;

    await expect(
      exportCanvas("gif", [element] as any, appState, {}, {
        exportBackground: true,
        viewBackgroundColor: "#fff",
        exportingFrame: null,
      }),
    ).rejects.toThrow("Cannot export GIF");
  });
});
