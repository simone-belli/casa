import { describe, expect, it } from "vitest";
import { mapLimited } from "../map-limited";

describe("mapLimited", () => {
  it("keeps the order and never runs more than the limit at once", async () => {
    let running = 0;
    let most = 0;
    const result = await mapLimited([30, 10, 20, 5, 15], 2, async (ms) => {
      running++;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, ms));
      running--;
      return ms * 2;
    });
    expect(result).toEqual([60, 20, 40, 10, 30]);
    expect(most).toBe(2);
  });

  it("handles no inputs", async () => {
    expect(await mapLimited([], 3, async (x: number) => x)).toEqual([]);
  });
});
