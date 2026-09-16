import { createFileRoute } from '@tanstack/react-router';
import { Card, Typography } from 'antd';
import { useEffect } from 'react';

import { usePackages } from '@/api/queries';
import { LatestReleasesGrid } from '@/components/LatestReleasesGrid';

const { Paragraph } = Typography;

export const Route = createFileRoute('/')({ component: LatestReleases });

function LatestReleases() {
  const { data: packages } = usePackages();

  useEffect(() => {
    document.title = 'Latest releases · GeoStyler Compatibility';
  }, []);

  return (
    <Card title="Latest releases">
      <Paragraph type="secondary">
        The latest stable release of every tracked package against every other. Prereleases are excluded. Select a
        cell to see how the verdict was reached.
      </Paragraph>
      <LatestReleasesGrid packages={packages} />
    </Card>
  );
}
