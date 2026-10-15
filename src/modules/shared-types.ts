/** Cross-module read-model helpers. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageRequest {
  page?: number;
  pageSize?: number;
}

/** Injectable clock so use cases stay deterministic under test. */
export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

export class NotFoundError extends Error {
  constructor(entity: string, key: string | number) {
    super(`${entity} "${key}" was not found.`);
    this.name = "NotFoundError";
  }
}
