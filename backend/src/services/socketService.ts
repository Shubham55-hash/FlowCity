import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

class SocketService {
  private io: SocketIOServer | null = null;

  public init(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*', // In production, restrict this to the frontend URL
        methods: ['GET', 'POST'],
      },
    });

    this.io.on('connection', (socket) => {
      console.log(`🔌 New client connected: ${socket.id}`);

      // Allow users to join a specific room for their journey
      socket.on('join_journey', (journeyId: string) => {
        socket.join(`journey_${journeyId}`);
        console.log(`👤 Client ${socket.id} joined journey: ${journeyId}`);
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });

    return this.io;
  }

  public emitJourneyUpdate(journeyId: string, event: string, data: any) {
    if (!this.io) {
      console.error('Socket.io not initialized!');
      return;
    }
    this.io.to(`journey_${journeyId}`).emit(event, data);
  }

  public emitToUser(socketId: string, event: string, data: any) {
    if (!this.io) return;
    this.io.to(socketId).emit(event, data);
  }
}

export const socketService = new SocketService();
