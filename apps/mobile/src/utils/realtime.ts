import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL, isDemoSession } from '../api/client';

let socketInstance: Socket | null = null;

export function connectCommunitySocket(token: string | null, communityId: string): Socket | null {
  if (!token || isDemoSession()) {
    return null;
  }

  try {
    if (!socketInstance) {
      socketInstance = io(`${SOCKET_BASE_URL}/community`, {
        auth: { token },
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });
    }
    socketInstance.emit('community:join', { communityId });
    return socketInstance;
  } catch {
    return null;
  }
}

export function disconnectCommunitySocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
