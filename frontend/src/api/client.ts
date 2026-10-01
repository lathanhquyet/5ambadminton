import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Member {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  member_type: 'FIXED' | 'VISITOR';
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  days_per_week: number;
  joined_date: string;
  notes?: string;
  expected_days?: number;
}
