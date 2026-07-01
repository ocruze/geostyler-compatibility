import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import enUS from 'antd/locale/en_US';
import { routeTree } from './routeTree.gen';

// Create a new router instance
const router = createRouter({ 
  routeTree,
  defaultPreload: 'intent',
  basepath: (import.meta.env.BASE_URL as string) ?? '/',
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={enUS}
      theme={{ token: { colorPrimary: '#1677ff' }, algorithm: theme.defaultAlgorithm }}
    >
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
