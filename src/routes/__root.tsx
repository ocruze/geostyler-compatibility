import { createRootRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { Layout } from 'antd';
import { DatabaseOutlined, SwapOutlined, FileTextOutlined } from '@ant-design/icons';

const { Header, Content } = Layout;

const NAV_ITEMS = [
  { path: '/overview', icon: <DatabaseOutlined aria-hidden="true" />, label: 'Overview' },
  { path: '/compare', icon: <SwapOutlined aria-hidden="true" />, label: 'Compare' },
  { path: '/docs', icon: <FileTextOutlined aria-hidden="true" />, label: 'Docs' },
];

export const Route = createRootRoute({
  // This anonymous arrow function is the route's React component (per
  // TanStack Router's file-based `component:` API); its shape defeats the
  // rule's name-based component/hook detection, so the hook call below is a
  // false positive.
  component: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- see comment above
    const location = useLocation();
    const currentPath = location.pathname;

    return (
      <Layout className="app-layout">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Header className="app-header">
          <h1 className="app-title">GeoStyler Compatibility</h1>
          {/*
            Plain nav links instead of antd's horizontal <Menu>: Menu's
            responsive overflow measurement can race on first render and
            collapse every item into the "..." indicator, leaving the page
            with no visible navigation.
          */}
          <nav aria-label="Main" className="app-nav">
            <ul>
              {NAV_ITEMS.map(({ path, icon, label }) => (
                <li key={path}>
                  <Link
                    to={path}
                    aria-current={currentPath.startsWith(path) ? 'page' : undefined}
                  >
                    {icon}
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Header>
        <Content id="main-content" className="app-content">
          <Outlet />
        </Content>
      </Layout>
    );
  },
});
