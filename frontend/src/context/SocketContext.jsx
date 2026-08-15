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

    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const socketUrl = isLocalhost ? 'http://localhost:5001' : (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : ''));
    
    let newSocket;
    try {
      newSocket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        timeout: 10000
      });
    } catch (e) {
      console.warn('Socket connection note:', e);
      return;
    }

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
