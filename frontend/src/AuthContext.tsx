import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

export interface User {
  userId: number;
  firstName: string;
  role: string;
  staffRole?: string | null;
  shift?: string | null;
  canEditInventory?: boolean;
  profilePicture?: string | null;
}

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;

  const normalizedRole = String(user.role ?? "").trim().toLowerCase();
  const normalizedStaffRole = String(user.staffRole ?? "").trim().toLowerCase();

  return normalizedRole === "admin" || (normalizedRole === "staff" && normalizedStaffRole === "admin");
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  login: () => {},
  updateUser: () => {},
  logout: () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      const storedUser = localStorage.getItem('user');
      let parsedUser: User | null = null;

      if (storedUser) {
        try {
          parsedUser = JSON.parse(storedUser) as User;
          if (!cancelled) {
            setUser(parsedUser);
          }
        } catch (e) {
          console.error('Failed to parse stored user:', e);
          localStorage.removeItem('user');
        }
      }

      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        });

        if (response.ok) {
          const profile = await response.json();
          const refreshedUser: User = {
            userId: Number(profile.id ?? parsedUser?.userId ?? 0),
            firstName: String(profile.firstName ?? parsedUser?.firstName ?? ''),
            role: String(profile.role ?? parsedUser?.role ?? 'normal'),
            staffRole: profile.staffRole ?? null,
            shift: profile.shift ?? parsedUser?.shift ?? null,
            canEditInventory: Boolean(profile.isStaffAdmin),
            profilePicture: profile.profilePicture ?? profile.profile_picture ?? parsedUser?.profilePicture ?? null,
          };

          if (!cancelled) {
            setUser(refreshedUser);
          }
          localStorage.setItem('user', JSON.stringify(refreshedUser));
        } else if (response.status === 401) {
          localStorage.removeItem('user');
          if (!cancelled) {
            setUser(null);
          }
        }
      } catch {
        // Keep local cached user when profile refresh fails (e.g. backend down).
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }

    };

    initializeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = (userData: User) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      const mergedUser = { ...currentUser, ...updates };
      localStorage.setItem('user', JSON.stringify(mergedUser));
      return mergedUser;
    });
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}