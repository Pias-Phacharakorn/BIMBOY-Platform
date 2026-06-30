import { createFileRoute, redirect } from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'

// ─── Projects Layout Route ────────────────────────────────────────────────────
// This is the layout wrapper for all /projects/* routes.
// The AppShell (sidebar + header) lives here so it persists across
// project sub-routes without remounting.
export const Route = createFileRoute('/projects')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: ProjectsLayout,
})

function ProjectsLayout() {
  // AppShell will be imported and rendered here once it's migrated to work
  // with TanStack Router (replacing React Router's NavLink with Link)
  return <Outlet />
}
