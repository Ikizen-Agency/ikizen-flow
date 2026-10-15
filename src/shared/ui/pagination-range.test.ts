import { describe, expect, it } from "vitest";
import { paginationRange } from "./pagination-range";

describe("paginationRange", () => {
  it("lists every page when there are few", () => {
    expect(paginationRange(1, 3)).toEqual([1, 2, 3]);
  });

  it("collapses distant pages with gaps like the design (1 2 3 ... 22)", () => {
    expect(paginationRange(1, 22)).toEqual([1, 2, 3, "gap", 22]);
    expect(paginationRange(10, 22)).toEqual([1, "gap", 9, 10, 11, "gap", 22]);
    expect(paginationRange(22, 22)).toEqual([1, "gap", 20, 21, 22]);
  });

  it("returns a single page when there are no results", () => {
    expect(paginationRange(1, 0)).toEqual([1]);
  });
});
