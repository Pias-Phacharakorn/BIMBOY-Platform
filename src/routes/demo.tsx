import { createFileRoute, redirect } from '@tanstack/react-router'
import { GuestEntryView } from '@/react-components/views'
import { DEMO_PROJECT_ID } from '@/react-components/features/guest-demo/demoProject'
import { isGuestSession } from '@/lib/guestSession'

// ─── /demo — the shareable guest entry point ───────────────────────────────────
// The only way into guest mode. LoginView's "Explore as Guest" button is just a
// link here, so the flag-then-navigate logic exists once.
//
// Navigation stays in beforeLoad, the single redirect mechanism (see
// docs/feature/backend.md): GuestEntryView flips the flag, main.tsx's
// router.invalidate() re-runs this guard, and the guard does the redirect. No
// imperative navigate racing it.
export const Route = createFileRoute('/demo')({
  beforeLoad: ({ context }) => {
    // A real signed-in user has their own projects — send them there instead.
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: '/projects' })
    }
    // Already a guest: straight into the model viewer, skipping the project list.
    if (context.auth?.isGuest || isGuestSession()) {
      throw redirect({
        to: '/projects/$projectId/model',
        params: { projectId: DEMO_PROJECT_ID },
      })
    }
  },
  component: GuestEntryView,
})
