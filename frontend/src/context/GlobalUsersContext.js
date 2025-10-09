import React, { createContext, useContext, useState } from 'react';

const GlobalUsersContext = createContext();

export const useGlobalUsers = () => {
  const context = useContext(GlobalUsersContext);
  if (!context) {
    throw new Error('useGlobalUsers must be used within GlobalUsersProvider');
  }
  return context;
};

export const GlobalUsersProvider = ({ children }) => {
  const [globalOnlineUsers, setGlobalOnlineUsers] = useState([]);

  const value = {
    globalOnlineUsers,
    setGlobalOnlineUsers
  };

  return <GlobalUsersContext.Provider value={value}>{children}</GlobalUsersContext.Provider>;
};
