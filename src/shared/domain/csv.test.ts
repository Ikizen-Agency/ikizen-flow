import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("joins rows with CRLF and leaves simple cells unquoted", () => {
    expect(toCsv([["Company", "Sales"], ["Apex", 48200]])).toBe("Company,Sales\r\nApex,48200");
  });

  it("quotes cells containing separators, quotes or line breaks", () => {
    expect(toCsv([["Liam O'Connor", 'Say "hi"', "a,b", "two\nlines"]])).toBe(
      `Liam O'Connor,"Say ""hi""","a,b","two\nlines"`,
    );
  });

  it("neutralises spreadsheet formula injection and renders empty values", () => {
    expect(toCsv([["=SUM(A1)", "+1", null, undefined]])).toBe("'=SUM(A1),'+1,,");
  });
});
