import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import './style.css'

// ─── React Application Entry ──────────────────────────────────────────────────
const rootElement = document.getElementById('app')

if (!rootElement) {
  throw new Error('Root element #app not found in index.html')
}

createRoot(rootElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
