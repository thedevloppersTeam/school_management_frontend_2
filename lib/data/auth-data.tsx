export type UserType = 'SYSTEM_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT'

// Kept for backward compatibility with existing frontend code
export type UserRole = 'admin' | 'teacher' | 'student' | 'parent'

export interface AuthUser {
  id: string
  firstname: string
  lastname: string
  username: string
  type: UserType
  isActive: boolean
}

export function getRoleRoute(type: UserType): string {
  switch (type) {
    case 'SYSTEM_ADMIN':
    case 'ADMIN':
      return '/admin/dashboard'
    case 'TEACHER':
      return '/teacher/dashboard'
    case 'STUDENT':
      return '/student/dashboard'
    case 'PARENT':
      return '/parent/dashboard'
    default:
      return '/login'
  }
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}

// Legacy — no longer used, kept to avoid import errors in files not yet updated
export const getCurrentUser = () => null
export const setCurrentUser = (_user: unknown) => {}
