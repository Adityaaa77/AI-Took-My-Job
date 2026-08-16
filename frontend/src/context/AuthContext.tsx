// ============================================================================
// DRUG INVENTORY & SUPPLY CHAIN TRACKING SYSTEM (PSS04)
// AuthContext: Authentication, Role-Based Access Control & Quick Role Switcher
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '../types';
import { MOCK_USERS } from '../services/mockData';
import { ApiService } from '../services/api';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  login: (email: string, password?: string, role?: UserRole) => Promise<boolean>;
  logout: () => void;
  switchRole: (newRole: UserRole) => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedRole = (localStorage.getItem('user_role') as UserRole) || 'admin';
    return MOCK_USERS[savedRole] || MOCK_USERS.admin;
  });

  const [token, setToken] = useState<string | null>(() => ApiService.getToken());

  useEffect(() => {
    if (user) {
      localStorage.setItem('user_role', user.role);
    }
  }, [user]);

  const mapToBackendRole = (role: UserRole): 'admin' | 'warehouse_manager' | 'hospital_staff' | 'vendor' => {
    if (role === 'procurement_officer') return 'warehouse_manager';
    if (role === 'compliance_officer') return 'admin';
    return role;
  };

  const login = async (
    email: string,
    password = 'Password123!',
    preferredRole: UserRole = 'admin'
  ): Promise<boolean> => {
    try {
      // 1. Try logging in to live backend
      let res = await ApiService.post<{ token: string; user: User }>('/auth/login', {
        email,
        password,
      });

      // 2. If user doesn't exist yet, automatically register in MongoDB
      if (res.isMock || !res.data?.token) {
        const name = email.split('@')[0].replace('.', ' ').replace(/^./, (c) => c.toUpperCase());
        const regRes = await ApiService.post<{ token: string; user: User }>('/auth/register', {
          name,
          email,
          password,
          role: preferredRole,
        });
        if (!regRes.isMock && regRes.data?.token) {
          res = regRes;
        }
      }

      if (!res.isMock && res.data?.token) {
        ApiService.setToken(res.data.token);
        setToken(res.data.token);
        const backendUser = {
          ...res.data.user,
          role: preferredRole, // preserve UI role
        };
        setUser(backendUser);
        return true;
      }
    } catch {
      // Fall through to resilient mock mode
    }

    const targetUser = MOCK_USERS[preferredRole] || {
      id: `usr_${Date.now()}`,
      name: email.split('@')[0],
      email,
      role: preferredRole,
      is_active: true,
    };

    setUser(targetUser);
    const mockToken = `mock_jwt_token_${targetUser.role}_${Date.now()}`;
    ApiService.setToken(mockToken);
    setToken(mockToken);
    return true;
  };

  const logout = () => {
    setUser(null);
    ApiService.setToken(null);
    setToken(null);
    localStorage.removeItem('user_role');
  };

  const switchRole = (newRole: UserRole) => {
    const newUser = MOCK_USERS[newRole] || MOCK_USERS.admin;
    setUser(newUser);
    localStorage.setItem('user_role', newRole);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'admin',
        isAuthenticated: !!user,
        login,
        logout,
        switchRole,
        token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
