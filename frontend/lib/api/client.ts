import axios from 'axios';
import { env } from '@/lib/config/env';

export const apiClient = axios.create({
  baseURL: env.API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// 요청 인터셉터
apiClient.interceptors.request.use(
  (config) => {
    // 추후 인증 토큰 추가
    // const token = localStorage.getItem('auth_token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터 (에러 메시지 표준화)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error?.message || '오류가 발생했습니다';
    return Promise.reject(new Error(message));
  }
);
