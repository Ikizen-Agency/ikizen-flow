import { Fragment } from "react";

const REFERENCE = /(#[A-Z]+-\d+)/g;

/** Highlights record references ("#INV-2041") inside an activity sentence. */
export function ActivityMessage({ text }: { text: string }) {
  return text.split(REFERENCE).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="text-accent">
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
