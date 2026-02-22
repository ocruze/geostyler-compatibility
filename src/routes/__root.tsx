import { createRootRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { Layout, Menu } from 'antd';
import { DatabaseOutlined, SwapOutlined, BgColorsOutlined } from '@ant-design/icons';

const { Header, Content } = Layout;

export const Route = createRootRoute({
  component: () => {
    const location = useLocation();
    const currentPath = location.pathname;

    const menuItems = [
      {
        key: '/',
        icon: <DatabaseOutlined />,
        label: <Link to="/">Dashboard</Link>,
      },
      {
        key: '/formats',
        icon: <BgColorsOutlined />,
        label: <Link to="/formats">Formats</Link>,
      },
      {
        key: '/compare',
        icon: <SwapOutlined />,
        label: <Link to="/compare">Compare</Link>,
      },
    ];

    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
            GeoStyler Compatibility Dashboard
          </h1>
          <Menu
            mode="horizontal"
            selectedKeys={[currentPath]}
            items={menuItems}
            style={{ border: 'none', flex: 1, justifyContent: 'flex-end' }}
          />
        </Header>
        <Content style={{ padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
          <Outlet />
        </Content>
      </Layout>
    );
  },
});
