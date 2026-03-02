import { useEffect, useRef } from "react";

import {
  cloneJSON,
  Emitter,
  Queue,
  arrayToMap,
  getUpdatedTimestamp,
  randomId,
  randomInteger,
} from "@excalidraw/common";
import { hashString } from "@excalidraw/element";
import { deepCopyElement, newElementWith } from "@excalidraw/element";

import type { MaybePromise } from "@excalidraw/common/utility-types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { atom, editorJotaiStore } from "../editor-jotai";

import type App from "../components/App";
import type {
  ComponentDefinition,
  ComponentDefinitions,
  ComponentDefinitionsSource,
  ExcalidrawImperativeAPI,
  LinkedComponentMetadata,
} from "../types";

export const COMPONENT_CUSTOM_DATA_KEY = "component";

const cloneComponentDefinitions = (
  components: ComponentDefinitions,
): ComponentDefinitions => cloneJSON(components);

export const componentsAtom = atom<{
  status: "loading" | "loaded";
  isInitialized: boolean;
  components: ComponentDefinitions;
}>({
  status: "loaded",
  isInitialized: false,
  components: [],
});

export type ComponentUpdate = {
  deletedItems: Map<ComponentDefinition["id"], ComponentDefinition>;
  addedItems: Map<ComponentDefinition["id"], ComponentDefinition>;
  updatedItems: Map<ComponentDefinition["id"], ComponentDefinition>;
};

const onComponentsUpdateEmitter = new Emitter<
  [update: ComponentUpdate, components: ComponentDefinitions]
>();

const createComponentUpdate = (
  prevComponents: ComponentDefinitions,
  nextComponents: ComponentDefinitions,
): ComponentUpdate => {
  const nextMap = arrayToMap(nextComponents);
  const prevMap = arrayToMap(prevComponents);

  const update: ComponentUpdate = {
    deletedItems: new Map<ComponentDefinition["id"], ComponentDefinition>(),
    addedItems: new Map<ComponentDefinition["id"], ComponentDefinition>(),
    updatedItems: new Map<ComponentDefinition["id"], ComponentDefinition>(),
  };

  for (const item of prevComponents) {
    if (!nextMap.has(item.id)) {
      update.deletedItems.set(item.id, item);
    }
  }

  for (const item of nextComponents) {
    const prev = prevMap.get(item.id);
    if (!prev) {
      update.addedItems.set(item.id, item);
    } else if (getComponentHash(prev) !== getComponentHash(item)) {
      update.updatedItems.set(item.id, item);
    }
  }

  return update;
};

const normalizeElements = (
  elements: readonly ExcalidrawElement[],
): ComponentDefinition["elements"] =>
  elements.filter((el) => !el.isDeleted) as ComponentDefinition["elements"];

export const restoreComponentDefinitions = (
  components: ComponentDefinitions = [],
): ComponentDefinitions => {
  const restored: ComponentDefinition[] = [];
  for (const item of components) {
    const elements = normalizeElements(item.elements || []);
    if (!elements.length) {
      continue;
    }
    restored.push({
      ...item,
      id: item.id || randomId(),
      name: item.name || "Untitled component",
      created: item.created || Date.now(),
      updated: item.updated || Date.now(),
      scope: item.scope || "document",
      ownerId: item.ownerId || null,
      elements,
    });
  }
  return restored;
};

export const mergeComponentDefinitions = (
  localComponents: ComponentDefinitions,
  incomingComponents: ComponentDefinitions,
): ComponentDefinitions => {
  const merged = new Map<ComponentDefinition["id"], ComponentDefinition>();
  for (const item of localComponents) {
    merged.set(item.id, item);
  }
  for (const item of incomingComponents) {
    merged.set(item.id, item);
  }
  return Array.from(merged.values()).sort((a, b) => b.updated - a.updated);
};

export const getLinkedComponentMetadata = (
  element: ExcalidrawElement,
): LinkedComponentMetadata | null => {
  const metadata = element.customData?.[COMPONENT_CUSTOM_DATA_KEY] as
    | LinkedComponentMetadata
    | null
    | undefined;

  if (
    !metadata ||
    !metadata.definitionId ||
    !metadata.instanceId ||
    !metadata.sourceElementId
  ) {
    return null;
  }

  return metadata;
};

export const isLinkedComponentElement = (element: ExcalidrawElement) => {
  return !!getLinkedComponentMetadata(element)?.linked;
};

export const withLinkedComponentMetadata = (
  element: ExcalidrawElement,
  metadata: LinkedComponentMetadata,
) => {
  return newElementWith(element, {
    customData: {
      ...(element.customData || {}),
      [COMPONENT_CUSTOM_DATA_KEY]: metadata,
    },
  });
};

const remapLinkedRelations = (
  element: ExcalidrawElement,
  sourceToInstanceElementId: Map<string, string>,
) => {
  if ("containerId" in element && element.containerId) {
    (element as any).containerId =
      sourceToInstanceElementId.get(element.containerId) || null;
  }
  if ("startBinding" in element && element.startBinding?.elementId) {
    (element as any).startBinding = {
      ...element.startBinding,
      elementId:
        sourceToInstanceElementId.get(element.startBinding.elementId) ||
        element.startBinding.elementId,
    };
  }
  if ("endBinding" in element && element.endBinding?.elementId) {
    (element as any).endBinding = {
      ...element.endBinding,
      elementId:
        sourceToInstanceElementId.get(element.endBinding.elementId) ||
        element.endBinding.elementId,
    };
  }
  if (element.boundElements?.length) {
    (element as any).boundElements = element.boundElements.map(
      (boundElement) => ({
        ...boundElement,
        id: sourceToInstanceElementId.get(boundElement.id) || boundElement.id,
      }),
    );
  }
};

export const createComponentInstanceElements = ({
  definition,
}: {
  definition: ComponentDefinition;
}) => {
  const sourceToInstanceElementId = new Map<string, string>();
  const instanceId = randomId();

  const clonedElements = definition.elements.map((source) => {
    const clone = deepCopyElement(source);
    const elementId = randomId();
    sourceToInstanceElementId.set(source.id, elementId);
    clone.id = elementId;
    clone.index = null;
    clone.version += 1;
    clone.versionNonce = randomInteger();
    clone.updated = getUpdatedTimestamp();
    return clone;
  });

  return clonedElements.map((clone) => {
    remapLinkedRelations(clone, sourceToInstanceElementId);
    return withLinkedComponentMetadata(clone, {
      definitionId: definition.id,
      instanceId,
      sourceElementId:
        definition.elements.find(
          (element) => sourceToInstanceElementId.get(element.id) === clone.id,
        )?.id || clone.id,
      linked: true,
    });
  });
};

export const detachComponentInstanceElements = <
  TElement extends ExcalidrawElement,
>(
  elements: readonly TElement[],
  opts: {
    definitionId: string;
    instanceId: string;
    detachReason: string;
  },
) => {
  return elements.map((element) => {
    const metadata = getLinkedComponentMetadata(element);
    if (
      !metadata ||
      metadata.definitionId !== opts.definitionId ||
      metadata.instanceId !== opts.instanceId ||
      !metadata.linked
    ) {
      return element;
    }
    return withLinkedComponentMetadata(element, {
      ...metadata,
      linked: false,
      detachReason: opts.detachReason,
      detachedAt: Date.now(),
    }) as TElement;
  }) as TElement[];
};

export const applyComponentDefinitionToLinkedInstance = <
  TElement extends ExcalidrawElement,
>({
  sceneElements,
  definition,
  instanceElements,
}: {
  sceneElements: readonly TElement[];
  definition: ComponentDefinition;
  instanceElements: readonly TElement[];
}) => {
  if (!instanceElements.length || !definition.elements.length) {
    return {
      nextElements: sceneElements,
      didUpdate: false,
    };
  }

  const sourceToInstance = new Map<string, ExcalidrawElement>();
  for (const element of instanceElements) {
    const metadata = getLinkedComponentMetadata(element);
    if (!metadata) {
      continue;
    }
    sourceToInstance.set(metadata.sourceElementId, element);
  }

  if (sourceToInstance.size !== definition.elements.length) {
    return {
      nextElements: detachComponentInstanceElements(sceneElements, {
        definitionId: definition.id,
        instanceId:
          getLinkedComponentMetadata(instanceElements[0])?.instanceId || "",
        detachReason: "structure-changed",
      }),
      didUpdate: true,
    };
  }

  const firstDefinitionElement = definition.elements[0];
  const firstInstanceElement = sourceToInstance.get(firstDefinitionElement.id);

  if (!firstInstanceElement) {
    return {
      nextElements: sceneElements,
      didUpdate: false,
    };
  }

  const deltaX = firstInstanceElement.x - firstDefinitionElement.x;
  const deltaY = firstInstanceElement.y - firstDefinitionElement.y;

  const updatedById = new Map<string, TElement>();

  const sourceToInstanceElementId = new Map<string, string>();
  for (const source of definition.elements) {
    const instanceElement = sourceToInstance.get(source.id);
    if (!instanceElement) {
      continue;
    }
    sourceToInstanceElementId.set(source.id, instanceElement.id);
  }

  for (const source of definition.elements) {
    const instanceElement = sourceToInstance.get(source.id);
    if (!instanceElement) {
      continue;
    }
    const clone = deepCopyElement(source);
    clone.id = instanceElement.id;
    clone.x = source.x + deltaX;
    clone.y = source.y + deltaY;
    clone.index = instanceElement.index;
    clone.groupIds = instanceElement.groupIds;
    clone.frameId = instanceElement.frameId;
    clone.seed = instanceElement.seed;
    clone.isDeleted = instanceElement.isDeleted;
    clone.version = instanceElement.version + 1;
    clone.versionNonce = randomInteger();
    clone.updated = getUpdatedTimestamp();
    remapLinkedRelations(clone, sourceToInstanceElementId);

    const metadata = getLinkedComponentMetadata(instanceElement);
    if (metadata) {
      clone.customData = {
        ...(clone.customData || {}),
        [COMPONENT_CUSTOM_DATA_KEY]: metadata,
      };
    }

    updatedById.set(clone.id, clone as TElement);
  }

  if (!updatedById.size) {
    return {
      nextElements: sceneElements,
      didUpdate: false,
    };
  }

  return {
    nextElements: sceneElements.map((element) => {
      return updatedById.get(element.id) || element;
    }) as TElement[],
    didUpdate: true,
  };
};

const getComponentHash = (item: ComponentDefinition) => {
  return `${item.id}:${item.name}:${item.scope}:${
    item.ownerId || ""
  }:${hashString(
    JSON.stringify(
      item.elements.map((element) => `${element.id}:${element.version}`),
    ),
  )}`;
};

export const getComponentDefinitionsHash = (
  components: ComponentDefinitions,
) => {
  return hashString(
    components
      .map((item) => getComponentHash(item))
      .sort()
      .join(),
  );
};

class Components {
  private currComponents: ComponentDefinitions = [];
  private prevComponents = cloneComponentDefinitions(this.currComponents);
  private app: App;
  private updateQueue: Promise<ComponentDefinitions>[] = [];

  constructor(app: App) {
    this.app = app;
  }

  private getLastUpdateTask = () =>
    this.updateQueue[this.updateQueue.length - 1];

  private notifyListeners = () => {
    if (this.updateQueue.length > 0) {
      editorJotaiStore.set(componentsAtom, (state) => ({
        status: "loading",
        isInitialized: state.isInitialized,
        components: this.currComponents,
      }));
      return;
    }

    editorJotaiStore.set(componentsAtom, {
      status: "loaded",
      isInitialized: true,
      components: this.currComponents,
    });

    try {
      const prevComponents = this.prevComponents;
      this.prevComponents = cloneComponentDefinitions(this.currComponents);

      const nextComponents = cloneComponentDefinitions(this.currComponents);
      this.app.props.onComponentsChange?.(nextComponents);
      onComponentsUpdateEmitter.trigger(
        createComponentUpdate(prevComponents, nextComponents),
        nextComponents,
      );
    } catch (error) {
      console.error(error);
    }
  };

  destroy = () => {
    this.updateQueue = [];
    this.currComponents = [];
  };

  getLatestComponents = (): Promise<ComponentDefinitions> => {
    return new Promise(async (resolve) => {
      try {
        const components = await (this.getLastUpdateTask() ||
          this.currComponents);
        if (this.updateQueue.length > 0) {
          resolve(this.getLatestComponents());
        } else {
          resolve(cloneComponentDefinitions(components));
        }
      } catch {
        resolve(this.currComponents);
      }
    });
  };

  resetComponents = () => {
    return this.setComponents([]);
  };

  setComponents = (
    components:
      | ComponentDefinitions
      | Promise<ComponentDefinitions>
      | ((
          latest: ComponentDefinitions,
        ) => ComponentDefinitions | Promise<ComponentDefinitions>),
  ): Promise<ComponentDefinitions> => {
    const task = new Promise<ComponentDefinitions>(async (resolve, reject) => {
      try {
        await this.getLastUpdateTask();
        if (typeof components === "function") {
          components = components(this.currComponents);
        }
        this.currComponents = cloneComponentDefinitions(await components);
        resolve(this.currComponents);
      } catch (error: any) {
        reject(error);
      }
    }).finally(() => {
      this.updateQueue = this.updateQueue.filter((_task) => _task !== task);
      this.notifyListeners();
    });

    this.updateQueue.push(task);
    this.notifyListeners();
    return task;
  };

  updateComponents = async ({
    components,
    merge = false,
  }: {
    components: ComponentDefinitionsSource;
    merge?: boolean;
  }): Promise<ComponentDefinitions> => {
    return this.setComponents(async (current) => {
      const source = await (typeof components === "function" &&
      !(components instanceof Blob)
        ? components(current)
        : components);

      if (source instanceof Blob) {
        const parsed = JSON.parse(await source.text()) as ComponentDefinitions;
        const restored = restoreComponentDefinitions(parsed);
        return merge ? mergeComponentDefinitions(current, restored) : restored;
      }

      const restored = restoreComponentDefinitions(source);
      return merge ? mergeComponentDefinitions(current, restored) : restored;
    });
  };

  getComponentById = (id: ComponentDefinition["id"]) => {
    return this.currComponents.find((item) => item.id === id) || null;
  };

  addComponent = async ({
    name,
    elements,
    scope,
    ownerId,
  }: {
    name: string;
    elements: ComponentDefinition["elements"];
    scope: ComponentDefinition["scope"];
    ownerId?: string | null;
  }) => {
    const nextComponent: ComponentDefinition = {
      id: randomId(),
      name,
      elements: cloneJSON(elements),
      scope,
      ownerId: ownerId || null,
      created: Date.now(),
      updated: Date.now(),
    };

    return this.setComponents((latest) => [nextComponent, ...latest]);
  };

  updateComponent = async (
    id: ComponentDefinition["id"],
    updater: (
      component: ComponentDefinition,
    ) => ComponentDefinition | null | undefined,
  ) => {
    return this.setComponents((latest) => {
      return latest.flatMap((component) => {
        if (component.id !== id) {
          return [component];
        }
        const nextComponent = updater(component);
        return nextComponent ? [nextComponent] : [];
      });
    });
  };

  removeComponent = async (id: ComponentDefinition["id"]) => {
    return this.setComponents((latest) =>
      latest.filter((component) => component.id !== id),
    );
  };
}

export default Components;

export interface ComponentPersistenceAdapter {
  load(metadata: { source: "load" | "save" }): MaybePromise<{
    components: ComponentDefinitions;
  } | null>;
  save(data: { components: ComponentDefinitions }): MaybePromise<void>;
}

class AdapterTransaction {
  static queue = new Queue();

  static async getComponents(
    adapter: ComponentPersistenceAdapter,
    source: "load" | "save",
    queue = true,
  ) {
    const task = () =>
      new Promise<ComponentDefinitions>(async (resolve, reject) => {
        try {
          const data = await adapter.load({ source });
          resolve(restoreComponentDefinitions(data?.components || []));
        } catch (error: any) {
          reject(error);
        }
      });

    return queue ? AdapterTransaction.queue.push(task) : task();
  }
}

let lastSavedComponentsHash = 0;

export const useHandleComponents = ({
  excalidrawAPI,
  adapter,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  adapter?: ComponentPersistenceAdapter;
}) => {
  const isLoadedRef = useRef(false);

  useEffect(() => {
    if (!excalidrawAPI || !adapter) {
      return;
    }

    isLoadedRef.current = false;
    excalidrawAPI
      .updateComponents({
        components: AdapterTransaction.getComponents(adapter, "load").then(
          (components) => {
            lastSavedComponentsHash = getComponentDefinitionsHash(components);
            return components;
          },
        ),
        merge: true,
      })
      .finally(() => {
        isLoadedRef.current = true;
      });
  }, [adapter, excalidrawAPI]);

  useEffect(() => {
    if (!adapter) {
      return;
    }
    const unsubscribe = onComponentsUpdateEmitter.on(async (_, components) => {
      if (!isLoadedRef.current) {
        return;
      }
      const personalComponents = components.filter(
        (component) => component.scope === "personal",
      );
      const hash = getComponentDefinitionsHash(personalComponents);
      if (hash === lastSavedComponentsHash) {
        return;
      }
      await adapter.save({ components: personalComponents });
      lastSavedComponentsHash = hash;
    });

    return () => {
      unsubscribe();
      lastSavedComponentsHash = 0;
    };
  }, [adapter]);
};
