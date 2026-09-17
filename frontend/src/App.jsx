import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import EnquiriesPage from "./pages/EnquiriesPage";
import QuotationsPage from "./pages/QuotationsPage";
import SalesOrdersPage from "./pages/SalesOrdersPage";

const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/enquiries" replace />} />
            <Route path="enquiries" element={<EnquiriesPage />} />
            <Route path="quotations" element={<QuotationsPage />} />
            <Route path="sales-orders" element={<SalesOrdersPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
