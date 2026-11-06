import { describe, expect, it } from "vitest";
import { editFailed, editSaved, editStarted, initialSyncState, loaded, restored, shown, type SyncState } from "../sync-state";

type List = Record<string, "have" | "need">;
const set = (name: string, status: "have" | "need") => (d: List) => ({ ...d, [name]: status });

describe("live data with both phones changing it", () => {
  it("keeps my tick on screen when a load that started before my save comes back after it", () => {
    let s: SyncState<List> = loaded(initialSyncState<List>(), 1, { milk: "need", eggs: "need" });
    // Kat's change sets off load 2; it reads the database before my save lands.
    s = editStarted(s, { id: 1, apply: set("milk", "have"), savedAfterLoad: null });
    s = editSaved(s, 1, 2);
    s = loaded(s, 2, { milk: "need", eggs: "have" });
    expect(shown(s)).toEqual({ milk: "have", eggs: "have" }); // mine kept, Kat's arrived
    // Load 3 started after my save, so it has it: the edit is no longer needed.
    s = loaded(s, 3, { milk: "have", eggs: "have" });
    expect(s.pending).toEqual([]);
    expect(shown(s)).toEqual({ milk: "have", eggs: "have" });
  });

  it("shows the other person's changes while my save is still in flight", () => {
    let s = loaded(initialSyncState<List>(), 1, { milk: "need", eggs: "need" });
    s = editStarted(s, { id: 1, apply: set("milk", "have"), savedAfterLoad: null });
    s = loaded(s, 2, { milk: "need", eggs: "have" });
    expect(shown(s)).toEqual({ milk: "have", eggs: "have" });
  });

  it("ignores a load that comes back after a newer one", () => {
    let s = loaded(initialSyncState<List>(), 3, { milk: "have" });
    s = loaded(s, 2, { milk: "need" });
    expect(shown(s)).toEqual({ milk: "have" });
  });

  it("takes a failed edit off the screen", () => {
    let s = loaded(initialSyncState<List>(), 1, { milk: "need" });
    s = editStarted(s, { id: 1, apply: set("milk", "have"), savedAfterLoad: null });
    s = editFailed(s, 1);
    expect(shown(s)).toEqual({ milk: "need" });
  });

  it("applies several edits in order", () => {
    let s = loaded(initialSyncState<List>(), 1, { milk: "need" });
    s = editStarted(s, { id: 1, apply: set("milk", "have"), savedAfterLoad: null });
    s = editStarted(s, { id: 2, apply: set("milk", "need"), savedAfterLoad: null });
    expect(shown(s)).toEqual({ milk: "need" });
  });

  it("shows a saved copy only until real data arrives", () => {
    let s = restored(initialSyncState<List>(), { milk: "need" });
    expect(shown(s)).toEqual({ milk: "need" });
    s = loaded(s, 1, { milk: "have" });
    expect(restored(s, { milk: "need" })).toBe(s);
  });
});
