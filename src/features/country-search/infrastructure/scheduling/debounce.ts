export type Debounced<CallbackArguments extends unknown[]> = ((
  ...callbackArguments: CallbackArguments
) => void) & { cancel(): void };

export interface TimerDriver<TimerHandle> {
  scheduleTimeout(callback: () => void, delayMilliseconds: number): TimerHandle;
  cancelTimeout(timerHandle: TimerHandle): void;
}

const RUNTIME_TIMER_DRIVER: TimerDriver<ReturnType<typeof setTimeout>> = {
  scheduleTimeout(
    callback: () => void,
    delayMilliseconds: number,
  ): ReturnType<typeof setTimeout> {
    return globalThis.setTimeout(callback, delayMilliseconds);
  },
  cancelTimeout(timerHandle: ReturnType<typeof setTimeout>): void {
    globalThis.clearTimeout(timerHandle);
  },
};

export function debounce<CallbackArguments extends unknown[], TimerHandle>(
  callbackToDebounce: (...callbackArguments: CallbackArguments) => void,
  delayMilliseconds: number,
  timerDriver?: TimerDriver<TimerHandle>,
): Debounced<CallbackArguments> {
  return timerDriver === undefined
    ? createDebounced(
        callbackToDebounce,
        delayMilliseconds,
        RUNTIME_TIMER_DRIVER,
      )
    : createDebounced(callbackToDebounce, delayMilliseconds, timerDriver);
}

function createDebounced<CallbackArguments extends unknown[], TimerHandle>(
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
