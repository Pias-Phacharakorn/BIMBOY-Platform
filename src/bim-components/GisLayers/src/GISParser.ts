// @ts-nocheck
import { getProjectById } from "../../../classes/ProjectsManager";

export interface IGisLocation {
  latitude: number;
  longitude: number;
  rotation: number;
  height: number;
}

export class GISParser {
  /**
   * Extracts the active project ID from the current window path.
   */
  static getActiveProjectId(): string | null {
    const pathname = window.location.pathname;
    const parts = pathname.split("/");
    const projectsIndex = parts.indexOf("projects");
    if (projectsIndex !== -1 && projectsIndex + 1 < parts.length) {
      return parts[projectsIndex + 1];
    }
    return null;
  }

  /**
   * Fetches the location configuration for the active project from the Firestore cache.
   */
  static getActiveProjectLocation(): IGisLocation {
    const projectId = this.getActiveProjectId();
    if (projectId) {
      const project = getProjectById(projectId);
      if (project && project.location) {
        return {
          latitude: project.location.latitude || 0,
          longitude: project.location.longitude || 0,
          rotation: project.location.rotation || 0,
          height: project.location.elevation || 0, // Maps elevation to height
        };
      }
    }
    // Default London coordinates if project or location configuration is missing
    return {
      latitude: 51.5005,
      longitude: -0.127,
      rotation: 93,
      height: 61.3,
    };
  }
}


  // // London Coordinates //
  // latitude: number = 51.5005;
  // longitude: number = -0.127;
  // rotation: number = 93;
  // height: number = 61.3;

  // Ritta //
  // latitude: number = 13.727941;
  // longitude: number = 100.739648;
  // rotation: number = 45;
  // height: number = 0;

  // PSM DMK //
  // latitude: number = 13.9367;
  // longitude: number = 100.5657;
  // rotation: number = -66;
  // height: number = -18;

  // VOCO //
  // latitude: number = 13.7412;
  // longitude: number = 100.5561;
  // rotation: number = 176.1;
  // height: number = -22;

  // LS21 //
  // latitude: number = 13.7234;
  // longitude: number = 100.5397;
  // rotation: number = -17;
  // height: number = -14.1;
