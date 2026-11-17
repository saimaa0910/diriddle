import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface DomainEventEnvelope<T = any> {
  id: string;
  type: string;
  version: number;
  aggregateType: string;
  aggregateId: string;
  correlationId?: string;
  timestamp: string;
  payload: T;
}

export interface DeadLetterEntry {
  event: DomainEventEnvelope;
  error: string;
  attempts: number;
  failedAt: Date;
}

type EventHandler = (event: DomainEventEnvelope) => Promise<void> | void;

@Injectable()
export class DomainEventBusService {
  private readonly logger = new Logger(DomainEventBusService.name);
  private handlers = new Map<string, EventHandler[]>();
  private eventHistory: DomainEventEnvelope[] = [];
  private processedIds = new Set<string>();
  private deadLetterQueue: DeadLetterEntry[] = [];
  private maxHistory = 1000;

  subscribe(eventType: string, handler: EventHandler): void {
    const list = this.handlers.get(eventType) || [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  async publish<T>(
    type: string,
    aggregateType: string,
    aggregateId: string,
    payload: T,
    correlationId?: string,
  ): Promise<DomainEventEnvelope<T>> {
    const sanitizedPayload = this.sanitizePayload(payload);

    const event: DomainEventEnvelope<T> = {
      id: uuidv4(),
      type,
      version: 1,
      aggregateType,
      aggregateId,
      correlationId,
      timestamp: new Date().toISOString(),
      payload: sanitizedPayload,
    };

    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    await this.dispatch(event);
    return event;
  }

  private async dispatch(event: DomainEventEnvelope): Promise<void> {
    if (this.processedIds.has(event.id)) {
      this.logger.warn(`Duplicate event dispatch prevented: ${event.id}`);
      return;
    }
    this.processedIds.add(event.id);

    const listeners = this.handlers.get(event.type) || [];
    for (const handler of listeners) {
      try {
        await handler(event);
      } catch (err: any) {
        this.logger.error(`Handler error for event ${event.type} [${event.id}]: ${err.message}`, err.stack);
        this.deadLetterQueue.push({
          event,
          error: err.message,
          attempts: 1,
          failedAt: new Date(),
        });
      }
    }
  }

  async replay(sinceTimestamp?: string): Promise<number> {
    const cutoff = sinceTimestamp ? new Date(sinceTimestamp).getTime() : 0;
    const toReplay = this.eventHistory.filter(
      (e) => new Date(e.timestamp).getTime() >= cutoff,
    );

    for (const event of toReplay) {
      this.processedIds.delete(event.id);
      await this.dispatch(event);
    }

    return toReplay.length;
  }

  getDeadLetterQueue(): DeadLetterEntry[] {
    return [...this.deadLetterQueue];
  }

  async retryDeadLetter(eventId: string): Promise<boolean> {
    const idx = this.deadLetterQueue.findIndex((d) => d.event.id === eventId);
    if (idx === -1) return false;

    const entry = this.deadLetterQueue[idx];
    this.deadLetterQueue.splice(idx, 1);
    this.processedIds.delete(entry.event.id);
    await this.dispatch(entry.event);
    return true;
  }

  private sanitizePayload<T>(payload: T): T {
    if (!payload || typeof payload !== 'object') return payload;

    const sensitiveKeys = ['password', 'otp', 'phone', 'email', 'lat', 'lng', 'exactGps'];
    const copy: any = Array.isArray(payload) ? [...payload] : { ...payload };

    for (const key of Object.keys(copy)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        copy[key] = '[REDACTED_PRIVACY]';
      } else if (typeof copy[key] === 'object' && copy[key] !== null) {
        copy[key] = this.sanitizePayload(copy[key]);
      }
    }
    return copy;
  }
}
