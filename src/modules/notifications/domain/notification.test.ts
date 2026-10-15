import { describe, expect, it } from "vitest";
import { safeNotificationHref } from "./notification";

describe("safeNotificationHref", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeNotificationHref("/sales?order=SL-1048")).toBe("/sales?order=SL-1048");
  });

  it.each([["//evil.example"], ["/\\evil.example"], ["https://evil.example"], ["/a b"], ["/\t/evil.example"], ["/\u0000x"], ["/\u0001/evil"], ["/\u001F"], ["/\u007F"]])(
    "rejects %j",
    (href) => {
      expect(safeNotificationHref(href)).toBeNull();
    },
  );
});
