import type {
  ScheduledTask,
  SchedulerFactory,
} from '../../application/search.port';

import { debounce } from './debounce';
import type { Debounced, TimerDriver } from './debounce';

export function createDebounceSchedulerFactory(
  timerDriver: TimerDriver<number>,
): SchedulerFactory {
  return (callback: () => void, delayMilliseconds: number): ScheduledTask => {
    let isPending: boolean = true;
    const debouncedCallback: Debounced<[]> = debounce(
      (): void => {
        isPending = false;
        callback();
      },
      delayMilliseconds,
      timerDriver,
    );

    debouncedCallback();

    return {
      invoke(): void {
        if (!isPending) {
          return;
        }

        isPending = false;
        debouncedCallback.cancel();
        callback();
      },

      cancel(): void {
        if (!isPending) {
          return;
        }

        isPending = false;
        debouncedCallback.cancel();
      },
    };
  };
}
