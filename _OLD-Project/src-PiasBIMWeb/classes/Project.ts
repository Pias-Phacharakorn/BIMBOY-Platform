import { v4 as uuidv4 } from "uuid"
import * as Firestore from "firebase/firestore"

export type ProjectStatus = "bidding" | "active" | "finished"
export type UserRole = "architect" | "engineer" | "developer"
export type ProjectView = "card" | "list" | "map";

/**
 * Interface representing the database properties of a project.
 */
export interface IProject {
  projectName: string
  projectnumber: number
  description: string
  status: ProjectStatus
  startDate: Date | Firestore.Timestamp
  finishDate: Date | Firestore.Timestamp
  userRoles?: Record<string, "project admin" | "project member">
  memberPermissions?: Record<string, Record<string, boolean>>
  documentStatusTabs?: Array<{ id: string; tabTitle: string; sectionTitle: string; url: string }>
  memberUids?: string[]
  bimFiles: {
    ifcFolderPath: string
    fragFolderPath: string
    hasModel: boolean
  }
  clashFolderPath?: string
  userRole?: UserRole
  location?: {
    latitude: number
    longitude: number
    rotation: number
    elevation: number
  }
  createdBy?: string
  createdAt?: Date | Firestore.Timestamp
  updatedAt?: Date | Firestore.Timestamp
  isDeleted?: boolean
}

/**
 * Class representing a project model in the application.
 */
export class Project implements IProject {
  projectName: string
  projectnumber: number
  description: string
  status: ProjectStatus
  startDate: Date
  finishDate: Date
  userRoles: Record<string, "project admin" | "project member">
  memberPermissions: Record<string, Record<string, boolean>>
  documentStatusTabs?: Array<{ id: string; tabTitle: string; sectionTitle: string; url: string }>
  memberUids: string[]
  bimFiles: {
    ifcFolderPath: string
    fragFolderPath: string
    hasModel: boolean
  }
  clashFolderPath?: string
  userRole?: UserRole
  location?: {
    latitude: number
    longitude: number
    rotation: number
    elevation: number
  }
  createdBy: string
  createdAt: Date
  updatedAt: Date
  isDeleted: boolean

  // Class internals
  cost: number = 0
  progress: number = 0
  id: string

  /**
   * Getter returning the list of member emails for this project.
   */
  get members(): string[] {
    return Object.keys(this.userRoles || {});
  }

  constructor(data: IProject, id = uuidv4()) {
    this.projectName = data.projectName;
    this.projectnumber = data.projectnumber;
    this.description = data.description || "";
    this.status = data.status || "active";
    this.bimFiles = data.bimFiles || { ifcFolderPath: "", fragFolderPath: "", hasModel: false };
    this.clashFolderPath = data.clashFolderPath;
    this.userRole = data.userRole;
    this.location = data.location;
    this.userRoles = data.userRoles || {};
    this.memberPermissions = data.memberPermissions || {};
    this.documentStatusTabs = data.documentStatusTabs;
    this.memberUids = data.memberUids || [];
    this.id = id;
    this.createdBy = data.createdBy || "";
    this.isDeleted = data.isDeleted || false;

    const parseDate = (val: any): Date => {
      if (val instanceof Firestore.Timestamp) {
        return val.toDate();
      } else if (val instanceof Date) {
        return val;
      } else if (typeof val === "string" || typeof val === "number") {
        return new Date(val);
      }
      return new Date();
    };

    this.startDate = parseDate(data.startDate);
    this.finishDate = parseDate(data.finishDate);
    this.createdAt = parseDate(data.createdAt || data.startDate);
    this.updatedAt = parseDate(data.updatedAt || data.finishDate);
  }
}

const projectImage = new URL("../../__New_UI-Design/mp9tdjw6-image.png", import.meta.url).href;

export type BadgeTone = "ok" | "warn" | "danger" | "neutral" | "info";

export interface ProjectDisplay {
  code: string;
  label: string;
  estimatedCompletion: string;
  startDateLabel: string;
  finishDateLabel: string;
  statusLabel: string;
  statusTone: Extract<BadgeTone, "ok" | "warn" | "info">;
  progress: number;
  image: string;
}

export interface AppProject extends Project {
  display: ProjectDisplay;
}

/**
 * Generates presentation metadata for displaying a project in the UI.
 * 
 * @param project - The project instance.
 * @returns UI display metadata.
 */
export const getDisplayForProject = (project: Project): ProjectDisplay => {
  const startDate = project.startDate instanceof Date ? project.startDate : new Date();
  const finishDate = project.finishDate instanceof Date ? project.finishDate : new Date();
  const statusLower = (project.status || "").toLowerCase();

  const statusLabel =
    statusLower === "active" ? "Active" :
    statusLower === "bidding" ? "Bidding" :
    "Finished";

  const statusTone: Extract<BadgeTone, "ok" | "warn" | "info"> =
    statusLower === "active" ? "ok" :
    statusLower === "bidding" ? "warn" :
    "info";

  return {
    code: project.projectName.substring(0, 3).toUpperCase(),
    label: `${project.projectnumber}`,
    estimatedCompletion: finishDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
    startDateLabel: startDate.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }),
    finishDateLabel: finishDate.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }),
    statusLabel,
    statusTone,
    progress: project.progress || 0,
    image: projectImage,
  };
};

/**
 * Decorates a project instance with presentation metadata for rendering.
 * 
 * @param project - The project instance.
 * @returns The decorated project instance.
 */
export const getAppProject = (project: Project): AppProject => {
  return Object.assign(project, { display: getDisplayForProject(project) }) as AppProject;
};