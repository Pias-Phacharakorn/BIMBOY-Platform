import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'

// ─── Root Route Context ────────────────────────────────────────────────────────
// Define what context is available to all child routes
interface RouterContext {
  queryClient: QueryClient
}

// ─── Root Route ───────────────────────────────────────────────────────────────
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

// ─── Root Layout ───────────────────────────────────────────────────────────────
function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* All page routes render here */}
      <Outlet />
    </QueryClientProvider>
  )
}
