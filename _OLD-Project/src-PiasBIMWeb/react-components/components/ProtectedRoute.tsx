import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

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
          Verifying session...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
