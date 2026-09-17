// src/context/AuthContext.jsx
// Global authentication state via React Context

import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on first load
  useEffect(() => {
    const storedToken = localStorage.getItem("autoparts_token");
    const storedUser  = localStorage.getItem("autoparts_user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = (tokenValue, userValue) => {
    localStorage.setItem("autoparts_token", tokenValue);
    localStorage.setItem("autoparts_user", JSON.stringify(userValue));
    setToken(tokenValue);
    setUser(userValue);
  };

  const logout = () => {
    localStorage.removeItem("autoparts_token");
    localStorage.removeItem("autoparts_user");
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === "ADMIN";
  const isSales = user?.role === "SALES_USER";

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isSales }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
