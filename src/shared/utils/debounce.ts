export type Debounced<CallbackArguments extends unknown[]> = ((
  ...callbackArguments: CallbackArguments
) => void) & { cancel(): void };

export function debounce<CallbackArguments extends unknown[]>(
  callbackToDebounce: (...callbackArguments: CallbackArguments) => void,
  delayMilliseconds: number,
): Debounced<CallbackArguments> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let pendingArguments: CallbackArguments | undefined;

  function cancel(): void {
    clearTimeout(timerId);
    timerId = undefined;
    pendingArguments = undefined;
  }

  function invoke(...callbackArguments: CallbackArguments): void {
    cancel();

    pendingArguments = callbackArguments;

    timerId = setTimeout((): void => {
      const scheduledArguments: CallbackArguments | undefined =
        pendingArguments;

      cancel();

      if (scheduledArguments !== undefined) {
        callbackToDebounce(...scheduledArguments);
      }
    }, delayMilliseconds);
  }

  return Object.assign(invoke, { cancel });
}
