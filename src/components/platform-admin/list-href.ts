export function platformListHref(
  path: string,
  { search = "", page = 1 }: { search?: string; page?: number },
) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
