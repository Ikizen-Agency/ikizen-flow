import { describe, expect, it } from "vitest";
import { chartTicks, monotonePath, plotPoints } from "./chart-geometry";

describe("chartTicks", () => {
  it("rounds the axis maximum up to a readable step", () => {
    expect(chartTicks(24_850)).toEqual([0, 10_000, 20_000, 30_000]);
    expect(chartTicks(1_200)).toEqual([0, 500, 1_000, 1_500]);
    expect(chartTicks(0)).toEqual([0, 1, 2, 3]);
  });
});

describe("plotPoints", () => {
  it("maps values into a 0..100 box with the first and last points on the edges", () => {
    expect(plotPoints([0, 50, 100], 100)).toEqual([
      { x: 0, y: 100 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ]);
    expect(plotPoints([7], 10)).toEqual([{ x: 50, y: 30 }]);
  });
});

describe("monotonePath", () => {
  it("draws a smooth path through every point without overshooting flat segments", () => {
    const path = monotonePath([
      { x: 0, y: 50 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ]);
    expect(path.startsWith("M 0 50")).toBe(true);
    expect(path.endsWith("100 0")).toBe(true);
    // the flat first segment keeps its control points on y = 50
    expect(path).toMatch(/^M 0 50 C [\d.]+ 50, [\d.]+ 50, 50 50/);
    expect(monotonePath([])).toBe("");
    expect(monotonePath([{ x: 10, y: 20 }])).toBe("M 10 20");
  });
});
