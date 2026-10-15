import { describe, expect, it } from "vitest";
import { hrefWith } from "./href";

describe("hrefWith", () => {
  it("merges updates into the current query and drops empty values", () => {
    expect(hrefWith("/customers", { q: "apex", status: "active", page: "3" }, { page: undefined, create: "1" })).toBe(
      "/customers?q=apex&status=active&create=1",
    );
  });

  it("returns the bare path when nothing remains", () => {
    expect(hrefWith("/sales", { order: "SL-1048" }, { order: null })).toBe("/sales");
  });
});
