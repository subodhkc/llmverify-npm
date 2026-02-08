/**
 * IDE Extension for llmverify
 * Auto-verify AI responses in real-time
 */

import { verify as localVerify } from './verify';

export interface VerificationResult {
  verdict: string;
  riskLevel: string;
  riskScore: number;
  explanation: string;
  safe: boolean;
}

export class LLMVerifyIDE {
  private serverUrl: string;
  private enabled: boolean;
  private useLocalFallback: boolean;
  
  constructor(serverUrl: string = 'http://localhost:9009', options?: { useLocalFallback?: boolean }) {
    this.serverUrl = serverUrl;
    this.enabled = true;
    this.useLocalFallback = options?.useLocalFallback ?? true;
  }
  
  /**
   * Verify AI response and return formatted result
   */
  async verify(content: string): Promise<VerificationResult> {
    try {
      const response = await fetch(`${this.serverUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data: any = await response.json();
      const risk = data.result.risk;
      const score = Math.round(risk.overall * 100 * 10) / 10;
      
      let verdict = '';
      let safe = false;
      
      switch (risk.level) {
        case 'low':
          verdict = '[PASS] SAFE TO USE';
          safe = true;
          break;
        case 'moderate':
          verdict = '[WARN] REVIEW RECOMMENDED';
          safe = false;
          break;
        case 'high':
          verdict = '[FAIL] HIGH RISK';
          safe = false;
          break;
        case 'critical':
          verdict = '[BLOCK] CRITICAL RISK';
          safe = false;
          break;
      }
      
      return {
        verdict,
        riskLevel: risk.level.toUpperCase(),
        riskScore: score,
        explanation: risk.interpretation,
        safe
      };
      
    } catch (error: any) {
      if (this.useLocalFallback) {
        return this.verifyLocal(content);
      }
      throw new Error(`Verification failed: ${error.message}. Tip: Start server with 'npx llmverify-serve' or enable local fallback.`);
    }
  }
  
  /**
   * Local fallback verification (no server required)
   */
  private async verifyLocal(content: string): Promise<VerificationResult> {
    const result = await localVerify({ content });
    const risk = result.risk;
    const score = Math.round(risk.overall * 100 * 10) / 10;

    let verdict = '';
    let safe = false;

    switch (risk.level) {
      case 'low':
        verdict = '[PASS] SAFE TO USE (local)';
        safe = true;
        break;
      case 'moderate':
        verdict = '[WARN] REVIEW RECOMMENDED (local)';
        safe = false;
        break;
      case 'high':
        verdict = '[FAIL] HIGH RISK (local)';
        safe = false;
        break;
      case 'critical':
        verdict = '[BLOCK] CRITICAL RISK (local)';
        safe = false;
        break;
    }

    return {
      verdict,
      riskLevel: risk.level.toUpperCase(),
      riskScore: score,
      explanation: risk.interpretation,
      safe
    };
  }

  /**
   * Format result for inline display
   */
  formatInline(result: VerificationResult): string {
    return `[llmverify] ${result.verdict} (Risk: ${result.riskScore}%)`;
  }
  
  /**
   * Format result for detailed display
   */
  formatDetailed(result: VerificationResult): string {
    return `
===========================================
 LLMVERIFY RESULTS
===========================================

 ${result.verdict}
 Risk Level: ${result.riskLevel}
 Risk Score: ${result.riskScore}%

 ${result.explanation}

===========================================
`.trim();
  }
  
  /**
   * Check if server is available
   */
  async isServerAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET'
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * Enable/disable verification
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Create IDE extension instance
 */
export function createIDEExtension(serverUrl?: string): LLMVerifyIDE {
  return new LLMVerifyIDE(serverUrl);
}
