import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ServerProvider, useServer } from './ServerContext';
import { ChatProvider } from './ChatContext';
import { VoiceProvider } from './VoiceContext';
import { SocketProvider } from './SocketContext';
import { GlobalUsersProvider } from './GlobalUsersContext';
import { FriendsProvider } from './FriendsContext';
import LoadingScreen from '../components/LoadingScreen';

const AppLoadingContext = createContext();

export const useAppLoading = () => {
  const context = useContext(AppLoadingContext);
  if (!context) {
    throw new Error('useAppLoading must be used within AppProvider');
  }
  return context;
};

/**
 * Компонент, который отслеживает готовность всех данных
 */
const AppLoadingManager = ({ children }) => {
  const { user, loading: authLoading, showAuthModal } = useAuth();
  const { servers, loading: serversLoading } = useServer();
  const [isAppReady, setIsAppReady] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [loadStartTime] = useState(Date.now());

  useEffect(() => {
    // Если показываем модал авторизации, ждем минимальное время
    if (showAuthModal && !authLoading) {
      const timer = setTimeout(() => {
        setIsAppReady(true);
        setTimeout(() => {
          setInitialLoadComplete(true);
        }, 300);
      }, 500); // Минимум 500мс даже для модала авторизации

      return () => clearTimeout(timer);
    }

    // Если пользователь есть и загрузка завершена
    if (user && !authLoading && !serversLoading) {
      const loadEndTime = Date.now();
      const loadDuration = loadEndTime - loadStartTime;
      const minLoadTime = 1000; // Минимум 1 секунда

      // Вычисляем, сколько еще нужно подождать
      const remainingTime = Math.max(0, minLoadTime - loadDuration);

      // Ждем оставшееся время + небольшая задержка для плавности
      const timer = setTimeout(() => {
        setIsAppReady(true);
        // Даем время для анимации исчезновения
        setTimeout(() => {
          setInitialLoadComplete(true);
        }, 300);
      }, remainingTime);

      return () => clearTimeout(timer);
    }
  }, [user, authLoading, serversLoading, showAuthModal, loadStartTime]);

  const value = {
    isAppReady,
    initialLoadComplete
  };

  return (
    <AppLoadingContext.Provider value={value}>
      {!initialLoadComplete && <LoadingScreen />}
      {initialLoadComplete && children}
    </AppLoadingContext.Provider>
  );
};

/**
 * Главный провайдер, который объединяет все контексты приложения
 */
export const AppProvider = ({ children }) => {
  return (
    <AuthProvider>
      <VoiceProvider>
        <ChatProvider>
          <GlobalUsersProvider>
            <ServerProvider>
              <SocketProvider>
                <FriendsProvider>
                  <AppLoadingManager>
                    {children}
                  </AppLoadingManager>
                </FriendsProvider>
              </SocketProvider>
            </ServerProvider>
          </GlobalUsersProvider>
        </ChatProvider>
      </VoiceProvider>
    </AuthProvider>
  );
};
