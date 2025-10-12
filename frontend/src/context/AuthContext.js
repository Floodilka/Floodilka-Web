import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Проверка сохраненного токена при загрузке
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setShowAuthModal(false);
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setShowAuthModal(true);
      }
    } else {
      setShowAuthModal(true);
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const data = await apiService.login(email, password);

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setUser(data.user);
      setShowAuthModal(false);

      return data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (username, password, email) => {
    try {
      const data = await apiService.register(username, password, email);

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setUser(data.user);
      setShowAuthModal(false);

      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastServerId');
    localStorage.removeItem('lastChannelId');

    setUser(null);
    setShowAuthModal(true);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    loading,
    showAuthModal,
    login,
    register,
    logout,
    updateUser,
    setShowAuthModal
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

