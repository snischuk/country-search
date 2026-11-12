import type {
  SchedulerFactory,
  SearchController,
  SearchPort,
  SearchView,
} from './search.port';

export function createSearchController(
  searchPort: SearchPort,
  searchView: SearchView,
  schedulerFactory: SchedulerFactory,
): SearchController {
  void searchPort;
  void searchView;
  void schedulerFactory;

  throw new Error('Not implemented');
}
