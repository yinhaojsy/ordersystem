import type { AuthResponse, RolePermissions } from "../types";

/**
 * Check if user has access to a specific section
 */
export function hasSectionAccess(user: AuthResponse | null, section: string): boolean {
  if (!user) return false;
/*   
  // Admin role has access to everything BYPASS ROLES RESTRICTIONS 
  if (user.role === "admin") return true; */
  
  // Check permissions if available
  if (user.permissions?.sections) {
    return user.permissions.sections.includes(section);
  }
  
  // Default: no access if no permissions defined
  return false;
}

/**
 * Check if user has permission for a specific action
 */
export function hasActionPermission(user: AuthResponse | null, action: string): boolean {
  if (!user) return false;
/*   
  // Admin role has all permissions
  if (user.role === "admin") return true; */
  
  // Check permissions if available
  if (user.permissions?.actions) {
    return Boolean(user.permissions.actions[action]);
  }
  
  // Default: no permission if no permissions defined
  return false;
}

/**
 * Get user permissions, defaulting to empty if not available
 */
export function getUserPermissions(user: AuthResponse | null): RolePermissions {
  if (!user || !user.permissions) {
    return { sections: [], actions: {} };
  }
  return user.permissions;
}

