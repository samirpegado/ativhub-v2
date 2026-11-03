"use client";

import { useEffect, useMemo, useState } from "react";

export function useRowSelection(pageIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageKey = pageIds.join("\n");

  useEffect(() => {
    const allowed = new Set(pageKey ? pageKey.split("\n") : []);
    setSelected((current) => {
      const next = new Set([...current].filter((id) => allowed.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [pageKey]);

  const count = selected.size;
  const pageSelected = pageIds.filter((id) => selected.has(id)).length;
  const allPage = pageIds.length > 0 && pageSelected === pageIds.length;
  const somePage = pageSelected > 0 && !allPage;

  return useMemo(
    () => ({
      count,
      ids: [...selected],
      allPage,
      somePage,
      isSelected: (id: string) => selected.has(id),
      toggle(id: string) {
        setSelected((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      },
      togglePage() {
        setSelected((current) => {
          const next = new Set(current);
          if (pageIds.every((id) => next.has(id))) {
            pageIds.forEach((id) => next.delete(id));
          } else {
            pageIds.forEach((id) => next.add(id));
          }
          return next;
        });
      },
      clear() {
        setSelected(new Set());
      },
    }),
    [allPage, count, pageIds, selected, somePage],
  );
}
