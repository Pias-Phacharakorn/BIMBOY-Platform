import { createFileRoute } from '@tanstack/react-router'
import { ArModelViewer } from '@/react-components/features/ar-viewer/ArModelViewer'

export const Route = createFileRoute('/ar/$projectId')({
  component: ArRoute,
})

function ArRoute() {
  const { projectId } = Route.useParams()
  return <ArModelViewer projectId={projectId} />
}
