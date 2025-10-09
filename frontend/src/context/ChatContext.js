import React, { createContext, useContext, useState, useCallback } from 'react';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const [currentTextChannel, setCurrentTextChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [showDirectMessages, setShowDirectMessages] = useState(false);
  const [autoSelectUser, setAutoSelectUser] = useState(null);
  const [hasUnreadDMs, setHasUnreadDMs] = useState(false);

  const selectTextChannel = useCallback((channel) => {
    setCurrentTextChannel(channel);
    setShowDirectMessages(false);
  }, []);

  const selectDirectMessages = useCallback(() => {
    setShowDirectMessages(true);
    setCurrentTextChannel(null);
    setHasUnreadDMs(false);
  }, []);

  const exitDirectMessages = useCallback(() => {
    setShowDirectMessages(false);
  }, []);

  const sendMessage = useCallback((selectedUser) => {
    setAutoSelectUser(selectedUser);
    setShowDirectMessages(true);
    setCurrentTextChannel(null);
  }, []);

  const clearAutoSelectUser = useCallback(() => {
    setAutoSelectUser(null);
  }, []);

  const addMessage = useCallback((message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const editMessage = useCallback((editedMessage) => {
    setMessages(prev => prev.map(msg =>
      msg.id === editedMessage.id ? editedMessage : msg
    ));
  }, []);

  const deleteMessage = useCallback((messageId) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  const value = {
    currentTextChannel,
    messages,
    users,
    showDirectMessages,
    autoSelectUser,
    hasUnreadDMs,
    selectTextChannel,
    selectDirectMessages,
    exitDirectMessages,
    sendMessage,
    clearAutoSelectUser,
    setMessages,
    setUsers,
    addMessage,
    editMessage,
    deleteMessage,
    setHasUnreadDMs
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

