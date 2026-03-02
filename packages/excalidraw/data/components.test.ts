import {
  COMPONENT_CUSTOM_DATA_KEY,
  detachComponentInstanceElements,
  getLinkedComponentMetadata,
  isLinkedComponentElement,
  mergeComponentDefinitions,
  restoreComponentDefinitions,
} from "./components";

describe("components data helpers", () => {
  it("merges components by id and keeps latest update ordering", () => {
    const local = [
      {
        id: "a",
        name: "A",
        scope: "document",
        ownerId: null,
        created: 1,
        updated: 1,
        elements: [{ id: "el-a", isDeleted: false }],
      },
    ] as any;

    const incoming = [
      {
        id: "a",
        name: "A2",
        scope: "document",
        ownerId: null,
        created: 1,
        updated: 3,
        elements: [{ id: "el-a", isDeleted: false }],
      },
      {
        id: "b",
        name: "B",
        scope: "personal",
        ownerId: "owner",
        created: 2,
        updated: 2,
        elements: [{ id: "el-b", isDeleted: false }],
      },
    ] as any;

    const merged = mergeComponentDefinitions(local, incoming);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("a");
    expect(merged[0].name).toBe("A2");
    expect(merged[1].id).toBe("b");
  });

  it("restores defaults and filters deleted elements", () => {
    const restored = restoreComponentDefinitions([
      {
        id: "",
        name: "",
        scope: undefined,
        ownerId: undefined,
        created: 0,
        updated: 0,
        elements: [
          { id: "deleted", isDeleted: true },
          { id: "active", isDeleted: false },
        ],
      } as any,
    ]);

    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBeTruthy();
    expect(restored[0].name).toBe("Untitled component");
    expect(restored[0].scope).toBe("document");
    expect(restored[0].ownerId).toBeNull();
    expect(restored[0].elements).toHaveLength(1);
    expect(restored[0].elements[0].id).toBe("active");
  });

  it("reads and detaches linked metadata", () => {
    const element = {
      id: "el",
      customData: {
        [COMPONENT_CUSTOM_DATA_KEY]: {
          definitionId: "component-id",
          instanceId: "instance-id",
          sourceElementId: "source-id",
          linked: true,
        },
      },
    } as any;

    expect(getLinkedComponentMetadata(element)?.linked).toBe(true);
    expect(isLinkedComponentElement(element)).toBe(true);

    const [detached] = detachComponentInstanceElements([element], {
      definitionId: "component-id",
      instanceId: "instance-id",
      detachReason: "edited",
    });

    const metadata = getLinkedComponentMetadata(detached as any);
    expect(metadata?.linked).toBe(false);
    expect(metadata?.detachReason).toBe("edited");
  });
});
