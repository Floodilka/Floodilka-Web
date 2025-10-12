import React from 'react';
import { AuthProvider } from './AuthContext';
import { ServerProvider } from './ServerContext';
import { ChatProvider } from './ChatContext';
import { VoiceProvider } from './VoiceContext';

/**
 * Главный провайдер, который объединяет все контексты приложения
 */
export const AppProvider = ({ children }) => {
  return (
    <AuthProvider>
      <VoiceProvider>
        <ServerProvider>
          <ChatProvider>
            {children}
          </ChatProvider>
        </ServerProvider>
      </VoiceProvider>
    </AuthProvider>
  );
};

