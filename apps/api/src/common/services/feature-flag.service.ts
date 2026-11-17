import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage: number; // 0 to 100
  allowedUserIds?: string[];
  allowedCities?: string[];
  description?: string;
  updatedAt: Date;
}

@Injectable()
export class FeatureFlagService {
  private flags = new Map<string, FeatureFlag>([
    [
      'video_uploads_enabled',
      {
        key: 'video_uploads_enabled',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Enables 180s video uploads in post creation',
        updatedAt: new Date(),
      },
    ],
    [
      'realtime_reactions_v2',
      {
        key: 'realtime_reactions_v2',
        enabled: true,
        rolloutPercentage: 50,
        description: 'New websocket batching for post reactions',
        updatedAt: new Date(),
      },
    ],
    [
      'ai_toxicity_prefilter',
      {
        key: 'ai_toxicity_prefilter',
        enabled: true,
        rolloutPercentage: 100,
        description: 'Automated pre-filtering of toxic words and doxxing patterns',
        updatedAt: new Date(),
      },
    ],
  ]);

  isEnabled(key: string, context?: { userId?: string; city?: string; allowedUserIds?: string[] }): boolean {
    const flag = this.flags.get(key);
    if (!flag || !flag.enabled) {
      return false;
    }

    if (flag.rolloutPercentage >= 100) {
      return true;
    }

    if (flag.allowedUserIds && context?.userId && flag.allowedUserIds.includes(context.userId)) {
      return true;
    }

    if (flag.allowedCities && context?.city && flag.allowedCities.includes(context.city)) {
      return true;
    }

    if (context?.userId) {
      // Deterministic hash bucket (0-99)
      const hash = crypto.createHash('md5').update(`${flag.key}:${context.userId}`).digest('hex');
      const bucket = parseInt(hash.substring(0, 4), 16) % 100;
      return bucket < flag.rolloutPercentage;
    }

    return flag.rolloutPercentage > 0;
  }

  setFlag(flag: Partial<FeatureFlag> & { key: string }): FeatureFlag {
    const existing = this.flags.get(flag.key) || {
      key: flag.key,
      enabled: false,
      rolloutPercentage: 0,
      updatedAt: new Date(),
    };

    const updated: FeatureFlag = {
      ...existing,
      ...flag,
      updatedAt: new Date(),
    };

    this.flags.set(flag.key, updated);
    return updated;
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  rollback(key: string): FeatureFlag | null {
    const flag = this.flags.get(key);
    if (!flag) return null;
    flag.enabled = false;
    flag.rolloutPercentage = 0;
    flag.updatedAt = new Date();
    return flag;
  }
}
