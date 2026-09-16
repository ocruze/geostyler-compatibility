import { createRootRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { Layout } from 'antd';
import { CheckCircleOutlined, FileTextOutlined } from '@ant-design/icons';

import { datasetGeneratedAt } from '@/api/queries';
import { PrereleaseProvider, PrereleaseToggle } from '@/components/PrereleaseToggle';
import { formatUtcDate } from '@/utils/date';

const { Header, Content, Footer } = Layout;

const NAV_ITEMS = [
  { path: '/', icon: <CheckCircleOutlined aria-hidden="true" />, label: 'Check compatibility' },
  { path: '/docs', icon: <FileTextOutlined aria-hidden="true" />, label: 'Docs' },
];

const isCurrent = (path: string, current: string) => (path === '/' ? current === '/' : current.startsWith(path));

const generatedDate = formatUtcDate(datasetGeneratedAt);

function RootLayout() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <PrereleaseProvider>
      <Layout className="app-layout">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Header className="app-header">
          <h1 className="app-title">
            <Link to="/">GeoStyler Compatibility</Link>
          </h1>
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
                    aria-current={isCurrent(path, currentPath) ? 'page' : undefined}
                  >
                    {icon}
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <PrereleaseToggle />
        </Header>
        <Content id="main-content" className="app-content">
          <Outlet />
        </Content>
        <Footer className="app-footer">
          Data generated from the npm registry on{' '}
          {generatedDate ? <time dateTime={datasetGeneratedAt}>{generatedDate}</time> : 'an unknown date'} (UTC).
        </Footer>
      </Layout>
    </PrereleaseProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout });
