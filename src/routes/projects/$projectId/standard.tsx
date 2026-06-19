import { createFileRoute } from '@tanstack/react-router'
import { ProjectStandardPage } from '@/react-components/ProjectStandardPage'

export const Route = createFileRoute('/projects/$projectId/standard')({
  component: ProjectStandardPage,
})
