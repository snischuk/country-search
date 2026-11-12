export type Debounced<Arguments extends unknown[]> = ((
  ...arguments_: Arguments
) => void) & { cancel(): void };

export function debounce<Arguments extends unknown[]>(
  _callback: (...arguments_: Arguments) => void,
  _delay: number,
): Debounced<Arguments> {
  void _callback;
  void _delay;
  throw new Error('Not implemented');
}
