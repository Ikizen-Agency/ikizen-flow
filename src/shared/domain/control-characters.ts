/** ASCII control characters (C0 + DEL) or any Unicode whitespace. Browsers strip some of them while parsing URLs. */
export const CONTROL_OR_WHITESPACE = /[\u0000-\u001F\u007F\s]/;

export function hasControlOrWhitespace(value: string): boolean {
  return CONTROL_OR_WHITESPACE.test(value);
}
