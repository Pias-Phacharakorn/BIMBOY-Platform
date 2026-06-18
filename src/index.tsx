import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ClashDetectionPage } from "./react-components/ClashDetectionPage";
import { DocumentStatusPage } from "./react-components/DocumentStatusPage";
import { ProjectDetailsPage } from "./react-components/ProjectDetailsPage";
import { ProjectSettingsPage } from "./react-components/ProjectSettingsPage";
import { ProjectStandardPage } from "./react-components/ProjectStandardPage";
import { ProjectsPage } from "./react-components/ProjectsPage";
import { projects } from "./static-data";
import "./style.css";

function App() {
  const defaultProjectId = projects[0]?.id ?? "hxp-ii";

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<Navigate to="model" replace />} />
        <Route path="/projects/:projectId/model" element={<ProjectDetailsPage />} />
        <Route path="/projects/:projectId/standard" element={<ProjectStandardPage />} />
        <Route path="/projects/:projectId/clashes" element={<ClashDetectionPage />} />
        <Route path="/projects/:projectId/documents" element={<DocumentStatusPage />} />
        <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
        <Route path="*" element={<Navigate to={`/projects/${defaultProjectId}/model`} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
