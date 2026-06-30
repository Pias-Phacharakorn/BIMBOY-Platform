import { v4 as uuidv4 } from 'uuid'

export type ProjectStatus = "pending" | "active" | "finished"
export type UserRole = "architect" | "engineer" | "developer"

export interface IProject {
  projectName: string
  projectnumber: number
  description: string
  status: ProjectStatus
  startDate: Date
  finishDate: Date
  members: string[]
  files: {
    ifc: string
    ifcURL: string
    frag: string
    fragURL: string
    hasModel: boolean
  }
  userRole?: UserRole
  powerbiTabs?: { id: string; tabTitle: string; url: string }[]
}

export class Project implements IProject {
  // To satisfy IProject
  projectName: string
  projectnumber: number
  description: string
  status: ProjectStatus
  startDate: Date
  finishDate: Date
  members: string[]
  files: {
    ifc: string
    ifcURL: string
    frag: string
    fragURL: string
    hasModel: boolean
  }
  userRole?: UserRole
  powerbiTabs?: { id: string; tabTitle: string; url: string }[]

  // Class internals
  cost: number = 0
  progress: number = 0
  id: string

  constructor(data: IProject, id = uuidv4()) {
    for (const key in data) {
      this[key] = data[key]
    }
    this.id = id
  }
}