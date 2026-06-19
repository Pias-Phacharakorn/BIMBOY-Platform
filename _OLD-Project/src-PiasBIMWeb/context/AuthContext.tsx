import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type User, onAuthStateChanged } from "firebase/auth";
import { 
  doc, 
  onSnapshot, 
  query, 
  collection,
  collectionGroup, 
  where, 
  runTransaction, 
  serverTimestamp 
} from "firebase/firestore";
import { auth, firestoreDB } from "../firebase";
import { projectsManager } from "../classes/ProjectsManager";
import { 
  loginWithEmail, 
  registerWithEmail, 
  loginWithGoogle, 
  logoutUser 
} from "../firebase/auth";

/**
 * Interface defining the properties exposed by the AuthContext.
 */
interface AuthContextType {
  /** The currently logged-in Firebase Auth User object, or null. */
  user: User | null;
  /** True if the authentication state is loading. */
  loading: boolean;
  /** The user's role at the hub level (hub_admin or hub_member). */
  hubRole: "hub_admin" | "hub_member" | null;
  /** True if the user has a hub_admin role. */
  isHubAdmin: boolean;
  /** A dictionary mapping projectId to projectRole. */
  projectRoles: Record<string, "project_admin" | "project_member">;
  /** True if the user's project roles are loading. */
  loadingRoles: boolean;
  /** Helper to login with email and password. */
  loginWithEmail: typeof loginWithEmail;
  /** Helper to register a user with email and password. */
  registerWithEmail: typeof registerWithEmail;
  /** Helper to login with Google credentials. */
  loginWithGoogle: typeof loginWithGoogle;
  /** Helper to sign out the user. */
  logoutUser: typeof logoutUser;
  /**
   * Helper function to get the current user's role in a specific project.
   * 
   * @param projectId - The project ID.
   * @returns The project role, or null if the user is not a member.
   */
  getProjectRole: (projectId: string) => "project_admin" | "project_member" | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Context Provider component managing authentication state and real-time syncing.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hubRole, setHubRole] = useState<"hub_admin" | "hub_member" | null>(null);
  const [rawProjectRoles, setRawProjectRoles] = useState<Record<string, "project_admin" | "project_member">>({});
  const [projectRoles, setProjectRoles] = useState<Record<string, "project_admin" | "project_member">>({});
  const [loadingRoles, setLoadingRoles] = useState(false);

  const isHubAdmin = hubRole === "hub_admin";

  // Derive projectRoles dynamically:
  // - If the user is a hub_admin, grant them "project_admin" role on all projects.
  // - Otherwise, fallback to raw project memberships loaded from the database.
  useEffect(() => {
    if (isHubAdmin) {
      const updateAdminRoles = () => {
        const roles: Record<string, "project_admin" | "project_member"> = {};
        projectsManager.list.forEach((p) => {
          roles[p.id] = "project_admin";
        });
        setProjectRoles(roles);
      };
      
      const unsub = projectsManager.onProjectsLoaded(updateAdminRoles);
      updateAdminRoles();
      return () => unsub();
    } else {
      setProjectRoles(rawProjectRoles);
    }
  }, [isHubAdmin, rawProjectRoles]);

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;
    let unsubProjectRoles: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Clean up previous listeners
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }
      if (unsubProjectRoles) {
        unsubProjectRoles();
        unsubProjectRoles = null;
      }

      if (currentUser) {
        const userDocRef = doc(firestoreDB, "users", currentUser.uid);
        
        // Transaction check-and-create to prevent race conditions on first login
        try {
          await runTransaction(firestoreDB, async (transaction) => {
            const docSnap = await transaction.get(userDocRef);
            if (!docSnap.exists()) {
              transaction.set(userDocRef, {
                uid: currentUser.uid,
                email: currentUser.email?.trim().toLowerCase() || "",
                hubRole: "hub_member",
                isActive: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
            }
          });
        } catch (err) {
          console.error("Error creating auto-join user doc inside transaction:", err);
        }

        // 1. Listen to the user's global profile document
        unsubUserDoc = onSnapshot(userDocRef, (docSnap) => {
          let role: "hub_admin" | "hub_member" = "hub_member";
          if (docSnap.exists()) {
            role = docSnap.data().hubRole || "hub_member";
          }
          
          setHubRole(role);
          
          // 2. Setup real-time project listener inside projectsManager
          projectsManager.setupRealtimeListener(currentUser.uid, role === "hub_admin");
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user profile doc:", error);
          setLoading(false);
        });

        // 3. Listen to project roles in real-time by querying projects where the user is a member
        setLoadingRoles(true);
        const projectsQuery = query(
          collection(firestoreDB, "projects"),
          where("isDeleted", "==", false),
          where("memberUids", "array-contains", currentUser.uid)
        );

        unsubProjectRoles = onSnapshot(projectsQuery, (snapshot) => {
          const roles: Record<string, "project_admin" | "project_member"> = {};
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const userRolesMap = data.userRolesMap || {};
            const role = userRolesMap[currentUser.uid];
            roles[docSnap.id] = role === "project_admin" ? "project_admin" : "project_member";
          });
          setRawProjectRoles(roles);
          setLoadingRoles(false);
        }, (error) => {
          console.error("Error listening to projects for roles:", error);
          setLoadingRoles(false);
        });

      } else {
        // Clear all state on logout
        setHubRole(null);
        setRawProjectRoles({});
        setProjectRoles({});
        projectsManager.dispose();
        projectsManager.list = [];
        setLoading(false);
        setLoadingRoles(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
      if (unsubProjectRoles) unsubProjectRoles();
    };
  }, []);

  /**
   * Helper function to query the current user's role inside a specific project.
   */
  const getProjectRole = (projectId: string): "project_admin" | "project_member" | null => {
    if (isHubAdmin) return "project_admin";
    return projectRoles[projectId] || null;
  };

  const value: AuthContextType = {
    user,
    loading,
    hubRole,
    isHubAdmin,
    projectRoles,
    loadingRoles,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    logoutUser,
    getProjectRole
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * React hook to access authentication context properties.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
