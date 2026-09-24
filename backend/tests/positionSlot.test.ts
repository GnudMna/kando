import { describe, expect, it } from "vitest";
import { appendPosition, assignPosition } from "../positionSlot.js";

describe("assignPosition", () => {
  it("空いている希望位置はそのまま使う", () => {
    const result = assignPosition(
      [
        { id: 1, position: 1000 },
        { id: 2, position: 2000 },
      ],
      3,
      1500,
    );

    expect(result).toEqual({ position: 1500, rebalance: [] });
  });

  it("同じ position が既にあるときは 1000 刻みに振り直す", () => {
    const result = assignPosition(
      [
        { id: 1, position: 1000 },
        { id: 2, position: 1500 },
      ],
      3,
      1500,
    );

    expect(result.position).toBe(3000);
    expect(result.rebalance).toEqual([
      { id: 1, position: 1000 },
      { id: 2, position: 2000 },
    ]);
  });

  it("末尾の加算が潰れるときは全体を振り直して末尾に置く", () => {
    const result = appendPosition([{ id: 1, position: Number.MAX_VALUE }]);

    expect(result.position).toBe(2000);
    expect(result.rebalance).toEqual([{ id: 1, position: 1000 }]);
  });
});
