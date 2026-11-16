export interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

export function createDeferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = (): never => {
    throw new Error('Promise executor has not run.');
  };

  let rejectPromise: (error: unknown) => void = (): never => {
    throw new Error('Promise executor has not run.');
  };

  const promise: Promise<T> = new Promise<T>(
    (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (error: unknown) => void,
    ): void => {
      resolvePromise = resolve;
      rejectPromise = reject;
    },
  );

  return { promise, resolve: resolvePromise, reject: rejectPromise };
}
