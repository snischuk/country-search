export type Debounced<CallbackArguments extends unknown[]> = ((
  ...callbackArguments: CallbackArguments
) => void) & { cancel(): void };

export interface TimerDriver<TimerHandle> {
  scheduleTimeout(callback: () => void, delayMilliseconds: number): TimerHandle;
  cancelTimeout(timerHandle: TimerHandle): void;
}

export function debounce<CallbackArguments extends unknown[], TimerHandle>(
  callbackToDebounce: (...callbackArguments: CallbackArguments) => void,
  delayMilliseconds: number,
  timerDriver: TimerDriver<TimerHandle>,
): Debounced<CallbackArguments> {
  let timerHandle: TimerHandle | undefined;
  let pendingArguments: CallbackArguments | undefined;

  function cancel(): void {
    if (timerHandle !== undefined) {
      timerDriver.cancelTimeout(timerHandle);
      timerHandle = undefined;
    }

    pendingArguments = undefined;
  }

  function invoke(...callbackArguments: CallbackArguments): void {
    cancel();

    pendingArguments = callbackArguments;

    timerHandle = timerDriver.scheduleTimeout((): void => {
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
