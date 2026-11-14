"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FilterCatalog } from "@/lib/filters/catalog";

const FilterCatalogContext = createContext<FilterCatalog>({ categories: [], locations: [] });

export function FilterCatalogProvider({ catalog, children }: { catalog: FilterCatalog; children: ReactNode }) {
  return <FilterCatalogContext.Provider value={catalog}>{children}</FilterCatalogContext.Provider>;
}

export function useFilterCatalog() {
  return useContext(FilterCatalogContext);
}
