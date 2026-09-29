export async function fetchAllPages<T extends { id: number }>(
  fetchPage: (page: number) => Promise<{ items: T[]; lastPage: number }>,
  maxPages = 100,
): Promise<T[]> {
  const byId = new Map<number, T>();
  let page = 1;
  let lastPage = 1;

  do {
    const { items, lastPage: reportedLast } = await fetchPage(page);
    for (const item of items) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
    lastPage = Math.max(1, reportedLast || 1);
    page += 1;
  } while (page <= lastPage && page <= maxPages);

  return [...byId.values()];
}
