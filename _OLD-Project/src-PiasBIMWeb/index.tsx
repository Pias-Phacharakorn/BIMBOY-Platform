// Filter harmless startup/three warnings before any library loads
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const msg = args.join(" ");
  if (
    msg.includes("Multiple instances of Three.js being imported") ||
    msg.includes("SpotCoordinate cannot be activated without a world") ||
    msg.includes("Resizing the world was not possible")
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { ClashPage } from "./react-components/pages/ClashPage";
import { DocumentsPage } from "./react-components/pages/DocumentsPage";
import { ModelsPage } from "./react-components/pages/ModelsPage";
import { SettingsPage } from "./react-components/pages/SettingsPage";
import { StandardPage } from "./react-components/pages/StandardPage";
import { ProjectsPage } from "./react-components/pages/ProjectsPage";
import { HubSettingsPage } from "./react-components/pages/HubSettingsPage";
import { LoginPage } from "./react-components/pages/auth/LoginPage";
import { ProtectedRoute } from "./react-components/components/ProtectedRoute";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { projectsManager, getProjectById } from "./classes/ProjectsManager";
import { getAppProject } from "./classes/Project";
import "./style.css";


function HubAdminRoute({ children }: { children: React.ReactNode }) {
  const { isHubAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div 
        style={{ 
          display: "flex", 
          flexDirection: "column",
          justifyContent: "center", 
          alignItems: "center", 
          height: "100vh", 
          width: "100vw",
          background: "var(--bg)",
          color: "var(--fg)",
          gap: "16px"
        }}
      >
        <div 
          style={{
            width: "40px",
            height: "40px",
            border: "3px solid var(--border)",
            borderTop: "3px solid var(--accent)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}
        />

        <p style={{ color: "var(--muted)", fontSize: "14px", fontWeight: 500 }}>
          Verifying hub permissions...
        </p>
      </div>
    );
  }

  if (!isHubAdmin) {
    return <Navigate to="/projects" replace />;
  }

  return <>{children}</>;
}

function ProjectAdminRoute({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams();
  const { projectRoles, loadingRoles } = useAuth();

  if (loadingRoles) {
    return (
      <div 
        style={{ 
          display: "flex", 
          flexDirection: "column",
          justifyContent: "center", 
          alignItems: "center", 
          height: "100vh", 
          width: "100vw",
          background: "var(--bg)",
          color: "var(--fg)",
          gap: "16px"
        }}
      >
        <div 
          style={{
            width: "40px",
            height: "40px",
            border: "3px solid var(--border)",
            borderTop: "3px solid var(--accent)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}
        />

        <p style={{ color: "var(--muted)", fontSize: "14px", fontWeight: 500 }}>
          Verifying permissions...
        </p>
      </div>
    );
  }

  const role = projectId ? projectRoles[projectId] : null;

  if (role !== "project_admin") {
    return <Navigate to={`/projects/${projectId}/model`} replace />;
  }

  return <>{children}</>;
}

interface ProjectPageRouteProps {
  pageKey: "model" | "standard" | "clashes" | "documents";
  children: React.ReactNode;
}

function ProjectPageRoute({ pageKey, children }: ProjectPageRouteProps) {
  const { projectId } = useParams();
  const { user, isHubAdmin, projectRoles, loadingRoles } = useAuth();

  if (loadingRoles) {
    return (
      <div 
        style={{ 
          display: "flex", 
          flexDirection: "column",
          justifyContent: "center", 
          alignItems: "center", 
          height: "100vh", 
          width: "100vw",
          background: "var(--bg)",
          color: "var(--fg)",
          gap: "16px"
        }}
      >
        <div 
          style={{
            width: "40px",
            height: "40px",
            border: "3px solid var(--border)",
            borderTop: "3px solid var(--accent)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite"
          }}
        />

        <p style={{ color: "var(--muted)", fontSize: "14px", fontWeight: 500 }}>
          Verifying permissions...
        </p>
      </div>
    );
  }

  const project = getProjectById(projectId);
  if (!project) {
    return <Navigate to="/projects" replace />;
  }

  const role = projectId ? projectRoles[projectId] : null;
  const isProjAdmin = isHubAdmin || role === "project_admin";
  if (isProjAdmin) {
    return <>{children}</>;
  }

  const emailClean = user?.email?.trim().toLowerCase() || "";
  const allowedPages = project.memberPermissions?.[emailClean] || {
    model: true,
    standard: true,
    clashes: true,
    documents: true
  };

  const isAllowed = allowedPages[pageKey] !== false;
  if (!isAllowed) {
    const possibleKeys: ("model" | "standard" | "clashes" | "documents")[] = ["model", "standard", "clashes", "documents"];
    const firstAllowedKey = possibleKeys.find(key => allowedPages[key] !== false) || "model";
    console.warn(`Access denied to page '${pageKey}' on project ${projectId}. Redirecting to first authorized page '${firstAllowedKey}'...`);
    return <Navigate to={`/projects/${projectId}/${firstAllowedKey}`} replace />;
  }

  return <>{children}</>;
}

function App() {
  const [defaultProjectId, setDefaultProjectId] = useState<string | null>(null);

  useEffect(() => {
    // Basic reactivity to update default project when loaded
    const updateDefaultId = () => {
       const apps = projectsManager.list.map(p => getAppProject(p));
       if (apps.length > 0) {
           setDefaultProjectId(apps[0].id);
       }
    };
    
    const unsub = projectsManager.onProjectsLoaded(updateDefaultId);
    updateDefaultId(); // run once to check
    
    return () => unsub();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Secure protected routes */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Navigate to="/projects" replace />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/projects" 
          element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/hub-settings" 
          element={
            <ProtectedRoute>
              <HubAdminRoute>
                <HubSettingsPage />
              </HubAdminRoute>
            </ProtectedRoute>
          } 
        />
        {defaultProjectId && (
          <Route 
            path="/projects/:projectId" 
            element={
              <ProtectedRoute>
                <Navigate to="model" replace />
              </ProtectedRoute>
            } 
          />
        )}
        <Route 
          path="/projects/:projectId/model" 
          element={
            <ProtectedRoute>
              <ProjectPageRoute pageKey="model">
                <ModelsPage />
              </ProjectPageRoute>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/projects/:projectId/standard" 
          element={
            <ProtectedRoute>
              <ProjectPageRoute pageKey="standard">
                <StandardPage />
              </ProjectPageRoute>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/projects/:projectId/clashes" 
          element={
            <ProtectedRoute>
              <ProjectPageRoute pageKey="clashes">
                <ClashPage />
              </ProjectPageRoute>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/projects/:projectId/documents" 
          element={
            <ProtectedRoute>
              <ProjectPageRoute pageKey="documents">
                <DocumentsPage />
              </ProjectPageRoute>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/projects/:projectId/settings" 
          element={
            <ProtectedRoute>
              <ProjectAdminRoute>
                <SettingsPage />
              </ProjectAdminRoute>
            </ProtectedRoute>
          } 
        />
        
        <Route 
           path="*" 
           element={
             <ProtectedRoute>
               {defaultProjectId 
                 ? <Navigate to={`/projects/${defaultProjectId}/model`} replace />
                 : <Navigate to="/projects" replace />}
             </ProtectedRoute>
           } 
        />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);

