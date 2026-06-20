import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useProjectStore } from '@/react-components/store/projectStore'
import { useEffect } from 'react'

// ─── /projects/$projectId (layout) ────────────────────────────────────────────
export const Route = createFileRoute('/projects/$projectId')({
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
