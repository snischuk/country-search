import type { TimerDriver } from '@/features/country-search/infrastructure/scheduling/debounce';

export function createBrowserTimerDriver(): TimerDriver<number> {
  return {
    scheduleTimeout(callback: () => void, delayMilliseconds: number): number {
      return window.setTimeout(callback, delayMilliseconds);
    },

    cancelTimeout(timerHandle: number): void {
      window.clearTimeout(timerHandle);
    },
  };
}
