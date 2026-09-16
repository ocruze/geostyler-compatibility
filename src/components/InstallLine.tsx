import { CopyOutlined } from '@ant-design/icons';
import { App, Button, Flex, Typography } from 'antd';

import { installCommand } from '@/engine';
import type { PackageVersion } from '@/types/compatibility';

const { Text } = Typography;

export function InstallLine({ versions }: { versions: PackageVersion[] }) {
  const { message } = App.useApp();
  const command = installCommand(versions);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      message.success('Install command copied');
    } catch {
      message.error('Could not copy. Select the command and copy it by hand.');
    }
  };

  return (
    <Flex gap="small" align="flex-start" wrap>
      <Text code className="install-line" aria-label="Install command">
        {command}
      </Text>
      <Button icon={<CopyOutlined aria-hidden="true" />} onClick={copy}>
        Copy
      </Button>
    </Flex>
  );
}
