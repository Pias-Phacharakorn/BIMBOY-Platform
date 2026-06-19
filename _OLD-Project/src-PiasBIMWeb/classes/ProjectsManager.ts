import { IProject, Project } from "./Project"
import { getCollection, firestoreDB, auth } from "../firebase/index"
import * as Firestore from "firebase/firestore"
import { v4 as uuidv4 } from "uuid"

/**
 * Manager class responsible for projects CRUD operations and syncing Firestore state.
 */
export class ProjectsManager {
  /** Local cache of all loaded projects. */
  list: Project[] = []
  
  private listeners = {
    loaded: new Set<(projects: Project[]) => void>(),
    created: new Set<(project: Project) => void>(),
    deleted: new Set<(id: string) => void>()
  };

  /**
   * Registers a callback for when projects are loaded.
   */
  onProjectsLoaded(cb: (projects: Project[]) => void) {
    this.listeners.loaded.add(cb);
    return () => { this.listeners.loaded.delete(cb); };
  }

  /**
   * Registers a callback for when a new project is created.
   */
  onProjectCreated(cb: (project: Project) => void) {
    this.listeners.created.add(cb);
    return () => { this.listeners.created.delete(cb); };
  }

  /**
   * Registers a callback for when a project is deleted (soft-deleted).
   */
  onProjectDeleted(cb: (id: string) => void) {
    this.listeners.deleted.add(cb);
    return () => { this.listeners.deleted.delete(cb); };
  }

  private collectionPath = "projects"
  private unsubscribe: (() => void) | null = null

  constructor() {
    // Subscription managed externally by AuthContext
  }

  private notifyLoaded() {
    for (const cb of this.listeners.loaded) {
      cb(this.list);
    }
  }

  /**
   * Sets up a real-time listener for the projects collection.
   * Leverages subcollections membership and handles hub admin roles properly.
   * 
   * @param uid - The current user's UID.
   * @param isHubAdmin - True if the user has a hub_admin role.
   */
  setupRealtimeListener(uid: string, isHubAdmin: boolean) {
    this.dispose();
    console.log(`Setting up Firestore real-time listener for 'projects' (${isHubAdmin ? "Hub Admin" : "member: " + uid})...`);

    // Clean-up variables
    let projectListeners = new Map<string, { unsubProj: () => void; unsubMembers: () => void }>();
    let projectCache = new Map<string, Project>();

    const updateProjectInCache = (projectId: string, data: IProject, userRoles: Record<string, "project admin" | "project member">, memberPermissions: Record<string, Record<string, boolean>>) => {
      const project = new Project({ ...data, userRoles, memberPermissions }, projectId);
      projectCache.set(projectId, project);
      this.list = Array.from(projectCache.values());
      this.notifyLoaded();
    };

    const removeProjectFromCache = (projectId: string) => {
      projectCache.delete(projectId);
      this.list = Array.from(projectCache.values());
      this.notifyLoaded();
    };

    const subscribeToProject = (projectId: string) => {
      if (projectListeners.has(projectId)) return;

      const projectRef = Firestore.doc(firestoreDB, this.collectionPath, projectId);
      const membersRef = Firestore.collection(firestoreDB, `${this.collectionPath}/${projectId}/members`);

      let localProjectData: IProject | null = null;
      let localUserRoles: Record<string, "project admin" | "project member"> = {};
      let localMemberPermissions: Record<string, Record<string, boolean>> = {};

      const unsubProj = Firestore.onSnapshot(projectRef, (projSnap) => {
        if (projSnap.exists() && !projSnap.data().isDeleted) {
          localProjectData = projSnap.data() as IProject;
          updateProjectInCache(projectId, localProjectData, localUserRoles, localMemberPermissions);
        } else {
          localProjectData = null;
          removeProjectFromCache(projectId);
        }
      }, (err) => {
        console.error(`Error listening to project ${projectId}:`, err);
      });

      const unsubMembers = Firestore.onSnapshot(membersRef, (membersSnap) => {
        const userRoles: Record<string, "project admin" | "project member"> = {};
        const memberPermissions: Record<string, Record<string, boolean>> = {};
        membersSnap.docs.forEach((doc) => {
          const mData = doc.data();
          if (mData.isActive) {
            const mappedRole = mData.role === "project_admin" ? "project admin" : "project member";
            userRoles[mData.email] = mappedRole;
            memberPermissions[mData.email] = mData.allowedPages || {
              model: true,
              standard: true,
              clashes: true,
              documents: true
            };
          }
        });
        localUserRoles = userRoles;
        localMemberPermissions = memberPermissions;
        if (localProjectData) {
          updateProjectInCache(projectId, localProjectData, localUserRoles, localMemberPermissions);
        }
      }, (err) => {
        console.error(`Error listening to members of project ${projectId}:`, err);
      });

      projectListeners.set(projectId, { unsubProj, unsubMembers });
    };

    const unsubscribeFromProject = (projectId: string) => {
      const listener = projectListeners.get(projectId);
      if (listener) {
        listener.unsubProj();
        listener.unsubMembers();
        projectListeners.delete(projectId);
      }
      removeProjectFromCache(projectId);
    };

    if (isHubAdmin) {
      // Hub Admin: listen to all active (non-soft-deleted) projects directly
      const q = Firestore.query(
        getCollection<IProject>(this.collectionPath),
        Firestore.where("isDeleted", "==", false)
      );

      const unsubAllProj = Firestore.onSnapshot(q, (snapshot) => {
        const activeIds = new Set<string>();
        snapshot.docs.forEach((doc) => {
          activeIds.add(doc.id);
          subscribeToProject(doc.id);
        });

        // Clean up projects that are no longer present or deleted
        for (const pid of projectListeners.keys()) {
          if (!activeIds.has(pid)) {
            unsubscribeFromProject(pid);
          }
        }

        if (activeIds.size === 0) {
          this.list = [];
          this.notifyLoaded();
        }
      }, (error) => {
        console.error("Firestore listener error for Hub Admin:", error);
      });

      this.unsubscribe = () => {
        unsubAllProj();
        projectListeners.forEach((l) => {
          l.unsubProj();
          l.unsubMembers();
        });
        projectListeners.clear();
        projectCache.clear();
      };
    } else {
      // Regular Hub Member: listen to projects where the user is a member
      const q = Firestore.query(
        getCollection<IProject>(this.collectionPath),
        Firestore.where("isDeleted", "==", false),
        Firestore.where("memberUids", "array-contains", uid)
      );

      const unsubAllProj = Firestore.onSnapshot(q, (snapshot) => {
        const activeIds = new Set<string>();
        snapshot.docs.forEach((doc) => {
          activeIds.add(doc.id);
          subscribeToProject(doc.id);
        });

        // Clean up projects that are no longer present or deleted
        for (const pid of projectListeners.keys()) {
          if (!activeIds.has(pid)) {
            unsubscribeFromProject(pid);
          }
        }

        if (activeIds.size === 0) {
          this.list = [];
          this.notifyLoaded();
        }
      }, (error) => {
        console.error("Firestore listener error for Hub Member:", error);
      });

      this.unsubscribe = () => {
        unsubAllProj();
        projectListeners.forEach((l) => {
          l.unsubProj();
          l.unsubMembers();
        });
        projectListeners.clear();
        projectCache.clear();
      };
    }

  }

  /**
   * Disposes of any active real-time listeners.
   */
  dispose() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private async fetchProjectMembersData(projectId: string): Promise<{
    userRoles: Record<string, "project admin" | "project member">;
    memberPermissions: Record<string, Record<string, boolean>>;
  }> {
    const userRoles: Record<string, "project admin" | "project member"> = {};
    const memberPermissions: Record<string, Record<string, boolean>> = {};
    try {
      const membersCol = Firestore.collection(firestoreDB, `${this.collectionPath}/${projectId}/members`);
      const snap = await Firestore.getDocs(membersCol);
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.isActive) {
          userRoles[data.email] = data.role === "project_admin" ? "project admin" : "project member";
          memberPermissions[data.email] = data.allowedPages || {
            model: true,
            standard: true,
            clashes: true,
            documents: true
          };
        }
      });
    } catch (e) {
      console.error(`Error loading members for project ${projectId}:`, e);
    }
    return { userRoles, memberPermissions };
  }

  /**
   * Performs a one-time load of projects.
   */
  async loadProjects(): Promise<Project[]> {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];

    let isHubAdmin = true;

    if (isHubAdmin) {
      const q = Firestore.query(
        getCollection<IProject>(this.collectionPath),
        Firestore.where("isDeleted", "==", false)
      );
      const querySnapshot = await Firestore.getDocs(q);
      const projects: Project[] = [];
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        const { userRoles, memberPermissions } = await this.fetchProjectMembersData(docSnap.id);
        projects.push(new Project({ ...data, userRoles, memberPermissions }, docSnap.id));
      }
      this.list = projects;
    } else {
      const q = Firestore.query(
        getCollection<IProject>(this.collectionPath),
        Firestore.where("isDeleted", "==", false),
        Firestore.where("memberUids", "array-contains", currentUser.uid)
      );
      const querySnapshot = await Firestore.getDocs(q);
      const projects: Project[] = [];
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        const { userRoles, memberPermissions } = await this.fetchProjectMembersData(docSnap.id);
        projects.push(new Project({ ...data, userRoles, memberPermissions }, docSnap.id));
      }
      this.list = projects;
    }
    return this.list;
  }

  /**
   * Filters the cached project list by matching strings in project name.
   */
  filterProjects(value: string) {
    const filteredProject = this.list.filter((project) => {
      return project.projectName.toLowerCase().includes(value.toLowerCase())
    })
    return filteredProject
  }

  /**
   * Creates a new project in Firestore and registers the creator as project_admin.
   * Runs inside an atomic transaction.
   * 
   * @param data - The project properties.
   * @param id - Optional predefined project ID.
   * @returns The created project instance.
   */
  async newProject(data: IProject, id?: string): Promise<Project> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("User must be authenticated to create a project");

    try {
      const projectId = id || uuidv4();
      const projectRef = Firestore.doc(firestoreDB, this.collectionPath, projectId);
      const memberRef = Firestore.doc(firestoreDB, `${this.collectionPath}/${projectId}/members`, currentUser.uid);

      await Firestore.runTransaction(firestoreDB, async (transaction) => {
        const now = Firestore.serverTimestamp();
        
        const cleanData: any = {
          projectName: data.projectName || "New Project",
          projectnumber: Number(data.projectnumber) || 0,
          description: data.description || "",
          status: data.status || "active",
          startDate: data.startDate instanceof Date ? Firestore.Timestamp.fromDate(data.startDate) : (data.startDate || now),
          finishDate: data.finishDate instanceof Date ? Firestore.Timestamp.fromDate(data.finishDate) : (data.finishDate || now),
          bimFiles: {
            ifcFolderPath: (data.bimFiles?.ifcFolderPath || "").trim().replace(/^\/+|\/+$/g, ""),
            fragFolderPath: (data.bimFiles?.fragFolderPath || "").trim().replace(/^\/+|\/+$/g, ""),
            hasModel: data.bimFiles?.hasModel || false
          },
          clashFolderPath: (data.clashFolderPath || "").trim().replace(/^\/+|\/+$/g, ""),
          location: data.location || { latitude: 0, longitude: 0, rotation: 0, elevation: 0 },
          createdBy: currentUser.uid,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
          memberUids: [currentUser.uid],
          userRolesMap: {
            [currentUser.uid]: "project_admin"
          }
        };

        const memberData = {
          uid: currentUser.uid,
          email: currentUser.email || "",
          role: "project_admin",
          addedBy: currentUser.uid,
          addedAt: now,
          isActive: true,
          allowedPages: {
            model: true,
            standard: true,
            clashes: true,
            documents: true
          },
          updatedAt: now
        };

        transaction.set(projectRef, cleanData);
        transaction.set(memberRef, memberData);
      });

      const project = new Project({
        projectName: data.projectName || "New Project",
        projectnumber: Number(data.projectnumber) || 0,
        description: data.description || "",
        status: data.status || "active",
        startDate: data.startDate instanceof Date ? data.startDate : new Date(),
        finishDate: data.finishDate instanceof Date ? data.finishDate : new Date(),
        bimFiles: data.bimFiles || { ifcFolderPath: "", fragFolderPath: "", hasModel: false },
        clashFolderPath: data.clashFolderPath || "",
        location: data.location || { latitude: 51.5005, longitude: -0.127, rotation: 93, elevation: 61.3 },
        createdBy: currentUser.uid,
        isDeleted: false,
        memberUids: [currentUser.uid],
        userRoles: { [currentUser.email || ""]: "project admin" },
        memberPermissions: {
          [currentUser.email || ""]: {
            model: true,
            standard: true,
            clashes: true,
            documents: true
          }
        }
      }, projectId);
      for (const cb of this.listeners.created) {
        cb(project);
      }
      return project;
    } catch (error) {
      console.error("Error creating project in Firestore:", error);
      throw error;
    }
  }

  /**
   * Gets a project from the local cache.
   */
  getProject(id: string) {
    return this.list.find((project) => project.id === id)
  }

  /**
   * Soft-deletes a project by setting `isDeleted = true` in Firestore.
   */
  async deleteProject(id: string) {
    try {
      const projectRef = Firestore.doc(firestoreDB, this.collectionPath, id);
      await Firestore.updateDoc(projectRef, {
        isDeleted: true,
        updatedAt: Firestore.serverTimestamp()
      });
      for (const cb of this.listeners.deleted) {
        cb(id);
      }
      console.log(`Successfully soft-deleted project ${id}`);
    } catch (error) {
      console.error("Error soft-deleting project from Firestore:", error);
      throw error;
    }
  }

  /**
   * Adds or updates a project member in the members subcollection.
   */
  async addProjectMember(projectId: string, email: string, role: "project admin" | "project member") {
    try {
      const emailClean = email.trim().toLowerCase();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Unauthenticated");

      // Query users collection by email to find the matching UID
      const usersQuery = Firestore.query(
        Firestore.collection(firestoreDB, "users"),
        Firestore.where("email", "==", emailClean)
      );
      const userSnapshot = await Firestore.getDocs(usersQuery);

      if (userSnapshot.empty) {
        throw new Error(`User with email ${emailClean} has not registered in the system yet.`);
      }

      const targetUserDoc = userSnapshot.docs[0];
      const targetUid = targetUserDoc.id;

      const memberRef = Firestore.doc(firestoreDB, `${this.collectionPath}/${projectId}/members`, targetUid);
      const mappedRole = role === "project admin" ? "project_admin" : "project_member";
      
      await Firestore.setDoc(memberRef, {
        uid: targetUid,
        email: emailClean,
        role: mappedRole,
        addedBy: currentUser.uid,
        addedAt: Firestore.serverTimestamp(),
        isActive: true,
        allowedPages: {
          model: true,
          standard: true,
          clashes: true,
          documents: true
        },
        updatedAt: Firestore.serverTimestamp()
      });

      // Update memberUids and userRolesMap in parent project document
      const projectRef = Firestore.doc(firestoreDB, this.collectionPath, projectId);
      await Firestore.updateDoc(projectRef, {
        memberUids: Firestore.arrayUnion(targetUid),
        [`userRolesMap.${targetUid}`]: role === "project admin" ? "project_admin" : "project_member",
        updatedAt: Firestore.serverTimestamp()
      });
      
      console.log(`Successfully added member ${emailClean} as ${role} to project ${projectId}`);
    } catch (error) {
      console.error("Error adding project member in Firestore:", error);
      throw error;
    }
  }

  /**
   * Deactivates a project member by setting `isActive = false` in the members subcollection.
   */
  async removeProjectMember(projectId: string, email: string) {
    try {
      const emailClean = email.trim().toLowerCase();
      
      // Find the user's membership in the project
      const membersQuery = Firestore.query(
        Firestore.collection(firestoreDB, `${this.collectionPath}/${projectId}/members`),
        Firestore.where("email", "==", emailClean)
      );
      const memberSnapshot = await Firestore.getDocs(membersQuery);
      
      if (memberSnapshot.empty) {
        throw new Error(`Membership not found for ${emailClean} in project ${projectId}`);
      }
      
      const memberDoc = memberSnapshot.docs[0];
      const targetUid = memberDoc.id; // Document ID is user's UID

      await Firestore.updateDoc(memberDoc.ref, {
        isActive: false,
        updatedAt: Firestore.serverTimestamp()
      });

      // Update memberUids and userRolesMap in parent project document
      const projectRef = Firestore.doc(firestoreDB, this.collectionPath, projectId);
      await Firestore.updateDoc(projectRef, {
        memberUids: Firestore.arrayRemove(targetUid),
        [`userRolesMap.${targetUid}`]: Firestore.deleteField(),
        updatedAt: Firestore.serverTimestamp()
      });
      
      console.log(`Successfully deactivated member ${emailClean} from project ${projectId}`);
    } catch (error) {
      console.error("Error removing project member from Firestore:", error);
      throw error;
    }
  }

  /**
   * Updates a project member's page visibility permissions in Firestore.
   */
  async updateProjectMemberPermissions(projectId: string, email: string, allowedPages: Record<string, boolean>) {
    try {
      const emailClean = email.trim().toLowerCase();
      // Find the user's membership document in the project
      const membersQuery = Firestore.query(
        Firestore.collection(firestoreDB, `${this.collectionPath}/${projectId}/members`),
        Firestore.where("email", "==", emailClean)
      );
      const memberSnapshot = await Firestore.getDocs(membersQuery);
      
      if (memberSnapshot.empty) {
        throw new Error(`Membership not found for ${emailClean} in project ${projectId}`);
      }
      
      const memberDoc = memberSnapshot.docs[0];
      await Firestore.updateDoc(memberDoc.ref, {
        allowedPages: allowedPages,
        updatedAt: Firestore.serverTimestamp()
      });
      console.log(`Successfully updated member ${emailClean} permissions in project ${projectId}`);
    } catch (error) {
      console.error("Error updating member permissions in Firestore:", error);
      throw error;
    }
  }

  /**
   * Updates a project's parameters in Firestore.
   */
  async updateProject(projectId: string, data: Partial<IProject>) {
    try {
      const projectRef = Firestore.doc(firestoreDB, this.collectionPath, projectId)
      const cleanData = { ...data } as any
      
      if (cleanData.bimFiles) {
        cleanData.bimFiles = {
          ifcFolderPath: (cleanData.bimFiles.ifcFolderPath || "").trim().replace(/^\/+|\/+$/g, ""),
          fragFolderPath: (cleanData.bimFiles.fragFolderPath || "").trim().replace(/^\/+|\/+$/g, ""),
          hasModel: Boolean(cleanData.bimFiles.hasModel)
        };
      }
      if (cleanData.clashFolderPath !== undefined) {
        cleanData.clashFolderPath = (cleanData.clashFolderPath || "").trim().replace(/^\/+|\/+$/g, "");
      }
      
      if (cleanData.startDate instanceof Date) {
        cleanData.startDate = Firestore.Timestamp.fromDate(cleanData.startDate)
      }
      if (cleanData.finishDate instanceof Date) {
        cleanData.finishDate = Firestore.Timestamp.fromDate(cleanData.finishDate)
      }
      
      cleanData.updatedAt = Firestore.serverTimestamp();
      
      await Firestore.updateDoc(projectRef, cleanData)
      console.log(`Successfully updated project ${projectId} in Firestore`)
    } catch (error) {
      console.error("Error updating project in Firestore:", error)
      throw error
    }
  }
  
  /**
   * Exports the loaded project list to a local JSON file.
   */
  async exportToJSON(fileName: string = "projects") {
    try {
      const json = JSON.stringify(this.list, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error exporting projects to JSON:", error);
    }
  }
  
  /**
   * Imports projects from a local JSON file and saves them to Firestore.
   */
  importFromJSON() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    const reader = new FileReader()
    reader.addEventListener("load", () => {
      const json = reader.result
      if (!json) { return }
      const projects: IProject[] = JSON.parse(json as string)
      for (const project of projects) {
        try {
          const projectId = (project as any).id;
          this.newProject(project, projectId)
        } catch (error) {
          console.error("Error importing project:", error)
        }
      }
    })
    input.addEventListener('change', () => {
      const filesList = input.files
      if (!filesList) { return }
      reader.readAsText(filesList[0])
    })
    input.click()
  }
}

import { getAppProject, AppProject } from "./Project";

export const projectsManager = new ProjectsManager();

export const getProjectById = (id?: string): AppProject | null => {
  const project = projectsManager.getProject(id || "") || projectsManager.list[0];
  return project ? getAppProject(project) : null;
};