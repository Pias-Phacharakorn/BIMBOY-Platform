import { createFileRoute, redirect } from '@tanstack/react-router'
import { Outlet } from '@tanstack/react-router'
import { isGuestSession } from '@/lib/guestSession'

// ─── Projects Layout Route ────────────────────────────────────────────────────
// This is the layout wrapper for all /projects/* routes.
// The AppShell (sidebar + header) lives here so it persists across
// project sub-routes without remounting.
export const Route = createFileRoute('/projects')({
  beforeLoad: ({ context, location }) => {
    // Guests reach the demo project through this layout too — they are not
    // authenticated and never will be, so the guard admits them explicitly.
    // What a guest can actually see is decided client-side (one hard-coded demo
    // project, static .frag files); no Supabase data is reachable without a session.
    // isGuestSession() is read directly, not just off the context: on a hard load
    // this guard runs before the context's auth is wired. See lib/guestSession.ts.
    if (!context.auth?.isAuthenticated && !context.auth?.isGuest && !isGuestSession()) {
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
