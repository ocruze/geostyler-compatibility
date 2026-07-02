import { createFileRoute, redirect } from '@tanstack/react-router';

// The overview page lives at /overview; the root path only redirects there so
// the GitHub Pages entrypoint and old bookmarks keep working.
export const Route = createFileRoute('/')({
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/overview', search });
  },
});
