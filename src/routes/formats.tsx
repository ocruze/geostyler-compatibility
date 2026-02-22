import { createFileRoute } from '@tanstack/react-router';
import { Card, Empty } from 'antd';

export const Route = createFileRoute('/formats')({
  component: Formats,
});

function Formats() {
  return (
    <Card title="Format Support Matrix">
      <Empty 
        description="Format matrix coming soon"
        style={{ padding: '2rem' }}
      />
    </Card>
  );
}
