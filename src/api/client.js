import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true, timeout: 15000 });

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const auth = {
  login: (u, p) => api.post('/auth?action=login', { username: u, password: p }),
  logout: () => api.post('/auth?action=logout'),
  me: () => api.get('/auth?action=me'),
};
export const getDashboard = () => api.get('/dashboard');
export const getTransactions = (p) => api.get('/transactions', { params: p });
export const getTransaction = (id) => api.get(`/transactions/${id}`);
export const cancelTransaction = (id) => api.patch(`/transactions/${id}`, { action: 'cancel' });
export const getSettings = () => api.get('/settings');
export const saveSettings = (data) => api.post('/settings', data);
export const getLogs = (p) => api.get('/logs', { params: p });
export const clearLogs = () => api.delete('/logs');

export default api;
