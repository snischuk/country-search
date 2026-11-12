export interface Country {
  // TODO: Add domain constraints here only when a product rule requires them.
  readonly name: string;
  readonly capital: string | null;
  readonly region: string;
  readonly population: number;
  readonly flag: string;
}
