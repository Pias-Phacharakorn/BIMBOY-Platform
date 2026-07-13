import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginView } from '@/react-components/views'

export const Route = createFileRoute('/login')({
  // Typed access to the ?redirect= param that protected-route guards attach.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth?.isAuthenticated) {
      // Return the user to where they were headed. Guards store `location.href`,
      // which can include a query string/hash, so route it through `href` (not
      // `to`, which expects a path template). Only allow internal, non
      // protocol-relative paths (reject //host and /\host) to avoid open redirects.
      const raw = search.redirect
      const isInternal =
        !!raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')
      if (isInternal) throw redirect({ href: raw })
      throw redirect({ to: '/projects' })
    }
  },
  component: LoginView,
})
