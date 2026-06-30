import { createFileRoute, redirect } from '@tanstack/react-router';
import { HubSettingsView } from '@/react-components/views';

export const Route = createFileRoute('/hub-settings')({
  beforeLoad: ({ context, location }) => {
    // Ensure the user is logged in
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      });
    }

    // Verify the user is a Hub Admin
    if (context.auth.profile?.hub_role !== 'hub_admin') {
      console.warn("Access denied to Hub Admin Area. Redirecting to projects list...");
      throw redirect({
        to: '/projects',
      });
    }
  },
  component: HubSettingsView,
});
