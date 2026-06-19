// Role type matching the database enum
export type AppRole = 'project_admin' | 'engineer' | 'modeler' | 'viewer';

// Role hierarchy for permission checks (higher index = more permissions)
export const ROLE_HIERARCHY: AppRole[] = ['viewer', 'modeler', 'engineer', 'project_admin'];

// Role display labels
export const ROLE_LABELS: Record<AppRole, string> = {
  project_admin: 'Project Admin',
  engineer: 'Engineer',
  modeler: 'Modeler',
  viewer: 'Viewer',
};

// Role descriptions for UI
export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  project_admin: 'Manage users, projects, members, and all engineer capabilities',
  engineer: 'Add/delete drawings, upload PDFs, plus all modeler capabilities',
  modeler: 'View projects, sync data via Revit (no scan activities access)',
  viewer: 'View projects only (no sync, no scan activities access)',
};

// Helper to check if a role has at least the required permission level
export function hasRoleOrHigher(userRole: AppRole | null, requiredRole: AppRole): boolean {
  if (!userRole) return false;
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
  return userIndex >= requiredIndex;
}

// Helper to check specific permissions
export function canManageUsers(role: AppRole | null): boolean {
  return role === 'project_admin';
}

export function canManageDrawings(role: AppRole | null): boolean {
  return role === 'project_admin' || role === 'engineer';
}

export function canSyncData(role: AppRole | null): boolean {
  return role === 'project_admin' || role === 'engineer' || role === 'modeler';
}

export function canViewScanActivities(role: AppRole | null): boolean {
  return role === 'project_admin' || role === 'engineer';
}
