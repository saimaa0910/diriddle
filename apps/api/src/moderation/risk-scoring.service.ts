import { Injectable } from '@nestjs/common';

export interface RiskEvaluationResult {
  score: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
  signals: string[];
  recommendation: 'ALLOW' | 'FLAG_FOR_REVIEW' | 'AUTO_BLOCK';
}

@Injectable()
export class RiskScoringService {
  private readonly phoneRegex = /(?:\+?91[\s-]?)?[6789]\d{9}/g;
  private readonly aadhaarRegex = /\b\d{4}\s\d{4}\s\d{4}\b/g;
  private readonly doxxingSignals = ['address is', 'lives at', 'flat no', 'phone number is', 'contact him at'];
  private readonly severeToxicityWords = ['kill yourself', 'bomb', 'terrorist', 'nude', 'cp'];

  evaluateContent(text: string): RiskEvaluationResult {
    if (!text || text.trim().length === 0) {
      return { score: 0.0, confidence: 1.0, signals: [], recommendation: 'ALLOW' };
    }

    const lower = text.toLowerCase();
    const signals: string[] = [];
    let score = 0.0;

    // 1. Phone number disclosure detection
    if (this.phoneRegex.test(text)) {
      signals.push('PHONE_NUMBER_EXPOSURE');
      score += 0.5;
    }

    // 2. National ID / Aadhaar pattern detection
    if (this.aadhaarRegex.test(text)) {
      signals.push('GOVERNMENT_ID_EXPOSURE');
      score += 0.6;
    }

    // 3. Doxxing phrase detection
    for (const phrase of this.doxxingSignals) {
      if (lower.includes(phrase)) {
        signals.push(`DOXXING_PHRASE: ${phrase}`);
        score += 0.4;
        break;
      }
    }

    // 4. Severe toxicity / illegal content
    for (const bad of this.severeToxicityWords) {
      if (lower.includes(bad)) {
        signals.push(`SEVERE_TOXICITY: ${bad}`);
        score += 0.7;
        break;
      }
    }

    // 5. Spam character repetition (e.g., "aaaaaaaaaaa")
    if (/(.)\1{9,}/.test(text)) {
      signals.push('REPETITIVE_CHAR_SPAM');
      score += 0.2;
    }

    const clampedScore = Math.min(Math.max(score, 0.0), 1.0);
    const confidence = signals.length > 0 ? 0.95 : 0.85;

    let recommendation: 'ALLOW' | 'FLAG_FOR_REVIEW' | 'AUTO_BLOCK' = 'ALLOW';
    if (clampedScore >= 0.7) {
      recommendation = 'AUTO_BLOCK';
    } else if (clampedScore >= 0.35) {
      recommendation = 'FLAG_FOR_REVIEW';
    }

    return {
      score: clampedScore,
      confidence,
      signals,
      recommendation,
    };
  }
}
