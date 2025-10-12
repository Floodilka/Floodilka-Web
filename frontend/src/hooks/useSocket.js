import { useSocketContext } from '../context/SocketContext';

// Совместимый хук - просто возвращает сокет из контекста
export const useSocket = () => {
  const { socket } = useSocketContext();
  return socket;
};

