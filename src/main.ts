import { startApp } from '@/app/app';

import './style.css';

const destroyApp: () => void = startApp(document.body);

if (import.meta.hot) {
  import.meta.hot.dispose(destroyApp);
}
