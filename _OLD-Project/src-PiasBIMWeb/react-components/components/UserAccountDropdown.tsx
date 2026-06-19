import { useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { Icon } from "./Icon";
import { useUIStore } from "../store/uiStore";

export function UserAccountDropdown() {
  const isOpen = useUIStore((state) => state.userDropdownOpen);
  const setIsOpen = useUIStore((state) => state.setUserDropdownOpen);
  const { user, logoutUser } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = user?.email ? user.email.substring(0, 2).toUpperCase() : "US";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="user-dropdown-container" ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={toggleDropdown}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          fontSize: "12px",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          transition: "transform 0.15s ease",
          outline: "none"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
        title={user?.email || "User Account"}
      >
        {initials}
      </button>

      {isOpen && (
        <div
          className="user-dropdown-menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 1000,
            width: "220px",
            padding: "12px",
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-1)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            animation: "fadeIn 0.15s ease-out"
          }}
        >
          <div style={{ paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-2)", fontWeight: 700, display: "block", marginBottom: "2px" }}>
              Account Info
            </span>
            <span style={{ fontSize: "12px", color: "var(--fg)", fontWeight: 500, wordBreak: "break-all", display: "block" }}>
              {user?.email || "Unknown User"}
            </span>
          </div>

          <button
            onClick={logoutUser}
            className="btn btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              justifyContent: "flex-start",
              width: "100%",
              padding: "8px 10px",
              fontSize: "12px",
              color: "var(--status-danger)",
              border: "1px solid transparent",
              background: "transparent",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              transition: "all 0.12s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "oklch(63% 0.18 28 / 8%)";
              e.currentTarget.style.borderColor = "oklch(63% 0.18 28 / 20%)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            <Icon name="LOGOUT" size={14} />
            <span>Log Out</span>
          </button>
        </div>
      )}
    </div>
  );
}
