import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import type { AuthContextType } from '@/react-components/features/auth/AuthContext'

// ─── Root Route Context ────────────────────────────────────────────────────────
// Define what context is available to all child routes
interface RouterContext {
  queryClient: QueryClient
  auth: AuthContextType
}

// ─── Root Route ───────────────────────────────────────────────────────────────
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

// ─── Root Layout ───────────────────────────────────────────────────────────────
// Auth redirects are handled entirely by each route's `beforeLoad` guard
// (re-run via router.invalidate() in main.tsx on auth change). No redirect
// logic lives here — keeping it out avoids competing navigations / loops.
function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* All page routes render here */}
      <Outlet />
    </QueryClientProvider>
  )
}
