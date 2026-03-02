import clsx from "clsx";
import React, { useRef, useState } from "react";

import { useLibraryItemSvg, type SvgCache } from "../hooks/useLibraryItemSvg";

import { t } from "../i18n";

import { useEditorInterface } from "./App";

import { ToolButton } from "./ToolButton";
import { TrashIcon, pencilIcon } from "./icons";

import type { ComponentDefinition } from "../types";

export const ComponentUnit = ({
  component,
  onDragStart,
  onEdit,
  onDelete,
  svgCache,
  canEdit,
}: {
  component: ComponentDefinition;
  onDragStart: (
    component: ComponentDefinition,
    event: React.DragEvent<HTMLDivElement>,
  ) => void;
  onEdit: (component: ComponentDefinition) => void;
  onDelete: (component: ComponentDefinition) => void;
  svgCache: SvgCache;
  canEdit: boolean;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const svg = useLibraryItemSvg(
    component.id,
    component.elements,
    svgCache,
    ref,
  );
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useEditorInterface().formFactor === "phone";

  return (
    <div className="component-unit-row">
      <div
        className={clsx("library-unit", {
          "library-unit__active": component.elements.length > 0,
          "library-unit--hover": isHovered,
          "library-unit--skeleton": !svg,
        })}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="library-unit__dragger"
          ref={ref}
          draggable={component.elements.length > 0}
          onDragStart={(event) => onDragStart(component, event)}
        />
      </div>
      <div className="component-unit__meta">
        <div className="component-unit__name">{component.name}</div>
        {(isHovered || isMobile) && (
          <div className="component-unit__actions">
            <ToolButton
              type="button"
              icon={pencilIcon}
              aria-label={t("labels.editComponent")}
              title={
                canEdit
                  ? t("labels.editComponent")
                  : t("errors.componentOwnershipError")
              }
              disabled={!canEdit}
              onClick={() => onEdit(component)}
            />
            <ToolButton
              type="button"
              icon={TrashIcon}
              aria-label={t("buttons.remove")}
              title={t("buttons.remove")}
              onClick={() => onDelete(component)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
