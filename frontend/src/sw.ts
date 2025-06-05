import { precacheAndRoute, createHandlerBoundToURL  } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// App Shell-style routing for SPA navigation
registerRoute(
  // Check if this is a navigation request
  ({ request, }) => request.mode === 'navigate',
  // Serve the app shell (index.html or /)
  createHandlerBoundToURL('/')
);