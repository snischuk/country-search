export interface Currency {
  readonly code: string | null;
  readonly name: string;
  readonly symbol: string | null;
}

export interface Country {
  readonly id: string;
  readonly name: string;
  readonly flagUrl: string | null;
  readonly flagEmoji: string | null;
  readonly capital: string | null;
  readonly region: string | null;
  readonly population: number | null;
  readonly area: number | null;
  readonly languages: readonly string[];
  readonly currencies: readonly Currency[];
  readonly borders: readonly string[];
  readonly description: string;
}
