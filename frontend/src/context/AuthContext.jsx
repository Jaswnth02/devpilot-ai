import React, { createContext, useState, useEffect } from 'react';
import api from '../utils/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user profile on startup if token is available
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get('/api/auth/me');
        setUser(response.data);
      } catch (err) {
        console.error('Failed to load user session', err);
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { token, user: userData } = response.data;
      if (token) {
        localStorage.setItem('token', token);
        setUser(userData);
      }
      return response.data;
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.error || 'Login failed';
      setError(msg);
      // Pass raw response error data back so caller can inspect requiresVerification
      const customError = new Error(msg);
      customError.response = err.response;
      throw customError;
    }
  };

  const register = async (formData) => {
    setError(null);
    try {
      const response = await api.post('/api/auth/register', formData);
      return response.data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed';
      setError(msg);
      throw new Error(msg);
    }
  };

  const verifyEmail = async ({ email, otp }) => {
    setError(null);
    try {
      const response = await api.post('/api/auth/verify-email', { email, otp });
      return response.data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Email verification failed';
      setError(msg);
      throw new Error(msg);
    }
  };

  const resendOtp = async (email) => {
    setError(null);
    try {
      const response = await api.post('/api/auth/resend-otp', { email });
      return response.data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to resend verification code';
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data);
    } catch (err) {
      console.error('Error refreshing user details:', err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      setError,
      login,
      register,
      verifyEmail,
      resendOtp,
      logout,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};
