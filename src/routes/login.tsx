import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginView } from '@/react-components/views/auth/LoginView'

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/projects' })
    }
  },
  component: LoginView,
})
