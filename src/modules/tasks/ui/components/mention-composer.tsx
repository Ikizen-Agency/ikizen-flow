"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/shared/lib/cn";
import { Avatar } from "@/shared/ui/avatar";
import { Icon } from "@/shared/ui/icon";
import { COMMENT_MAX_LENGTH, editableComment, serializeMentions, type MentionTarget } from "../../domain/comment";

export interface MentionComposerProps {
  /** Workspace members offered by the `@` autocomplete. */
  members: ReadonlyArray<MentionTarget>;
  /** Name of the hidden field that carries the serialized body (`@[Name](id)` mentions). */
  name: string;
  label: string;
  placeholder?: string;
  /** Stored body to edit (mentions are turned back into `@Name`). */
  initialBody?: string;
  autoFocus?: boolean;
  className?: string;
}

interface MentionQuery {
  /** Index of the `@` that opened the autocomplete. */
  start: number;
  text: string;
}

const MAX_OPTIONS = 6;

/** The `@query` right before the caret, if any (a mention starts the text or follows whitespace). */
function queryAt(value: string, caret: number): MentionQuery | null {
  const match = /(^|\s)@([^\s@]{0,30})$/.exec(value.slice(0, caret));
  return match ? { start: caret - match[2]!.length - 1, text: match[2]! } : null;
}

/**
 * Comment textarea with keyboard-accessible member autocomplete (ARIA combobox + listbox).
 * Typing `@` (or the @ button) opens the list; ↑/↓ move, Enter/Tab pick, Escape closes.
 * The visible text shows `@Name`; the hidden field submits the serialized body.
 * Cmd/Ctrl+Enter submits the surrounding form.
 */
export function MentionComposer({ members, name, label, placeholder, initialBody = "", autoFocus, className }: MentionComposerProps) {
  const initial = useMemo(() => editableComment(initialBody), [initialBody]);
  const [text, setText] = useState(initial.text);
  const [picks, setPicks] = useState<MentionTarget[]>(initial.picks);
  const [query, setQuery] = useState<MentionQuery | null>(null);
  const [active, setActive] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const listId = useId();

  const options = useMemo(() => {
    if (!query) return [];
    const q = query.text.toLowerCase();
    return members
      .filter((m) => m.name.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
      .slice(0, MAX_OPTIONS);
  }, [members, query]);
  const open = query !== null && options.length > 0;

  const refresh = (el: HTMLTextAreaElement) => {
    const next = queryAt(el.value, el.selectionStart ?? el.value.length);
    setQuery(next);
    if (next?.text !== query?.text) setActive(0);
  };

  const placeCaret = (position: number) =>
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(position, position);
    });

  const pick = (member: MentionTarget) => {
    if (!query) return;
    const caret = textarea.current?.selectionStart ?? text.length;
    const insert = `@${member.name} `;
    setText(text.slice(0, query.start) + insert + text.slice(caret));
    setPicks((prev) => (prev.some((p) => p.id === member.id) ? prev : [...prev, member]));
    setQuery(null);
    placeCaret(query.start + insert.length);
  };

  /** The toolbar "@" button: inserts a trigger at the caret and opens the list. */
  const startMention = () => {
    const el = textarea.current;
    const caret = el?.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const insert = before === "" || /\s$/.test(before) ? "@" : " @";
    setText(before + insert + text.slice(caret));
    setQuery({ start: caret + insert.length - 1, text: "" });
    setActive(0);
    placeCaret(caret + insert.length);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((i) => (i + step + options.length) % options.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(options[active] ?? options[0]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      <input type="hidden" name={name} value={serializeMentions(text, picks)} />
      <div className="flex items-start gap-1">
        <textarea
          ref={textarea}
          value={text}
          rows={2}
          required
          maxLength={COMMENT_MAX_LENGTH}
          autoFocus={autoFocus}
          aria-label={label}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            refresh(e.target);
          }}
          onClick={(e) => refresh(e.currentTarget)}
          onKeyUp={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") refresh(e.currentTarget);
          }}
          onBlur={() => setQuery(null)}
          onKeyDown={onKeyDown}
          className="min-h-9 min-w-0 flex-1 resize-y bg-transparent py-2 text-body-sm text-ink placeholder:text-ink-placeholder focus:outline-none"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={startMention}
          title="Mention a teammate"
          aria-label="Mention a teammate"
          className="mt-1 rounded-control p-1 text-ink-subtle transition-colors hover:bg-card hover:text-ink"
        >
          <Icon name="alternate_email" size={16} />
        </button>
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label="Teammates"
        hidden={!open}
        className="absolute bottom-full left-0 z-40 mb-2 w-64 rounded-card border border-line-strong bg-card py-1 shadow-level-2"
      >
        {options.map((m, i) => (
          <li
            key={m.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault();
              pick(m);
            }}
            onMouseEnter={() => setActive(i)}
            className={cn("flex cursor-pointer items-center gap-2 px-3 py-1.5 text-body-sm text-ink", i === active && "bg-accent-tint text-accent")}
          >
            <Avatar name={m.name} size="xs" />
            {m.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
