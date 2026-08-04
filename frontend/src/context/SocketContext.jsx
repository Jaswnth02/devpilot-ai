import React, { createContext, useEffect, useState, useContext } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [latestActivity, setLatestActivity] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const socketUrl = 'http://localhost:5001';
    const newSocket = io(socketUrl);

    newSocket.on('connect', () => {
      console.log('Socket.IO connected to backend.');
      newSocket.emit('join_user', user.id);
    });

    newSocket.on('notification', (data) => {
      console.log('Received notification via socket:', data);
      setNotifications(prev => [data, ...prev]);
      
      // Trigger native browser notification if allowed
      if (Notification.permission === 'granted') {
        new Notification(data.title, { body: data.message });
      }
    });

    newSocket.on('github_activity', (data) => {
      console.log('Received GitHub activity update:', data);
      setLatestActivity(data);
    });

    setSocket(newSocket);

    // Request notification permissions
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const joinProjectRoom = (projectId) => {
    if (socket && projectId) {
      socket.emit('join_project', projectId);
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <SocketContext.Provider value={{ socket, notifications, latestActivity, joinProjectRoom, clearNotifications }}>
      {children}
    </SocketContext.Provider>
  );
};
