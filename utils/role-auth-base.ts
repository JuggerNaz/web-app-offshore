export type UserRole = "super_admin" | "company_admin" | "manager" | "inspector" | "viewer";

export const ROLE_HIERARCHY: UserRole[] = [
  "viewer",
  "inspector",
  "manager",
  "company_admin",
  "super_admin",
];

/**
 * Checks if a user role meets the minimum required role based on the hierarchy.
 */
export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const reqIndex = ROLE_HIERARCHY.indexOf(requiredRole);
  return userIndex >= reqIndex;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  designation: string;
  is_active: boolean;
  must_change_password?: boolean;
  last_sign_in: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  serial_no?: string | null;
  registration_no?: string | null;
  tax_id?: string | null;
  company_email?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  country?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  max_users?: number;
  subscription_plan?: string;
  is_active?: boolean;
  logo_url: string | null;
  settings: any;
  created_at: string;
  updated_at: string;
}

export interface CompanyMembership {
  id: string;
  user_id: string;
  company_id: string;
  role: UserRole;
  is_active: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}
