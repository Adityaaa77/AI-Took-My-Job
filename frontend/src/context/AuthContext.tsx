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
  login: (email: string, role?: UserRole) => Promise<boolean>;
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

  const login = async (email: string, preferredRole: UserRole = 'admin'): Promise<boolean> => {
    try {
      const res = await ApiService.post<{ token: string; user: User }>('/auth/login', {
        email,
        password: 'Password123!',
      });
      if (!res.isMock && res.data?.token) {
        ApiService.setToken(res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        return true;
      }
    } catch {
      // Graceful fallback to mock profile
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
