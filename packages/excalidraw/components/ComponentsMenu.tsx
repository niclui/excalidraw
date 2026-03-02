import React, { useMemo, useState } from "react";

import {
  LIBRARY_DISABLED_TYPES,
  MIME_TYPES,
  randomId,
} from "@excalidraw/common";
import { deepCopyElement } from "@excalidraw/element";

import { componentsAtom } from "../data/components";
import { atom, useAtom } from "../editor-jotai";
import { t } from "../i18n";
import { getSelectedElements } from "../scene";
import { useUIAppState } from "../context/ui-appState";

import { useApp, useExcalidrawElements, useExcalidrawSetAppState } from "./App";
import { Button } from "./Button";
import { ComponentUnit } from "./ComponentUnit";
import Stack from "./Stack";
import { TextField } from "./TextField";
import "./ComponentsMenu.scss";

import type { ExcalidrawComponentIds } from "../data/types";
import type { ComponentDefinition } from "../types";

export const isComponentsMenuOpenAtom = atom(false);

export const ComponentsMenu = React.memo(() => {
  const app = useApp();
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();
  const [componentsData] = useAtom(componentsAtom);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<ComponentDefinition["scope"]>("personal");
  const [search, setSearch] = useState("");
  const [svgCache] = useState(() => new Map());

  const elements = useExcalidrawElements();
  const pendingElements = useMemo(() => {
    return getSelectedElements(
      elements,
      { selectedElementIds: appState.selectedElementIds },
      {
        includeBoundTextElement: true,
        includeElementsInFrames: true,
      },
    );
  }, [elements, appState.selectedElementIds]);

  const filtered = useMemo(() => {
    if (!search.trim()) {
      return componentsData.components;
    }
    return componentsData.components.filter((component) =>
      component.name.toLowerCase().includes(search.toLowerCase().trim()),
    );
  }, [componentsData.components, search]);

  const personalComponents = filtered.filter(
    (component) => component.scope === "personal",
  );
  const documentComponents = filtered.filter(
    (component) => component.scope === "document",
  );

  const createComponent = async () => {
    if (!pendingElements.length) {
      return;
    }
    for (const type of LIBRARY_DISABLED_TYPES) {
      if (pendingElements.some((element) => element.type === type)) {
        setAppState({
          errorMessage: t(`errors.libraryElementTypeError.${type}`),
        });
        return;
      }
    }
    const componentName = name.trim() || `Component ${randomId().slice(0, 4)}`;
    await app.components.addComponent({
      name: componentName,
      scope,
      elements: pendingElements.map((element) => deepCopyElement(element)),
      ownerId: app.getCurrentUserId?.() || null,
    });

    setName("");
  };

  const onDragStart = (
    component: ComponentDefinition,
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    const data: ExcalidrawComponentIds = {
      itemIds: [component.id],
    };
    event.dataTransfer.setData(
      MIME_TYPES.excalidrawcomponentIds,
      JSON.stringify(data),
    );
  };

  const renderSection = (
    title: string,
    sectionComponents: ComponentDefinition[],
  ) => {
    if (!sectionComponents.length) {
      return null;
    }
    return (
      <>
        <div className="library-menu-items-container__header">{title}</div>
        <Stack.Col gap={1} style={{ width: "100%" }}>
          {sectionComponents.map((component) => (
            <ComponentUnit
              key={component.id}
              component={component}
              svgCache={svgCache}
              onDragStart={onDragStart}
              onEdit={() => app.enterComponentEditMode(component.id)}
              onDelete={() => app.removeComponentDefinition(component.id)}
            />
          ))}
        </Stack.Col>
      </>
    );
  };

  return (
    <div className="library-menu-items-container">
      <div className="library-menu-items-header">
        <TextField
          type="search"
          className="library-menu-items-container__search"
          placeholder={t("labels.searchComponents")}
          value={search}
          onChange={setSearch}
        />
      </div>

      <Stack.Col gap={1} style={{ width: "100%", padding: "0 0.5rem" }}>
        <TextField
          type="text"
          placeholder={t("labels.componentName")}
          value={name}
          onChange={setName}
        />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Button
            onSelect={() => setScope("personal")}
            className={scope === "personal" ? "active" : ""}
          >
            {t("labels.personalLib")}
          </Button>
          <Button
            onSelect={() => setScope("document")}
            className={scope === "document" ? "active" : ""}
          >
            {t("labels.documentComponents")}
          </Button>
          <Button onSelect={createComponent} disabled={!pendingElements.length}>
            {t("labels.createComponent")}
          </Button>
        </div>
      </Stack.Col>

      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
        style={{ width: "100%" }}
      >
        {renderSection(t("labels.documentComponents"), documentComponents)}
        {renderSection(t("labels.personalLib"), personalComponents)}
      </Stack.Col>

      {appState.editingComponentId && (
        <div style={{ padding: "0.5rem", display: "flex", gap: "0.5rem" }}>
          <Button onSelect={() => app.saveComponentEditMode?.()}>
            {t("buttons.save")}
          </Button>
          <Button onSelect={() => app.cancelComponentEditMode?.()}>
            {t("buttons.cancel")}
          </Button>
        </div>
      )}
    </div>
  );
});
