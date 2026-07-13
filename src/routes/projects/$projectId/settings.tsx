import { createFileRoute, redirect } from '@tanstack/react-router'
import { SettingsView } from '@/react-components/views'
import { projectsService } from '@/react-components/features/projects/projectsService'

// ─── /projects/$projectId/settings ────────────────────────────────────────────
export const Route = createFileRoute('/projects/$projectId/settings')({
  beforeLoad: async ({ context, params, location }) => {
    // 1. Ensure user is logged in
    if (!context.auth?.isAuthenticated || !context.auth.user) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    // 2. Hub admins have access to all project settings
    if (context.auth.profile?.hub_role === 'hub_admin') {
      return
    }

    // 3. Retrieve project members to check if current user is a project admin
    try {
      const members = await context.queryClient.fetchQuery({
        queryKey: ['project_members', params.projectId],
        queryFn: () => projectsService.getProjectMembers(params.projectId),
      })

      const isProjectAdmin = members.some(
        (m) => m.uid === context.auth.user!.id && m.role === 'project_admin' && m.is_active
      )

      if (!isProjectAdmin) {
        console.warn('Access denied: User is not a project admin. Redirecting to project model...')
        throw redirect({
          to: '/projects/$projectId/model',
          params: { projectId: params.projectId },
        })
      }
    } catch (err) {
      // If it's a redirect thrown by TanStack Router, rethrow it
      if (err && typeof err === 'object' && 'to' in err) {
        throw err
      }
      console.error('Error verifying project admin status:', err)
      throw redirect({
        to: '/projects/$projectId/model',
        params: { projectId: params.projectId },
      })
    }
  },
  component: SettingsView,
})

