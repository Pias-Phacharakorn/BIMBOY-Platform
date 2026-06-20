import { createFileRoute } from '@tanstack/react-router'
import { StandardView } from '@/react-components/views/standard'

export const Route = createFileRoute('/projects/$projectId/standard')({
  component: StandardView,
})
