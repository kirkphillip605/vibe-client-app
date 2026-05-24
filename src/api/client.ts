import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT from localStorage to every request
api.interceptors.request.use((config) => {
  const djToken = localStorage.getItem('dj_token');
  const clientToken = localStorage.getItem('client_token');
  const token = djToken || clientToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
