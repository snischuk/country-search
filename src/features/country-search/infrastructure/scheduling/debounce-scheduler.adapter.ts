import type {
  ScheduledTask,
  SchedulerFactory,
} from '@/features/country-search/application/search.port';
import { debounce } from '@/features/country-search/infrastructure/scheduling/debounce';
import type {
  Debounced,
  TimerDriver,
} from '@/features/country-search/infrastructure/scheduling/debounce';

export function createDebounceSchedulerFactory(
  timerDriver: TimerDriver<number>,
): SchedulerFactory {
  return (callback: () => void, delayMilliseconds: number): ScheduledTask => {
    const debouncedCallback: Debounced<[]> = debounce(
      callback,
      delayMilliseconds,
      timerDriver,
    );

    debouncedCallback();

    return {
      cancel(): void {
        debouncedCallback.cancel();
      },
    };
  };
}
