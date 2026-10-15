"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface CustomerSelection {
  selected: ReadonlySet<number>;
  toggle: (id: number) => void;
  replace: (ids: Iterable<number>) => void;
  clear: () => void;
}

const SelectionContext = createContext<CustomerSelection | null>(null);

/** Row selection shared by the directory table (checkboxes) and the header's Bulk Actions menu. */
export function CustomerSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const value = useMemo<CustomerSelection>(
    () => ({
      selected,
      toggle: (id) =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }),
      replace: (ids) => setSelected(new Set(ids)),
      clear: () => setSelected(new Set()),
    }),
    [selected],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useCustomerSelection(): CustomerSelection {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useCustomerSelection must be used inside <CustomerSelectionProvider>.");
  return ctx;
}
