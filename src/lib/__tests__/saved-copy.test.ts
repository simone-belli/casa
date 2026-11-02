import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSavedCopies, readSavedCopy, writeSavedCopy } from "../saved-copy";

/** A minimal in-memory localStorage. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe("saved copies", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads back what was written", () => {
    writeSavedCopy("groceries", { items: [{ id: "a" }] });
    expect(readSavedCopy("groceries")).toEqual({ items: [{ id: "a" }] });
    expect(readSavedCopy("agenda")).toBeNull();
  });

  it("clears only Casa's saved copies", () => {
    writeSavedCopy("groceries", 1);
    writeSavedCopy("recipes", 2);
    storage.setItem("groceries:store", '"esselunga"');
    clearSavedCopies();
    expect(readSavedCopy("groceries")).toBeNull();
    expect(readSavedCopy("recipes")).toBeNull();
    expect(storage.getItem("groceries:store")).toBe('"esselunga"');
  });

  it("carries on when storage is blocked or full", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    expect(() => writeSavedCopy("agenda", {})).not.toThrow();
    expect(readSavedCopy("agenda")).toBeNull();
    expect(() => clearSavedCopies()).not.toThrow();
  });

  it("ignores a copy it can't read", () => {
    storage.setItem("casa:saved:v1:household", "{not json");
    expect(readSavedCopy("household")).toBeNull();
  });
});
