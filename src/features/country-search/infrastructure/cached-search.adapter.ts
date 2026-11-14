import type { SearchPort } from '../application/search.port';

export function createCachedSearchPort(searchPort: SearchPort): SearchPort {
  throw new Error('Not implemented', { cause: searchPort });
}
