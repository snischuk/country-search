// TODO: Keep this module generic; put country-specific formatting in its feature.
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
