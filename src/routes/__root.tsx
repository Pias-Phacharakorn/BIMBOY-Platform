import { useEffect } from 'react'
import { createRootRouteWithContext, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
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
function RootLayout() {
  const { auth } = Route.useRouteContext()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!auth.isAuthenticated && location.pathname !== '/login') {
      navigate({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  }, [auth.isAuthenticated, location.pathname, location.href, navigate])

  return (
    <QueryClientProvider client={queryClient}>
      {/* All page routes render here */}
      <Outlet />
    </QueryClientProvider>
  )
}

