import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { AuthProvider } from '@/react-components/features/auth/AuthContext'
import { useAuth } from '@/react-components/features/auth/useAuth'
import './style.css'

function App() {
  const auth = useAuth()

  // Re-run route guards (beforeLoad) whenever auth changes so protected routes
  // redirect after login/logout. This is the SINGLE auth-redirect mechanism —
  // the actual redirect rules live in each route's beforeLoad (login.tsx,
  // projects.tsx, hub-settings.tsx). Do not add competing useEffect/location
  // redirects here; that caused the post-login redirect loop.
  // Key on whether the profile is loaded (not the object) so guards that gate on
  // it (e.g. hub-settings' hub_role) re-run once it arrives — WITHOUT re-firing
  // on every profile object churn (e.g. hourly TOKEN_REFRESHED refetches).
  // isGuest is in the dep list for the same reason: entering the demo changes what
  // the guards should allow, and /demo's guard is what performs the redirect.
  const hasProfile = !!auth.profile
  useEffect(() => {
    router.invalidate()
  }, [auth.isAuthenticated, hasProfile, auth.isGuest])

  if (auth.isLoading) {
    return (
      <div className="flex w-screen h-screen items-center justify-center bg-[#090a0f] text-fg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
          <span className="text-sm text-muted">Recovering engineering session...</span>
        </div>
      </div>
    )
  }

  return <RouterProvider router={router} context={{ auth }} />
}


// ─── React Application Entry ──────────────────────────────────────────────────
const rootElement = document.getElementById('app')

if (!rootElement) {
  throw new Error('Root element #app not found in index.html')
}

createRoot(rootElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
