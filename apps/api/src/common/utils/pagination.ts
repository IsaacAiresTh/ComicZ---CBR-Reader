export interface PageParams {
  page: number;
  perPage: number;
}

export function toSkipTake({ page, perPage }: PageParams): { skip: number; take: number } {
  return { skip: (page - 1) * perPage, take: perPage };
}

export function paginate<T>(items: T[], total: number, { page, perPage }: PageParams) {
  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}
