export function createAbortSignalWithTimeout(callerSignal: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  void callerSignal;
  throw new Error('Not implemented');
}
