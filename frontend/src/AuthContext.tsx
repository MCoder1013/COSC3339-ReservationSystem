import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  user_role: "normal" | "staff";
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, setUser: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}