import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "./useAuth";
import { Icon } from "@/react-components/components/ui";

export function UserAccountDropdown() {
  const { user, profile, signOut, isGuest, exitGuest } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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

  // A guest has no user object at all — render the guest badge instead of nothing.
  if (!user && !isGuest) return null;

  const initials = isGuest
    ? "GU"
    : profile?.email?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "US";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User Logo Button (circle badge with initials) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent-2 text-[oklch(99%_0.004_255)] font-bold text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_4px_12px_rgba(102,126,234,0.2)] cursor-pointer hover:scale-105 active:scale-95 transition-all duration-120 outline-none"
        type="button"
        title="User Account"
      >
        {initials}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-60 p-1.5 rounded-radius border border-border bg-[oklch(14.5%_0.014_255_/_94%)] backdrop-blur-md shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-120">
          {/* User Info Header */}
          <div className="px-3.5 py-3 flex flex-col gap-1 select-none">
            <span className="text-xs text-muted-2 font-bold uppercase tracking-wider">
              {isGuest ? "Viewing as" : "Logged in as"}
            </span>
            <span className="text-sm font-semibold text-fg truncate" title={user?.email ?? "Guest preview"}>
              {isGuest ? "Guest preview" : user?.email}
            </span>
            <span className="inline-flex items-center w-fit px-2 py-0.5 mt-1 rounded-radius-sm text-[10px] font-bold tracking-wide uppercase bg-accent-muted/40 text-accent border border-accent/25">
              {isGuest
                ? "Read-only"
                : profile?.hub_role === "hub_admin"
                  ? "Hub Admin"
                  : "Hub Member"}
            </span>
          </div>

          <div className="h-[1px] bg-border my-1.5" />

          {/* Guests get the sign-up path instead of hub links */}
          {isGuest && (
            <>
              <Link
                to="/login"
                onClick={() => {
                  setIsOpen(false);
                  exitGuest();
                }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-radius-sm text-left text-xs font-semibold text-muted hover:text-fg hover:bg-surface-raised cursor-pointer transition-all duration-120 outline-none no-underline"
              >
                <Icon name="ADD" size={14} className="text-accent" />
                <span>Create an account</span>
              </Link>
              <div className="h-[1px] bg-border my-1.5" />
            </>
          )}

          {/* Hub Administration link */}
          {!isGuest && profile?.hub_role === "hub_admin" && (
            <>
              <Link
                to="/hub-settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-radius-sm text-left text-xs font-semibold text-muted hover:text-fg hover:bg-surface-raised cursor-pointer transition-all duration-120 outline-none no-underline"
              >
                <Icon name="SETTINGS" size={14} className="text-accent" />
                <span>Hub Administration</span>
              </Link>
              <div className="h-[1px] bg-border my-1.5" />
            </>
          )}


          {/* Action item: Sign Out (guests just leave the demo — no session to end) */}
          <button
            onClick={async () => {
              setIsOpen(false);
              if (isGuest) {
                exitGuest();
                return;
              }
              if (window.confirm("Are you sure you want to sign out?")) {
                await signOut();
              }
            }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-radius-sm text-left text-xs font-semibold text-muted hover:text-fg hover:bg-surface-raised cursor-pointer transition-all duration-120 outline-none"
            type="button"
          >
            <Icon name="LOGOUT" size={14} className="text-status-danger" />
            <span>{isGuest ? "Exit demo" : "Sign Out"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
