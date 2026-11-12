import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../database/prisma.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'community' })
export class CommunityGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CommunityGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET', 'dev-secret');
      const payload = await this.jwtService.verifyAsync<{ sub: string; uid?: string }>(token, {
        secret,
      });

      const user = await this.prisma.user.findUnique({
        where: { authId: payload.sub },
      });

      if (!user || user.deletedAt || user.status !== 'ACTIVE') {
        client.disconnect(true);
        return;
      }

      client.data.userId = user.id;
      await client.join(`user:${user.id}`);
      this.logger.debug(`Socket connected: ${client.id} (user=${user.id})`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('community:join')
  async handleJoin(
    @MessageBody() data: { communityId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data?.userId as string | undefined;
    if (!userId || !data?.communityId) {
      return { event: 'error', data: { message: 'Unauthorized or invalid communityId' } };
    }

    const community = await this.prisma.community.findUnique({
      where: { id: data.communityId },
    });
    if (!community || community.status !== 'ACTIVE') {
      return { event: 'error', data: { message: 'Community not found or inactive' } };
    }

    const membership = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId: data.communityId } },
    });
    if (membership?.status === 'BANNED') {
      return { event: 'error', data: { message: 'Access denied for this community' } };
    }

    if (!membership && community.type !== 'CITY') {
      return { event: 'error', data: { message: 'Join community before subscribing' } };
    }

    await client.join(`community:${data.communityId}`);
    return { event: 'community:joined', data: { communityId: data.communityId } };
  }

  @SubscribeMessage('community:leave')
  async handleLeave(
    @MessageBody() data: { communityId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data?.communityId) {
      await client.leave(`community:${data.communityId}`);
    }
    return { event: 'community:left', data: { communityId: data?.communityId } };
  }

  broadcastPostCreated(communityId: string, post: unknown): void {
    if (!this.server) return;
    this.server.to(`community:${communityId}`).emit('post:created', post);
  }

  broadcastCommentCreated(communityId: string, comment: unknown): void {
    if (!this.server) return;
    this.server.to(`community:${communityId}`).emit('comment:created', comment);
  }

  broadcastReactionUpdated(communityId: string, payload: unknown): void {
    if (!this.server) return;
    this.server.to(`community:${communityId}`).emit('reaction:updated', payload);
  }

  sendNotification(userId: string, notification: unknown): void {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken.replace(/^Bearer\s+/i, '');
    }
    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return null;
  }
}
