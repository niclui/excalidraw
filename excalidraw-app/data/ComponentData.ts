import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { createStore, get, set } from "idb-keyval";

import {
  mergeComponentDefinitions,
  type ComponentPersistenceAdapter as ComponentPersistenceAdapterType,
} from "@excalidraw/excalidraw/data/components";

import type { ComponentDefinitions } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";

const componentsStore = createStore(
  `${STORAGE_KEYS.IDB_COMPONENTS}-db`,
  `${STORAGE_KEYS.IDB_COMPONENTS}-store`,
);

const IDB_KEY = "componentsData";

const getCookie = (name: string) => {
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")[1];
};

export const getCurrentComponentsUserId = () => {
  const explicit = (window as any).EXCALIDRAW_COMPONENTS_USER_ID;
  if (explicit) {
    return String(explicit);
  }
  const authCookie = getCookie("excplus-auth");
  if (!authCookie) {
    return null;
  }
  const userId = `excplus_${authCookie
    .slice(0, 32)
    .replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  (window as any).EXCALIDRAW_COMPONENTS_USER_ID = userId;
  return userId;
};

class ComponentsIndexedDBAdapterImpl {
  static async load() {
    const data = await get<{ components: ComponentDefinitions }>(
      IDB_KEY,
      componentsStore,
    );
    return data || null;
  }

  static save(data: { components: ComponentDefinitions }) {
    return set(IDB_KEY, data, componentsStore);
  }
}

let FIREBASE_CONFIG: Record<string, any>;
try {
  FIREBASE_CONFIG = JSON.parse(import.meta.env.VITE_APP_FIREBASE_CONFIG);
} catch {
  FIREBASE_CONFIG = {};
}

let firebaseApp: ReturnType<typeof initializeApp> | null = null;
let firestore: ReturnType<typeof getFirestore> | null = null;

const _initializeFirebase = () => {
  if (!firebaseApp) {
    firebaseApp = initializeApp(FIREBASE_CONFIG);
  }
  return firebaseApp;
};

const _getFirestore = () => {
  if (!firestore) {
    firestore = getFirestore(_initializeFirebase());
  }
  return firestore;
};

class ComponentsCloudAdapter {
  static async load(userId: string) {
    const snapshot = await getDoc(doc(_getFirestore(), "components", userId));
    if (!snapshot.exists()) {
      return null;
    }
    const data = snapshot.data() as { components?: ComponentDefinitions };
    return { components: data.components || [] };
  }

  static async save(
    userId: string,
    data: { components: ComponentDefinitions },
  ) {
    await setDoc(doc(_getFirestore(), "components", userId), data, {
      merge: true,
    });
  }
}

export const ComponentPersistenceAdapter: ComponentPersistenceAdapterType = {
  load: async () => {
    const [local, userId] = await Promise.all([
      ComponentsIndexedDBAdapterImpl.load(),
      Promise.resolve(getCurrentComponentsUserId()),
    ]);

    if (!userId) {
      return local;
    }

    try {
      const remote = await ComponentsCloudAdapter.load(userId);
      if (!remote) {
        return local;
      }

      const merged = mergeComponentDefinitions(
        local?.components || [],
        remote.components || [],
      );

      await ComponentsIndexedDBAdapterImpl.save({ components: merged });
      return { components: merged };
    } catch (error) {
      console.error(error);
      return local;
    }
  },
  save: async (data) => {
    await ComponentsIndexedDBAdapterImpl.save(data);
    const userId = getCurrentComponentsUserId();
    if (!userId) {
      return;
    }
    try {
      await ComponentsCloudAdapter.save(userId, data);
    } catch (error) {
      console.error(error);
    }
  },
};
