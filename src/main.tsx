import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { AuthProvider } from '@/react-components/features/auth/AuthContext'
import { useAuth } from '@/react-components/features/auth/useAuth'
import './style.css'

function App() {
  const auth = useAuth()

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }, [auth.isLoading, auth.isAuthenticated])

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
