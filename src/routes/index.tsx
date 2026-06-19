import { createFileRoute, redirect } from '@tanstack/react-router'

// ─── Index Route ──────────────────────────────────────────────────────────────
// Redirect the root path to /projects
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/projects' })
  },
})
