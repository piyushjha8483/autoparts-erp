// src/services/api.js
// Axios instance pre-configured with base URL and JWT interceptors

import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("autoparts_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("autoparts_token");
      localStorage.removeItem("autoparts_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
