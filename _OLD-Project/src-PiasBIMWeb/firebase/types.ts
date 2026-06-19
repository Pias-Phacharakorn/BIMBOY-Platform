import { Timestamp } from "firebase/firestore";

/**
 * Represents the role a user can have at the organization/hub level.
 */
export type HubRole = "hub_admin" | "hub_member";

/**
 * Represents the role a user can have within a specific project.
 */
export type ProjectRole = "project_admin" | "project_member";

/**
 * Represents the current progress status of a project.
 */
export type ProjectStatus = "bidding" | "active" | "finished";

/**
 * Interface representing a user's global profile document in Firestore.
 * Document ID must be the Firebase Auth UID.
 */
export interface UserProfile {
  /** The unique identifier of the user (Firebase Auth UID). */
  uid: string;
  /** The user's primary email address. */
  email: string;
  /** The role of the user within the hub. */
  hubRole: HubRole;
  /** Indicates whether the user's account is currently active. */
  isActive: boolean;
  /** Timestamp when the user profile was created. */
  createdAt: Timestamp;
  /** Timestamp when the user profile was last updated. */
  updatedAt: Timestamp;
}

/**
 * Interface representing a project document in Firestore.
 * Document ID is a unique UUID.
 */
export interface Project {
  /** The unique project ID. */
  id: string;
  /** The name of the project. */
  projectName: string;
  /** The identification number of the project. */
  projectnumber: number;
  /** A description of the project. */
  description: string;
  /** The current status of the project. */
  status: ProjectStatus;
  /** The project start date. */
  startDate: Timestamp;
  /** The project completion date. */
  finishDate: Timestamp;
  /** Paths and status details of the BIM files. */
  bimFiles: {
    /** Cloud storage folder path for IFC uploads. */
    ifcFolderPath: string;
    /** Cloud storage folder path for FRAG format files. */
    fragFolderPath: string;
    /** Whether the project currently has a compiled model. */
    hasModel: boolean;
  };
  /** Cloud storage folder path for clash reports. */
  clashFolderPath?: string;
  /** Spatial/geographic placement configuration of the model. */
  location?: {
    latitude: number;
    longitude: number;
    rotation: number;
    elevation: number;
  };
  /** The UID of the user who created this project. */
  createdBy: string;
  /** Timestamp when the project was created. */
  createdAt: Timestamp;
  /** Timestamp when the project was last updated. */
  updatedAt: Timestamp;
  /** Indicates if the project is soft deleted. */
  isDeleted: boolean;
  /** Array of active member UIDs to support index-free filtering */
  memberUids: string[];
}

/**
 * Interface representing a member of a project in the members subcollection.
 * Path: `projects/{projectId}/members/{uid}`
 */
export interface ProjectMember {
  /** The unique identifier of the member user (Firebase Auth UID). */
  uid: string;
  /** The email address of the member. */
  email: string;
  /** The role of the user within the scope of the project. */
  role: ProjectRole;
  /** The UID of the user who added this member to the project. */
  addedBy: string;
  /** Timestamp when the member was added to the project. */
  addedAt: Timestamp;
  /** Indicates if the membership is currently active. */
  isActive: boolean;
}

/**
 * Interface representing an entry in the project audit log subcollection.
 * Path: `projects/{projectId}/auditLogs/{logId}`
 */
export interface AuditLog {
  /** The action performed (e.g. "PROJECT_CREATE", "MEMBER_ADD", etc.). */
  action: string;
  /** The UID of the user who performed the action. */
  performedBy: string;
  /** Timestamp when the action was performed. */
  timestamp: Timestamp;
  /** A dictionary tracking changed fields, mapping field name to change details. */
  diff: Record<string, { oldVal: any; newVal: any }>;
  /** The IP address from which the request was made. */
  ipAddress: string;
}
