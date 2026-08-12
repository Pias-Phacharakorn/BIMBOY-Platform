import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useProjectStore } from '@/react-components/store/projectStore'
import { isGuestSession } from '@/lib/guestSession'
import { useEffect } from 'react'

// ─── /projects/$projectId (layout) ────────────────────────────────────────────
export const Route = createFileRoute('/projects/$projectId')({
  // Guests may browse every section of a project except Settings, which edits the
  // project, its members and its storage folders. The sidebar already hides that
  // link (useIsProjectAdmin is false without a session); this catches a hand-typed
  // or bookmarked URL, and sends them to the model rather than to /login — the
  // settings route's own guard would otherwise bounce them out of the demo.
  beforeLoad: ({ context, params, location }) => {
    if ((context.auth?.isGuest || isGuestSession()) && location.pathname.includes('/settings')) {
      throw redirect({
        to: '/projects/$projectId/model',
        params: { projectId: params.projectId },
      })
    }
  },
  component: ProjectLayout,
})

function ProjectLayout() {
  const { projectId } = Route.useParams()
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId)

  // Sync the active project ID to the store when route changes
  useEffect(() => {
    setActiveProjectId(projectId)
    return () => setActiveProjectId(null)
  }, [projectId, setActiveProjectId])

  return <Outlet />
}
