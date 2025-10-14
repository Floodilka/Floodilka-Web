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
    let isMounted = true;

    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setShowAuthModal(false);
      }
    } catch (err) {
      console.warn('Не удалось восстановить локального пользователя из storage', err);
      localStorage.removeItem('user');
    }

    apiService.getCurrentUser()
      .then(currentUser => {
        if (!isMounted) return;
        const normalizedUser = {
          ...currentUser,
          blockedUsers: currentUser.blockedUsers || []
        };
        setUser(normalizedUser);
        setShowAuthModal(false);
        try {
          localStorage.setItem('user', JSON.stringify(normalizedUser));
        } catch (err) {
          console.warn('Не удалось сохранить пользователя в storage', err);
        }
      })
      .catch(err => {
        if (!isMounted) return;
        console.error('Ошибка загрузки данных пользователя:', err);
        setUser(null);
        setShowAuthModal(true);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    try {
      const data = await apiService.login(email, password);

      setUser(data.user);
      setShowAuthModal(false);

      try {
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.removeItem('token');
      } catch (err) {
        console.warn('Не удалось обновить пользователя в storage после логина', err);
      }

      return data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (username, password, email) => {
    try {
      const data = await apiService.register(username, password, email);

      setUser(data.user);
      setShowAuthModal(false);

      try {
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.removeItem('token');
      } catch (err) {
        console.warn('Не удалось обновить пользователя в storage после регистрации', err);
      }

      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (err) {
      console.error('Ошибка при попытке выхода из системы:', err);
    }

    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('lastServerId');
      localStorage.removeItem('lastChannelId');
    } catch (err) {
      console.warn('Не удалось очистить локальное хранилище при выходе', err);
    }

    setUser(null);
    setShowAuthModal(true);
  };

  const updateUser = (updatedUser) => {
    setUser(prevUser => ({
      ...prevUser,
      ...updatedUser,
      blockedUsers: updatedUser.blockedUsers || prevUser?.blockedUsers || []
    }));
    try {
      localStorage.setItem('user', JSON.stringify({
        ...user,
        ...updatedUser,
        blockedUsers: updatedUser.blockedUsers || user?.blockedUsers || []
      }));
    } catch (err) {
      console.warn('Не удалось обновить пользователя в storage', err);
    }
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
