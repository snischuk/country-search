import type { Country } from './country.type';

export type SearchErrorKind =
  'timeout' | 'http' | 'network' | 'invalid-response';

export type SearchState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'waiting' | 'loading'; readonly query: string }
  | {
      readonly kind: 'results';
      readonly query: string;
      readonly countries: readonly Country[];
    }
  | { readonly kind: 'empty'; readonly query: string }
  | {
      readonly kind: 'error';
      readonly query: string;
      readonly errorKind: SearchErrorKind;
      readonly message: string;
      readonly statusCode: number | null;
    };
