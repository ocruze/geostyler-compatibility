import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { ConfigProvider, App as AntApp, theme, Result, Button } from 'antd';
import enUS from 'antd/locale/en_US';
import { routeTree } from './routeTree.gen';
import './index.css';

// Create a new router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  basepath: (import.meta.env.BASE_URL as string) ?? '/',
  defaultNotFoundComponent: () => (
    <Result
      status="404"
      title="Page Not Found"
      subTitle="The page you are looking for does not exist."
      extra={
        <Button type="primary" href={import.meta.env.BASE_URL}>
          Back to Overview
        </Button>
      }
    />
  ),
  defaultErrorComponent: ({ error }: { error: Error }) => (
    <Result
      status="error"
      title="Something Went Wrong"
      subTitle={error.message}
      extra={
        <Button type="primary" href={import.meta.env.BASE_URL}>
          Back to Overview
        </Button>
      }
    />
  ),
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
