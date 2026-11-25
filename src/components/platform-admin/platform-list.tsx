"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { TablePagination } from "@/components/lists/table-pagination";
import { TableSkeleton } from "@/components/loading/table-skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LIST_PAGE_SIZE } from "@/lib/lists/page-size";
import type { PlatformTenantTab } from "@/lib/platform-admin/queries";
import { platformListHref } from "./list-href";

export function PlatformList({
  path,
  tab,
  query,
  total,
  searchLabel,
  emptyLabel,
  children,
}: {
  path: string;
  tab?: PlatformTenantTab;
  query: { search: string; page: number };
  total: number;
  searchLabel: string;
  emptyLabel: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startNavigation] = useTransition();
  const [search, setSearch] = useState(query.search);
  const [loadedSearch, setLoadedSearch] = useState(query.search);

  if (query.search !== loadedSearch) {
    setLoadedSearch(query.search);
    setSearch(query.search);
  }

  function visit(nextSearch: string, page: number) {
    const trimmed = nextSearch.trim();
    if (trimmed === query.search && page === query.page) return;
    startNavigation(() => {
      router.push(platformListHref(path, { tab, search: trimmed, page }), { scroll: false });
    });
  }

  return (
    <Card className="gap-0 py-0">
      <form
        action={path}
        method="get"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          visit(search, 1);
        }}
        className="flex flex-wrap items-center gap-2 border-b px-4 py-3"
      >
        {tab === "people" ? <input type="hidden" name="tab" value={tab} /> : null}
        <div className="relative min-w-40 flex-1 sm:max-w-sm">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            aria-label={searchLabel}
            placeholder={searchLabel}
            maxLength={120}
            readOnly={pending}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <Button variant="outline" size="lg" type="submit" disabled={pending}>
          Buscar
        </Button>
      </form>
      {pending ? (
        <TableSkeleton />
      ) : total === 0 ? (
        <p className="px-4 py-12 text-center text-muted-foreground">
          {query.search ? "Nenhum resultado para a busca." : emptyLabel}
        </p>
      ) : (
        children
      )}
      <TablePagination
        page={query.page}
        pageSize={LIST_PAGE_SIZE}
        total={total}
        pending={pending}
        onPageChange={(page) => visit(query.search, page)}
      />
    </Card>
  );
}
