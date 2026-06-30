import { createFileRoute } from '@tanstack/react-router'
import { PowerBIView } from '@/react-components/views'

export const Route = createFileRoute('/projects/$projectId/powerbi')({
  component: PowerBIView,
})
