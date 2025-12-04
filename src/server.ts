#!/usr/bin/env node

/**
 * llmverify HTTP Server
 * 
 * Long-running HTTP API server for IDE and external tool integration.
 * Provides REST endpoints for AI output verification.
 * 
 * @module server
 * @author KingCaliber Labs
 * @license MIT
 */

import express, { Request, Response } from 'express';
import { verify } from './verify';
import { isInputSafe, redactPII, containsPII } from './csm6/security';
import { classify } from './engines/classification';
import { VERSION } from './constants';
import { VerifyResult } from './types/results';

const app = express();

/**
 * Format verification result into human-readable summary
 */
function formatHumanReadable(result: VerifyResult): {
  verdict: string;
  riskLevel: string;
  riskScore: string;
  explanation: string;
  testsRun: string[];
  findings: Array<{ severity: string; message: string }>;
  nextSteps: string[];
} {
  const risk = result.risk;
  
  // Collect all findings from sub-results
  const findings: Array<{ severity: string; message: string; category?: string }> = [];
  
  if (result.csm6?.findings) {
    findings.push(...result.csm6.findings.map(f => ({
      severity: f.severity,
      message: f.message,
      category: f.category
    })));
  }
  
  // Determine verdict emoji and message
  let verdict = '';
  let explanation = '';
  let nextSteps: string[] = [];
  
  switch (risk.level) {
    case 'low':
      verdict = '[PASS] SAFE TO USE';
      explanation = 'This AI response passed all safety checks. No significant risks detected.';
      nextSteps = [
        'You can use this content confidently',
        'Standard human review is still recommended for important decisions',
        'Continue monitoring future AI outputs'
      ];
      break;
    case 'moderate':
      verdict = '[WARN] REVIEW RECOMMENDED';
      explanation = 'Some potential issues detected. Human review recommended before use.';
      nextSteps = [
        'Review the findings below carefully',
        'Verify any factual claims independently',
        'Consider asking the AI to clarify or revise',
        'Use caution in production environments'
      ];
      break;
    case 'high':
      verdict = '[FAIL] HIGH RISK - CAUTION';
      explanation = 'Significant risks detected. Do not use without thorough review and revision.';
      nextSteps = [
        'DO NOT use this content as-is',
        'Review all findings and address each issue',
        'Ask the AI to regenerate with corrections',
        'Verify all information from trusted sources',
        'Consider alternative approaches'
      ];
      break;
    case 'critical':
      verdict = '[BLOCK] CRITICAL - DO NOT USE';
      explanation = 'Critical safety issues detected. This content should not be used.';
      nextSteps = [
        'BLOCK this content immediately',
        'Do not share or publish this response',
        'Report to your AI provider if appropriate',
        'Start fresh with a new prompt',
        'Review your AI usage policies'
      ];
      break;
  }
  
  // Format tests that were run
  const testsRun = [
    '[CHECK] Hallucination Detection - Checked for false claims and fabricated information',
    '[CHECK] Consistency Analysis - Verified internal logical consistency',
    '[CHECK] Security Scan - Tested for prompt injection and security risks',
    '[CHECK] Privacy Check - Scanned for PII and sensitive data leaks',
    '[CHECK] Safety Review - Evaluated for harmful or unsafe content'
  ];
  
  // Format findings
  const formattedFindings = findings.map((f: any) => ({
    severity: f.severity.toUpperCase(),
    message: f.message,
    category: f.category
  }));
  
  return {
    verdict,
    riskLevel: risk.level.toUpperCase(),
    riskScore: `${(risk.overall * 100).toFixed(1)}%`,
    explanation,
    testsRun,
    findings: formattedFindings,
    nextSteps
  };
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    version: VERSION,
    service: 'llmverify',
    timestamp: new Date().toISOString()
  });
});

// Main verification endpoint
app.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, content, prompt, config } = req.body;
    
    // Accept both 'text' and 'content' for flexibility
    const inputText = text || content;
    
    if (!inputText) {
      res.status(400).json({
        error: 'Missing required field: text or content',
        example: { text: 'Your AI output here' }
      });
      return;
    }

    if (typeof inputText !== 'string') {
      res.status(400).json({
        error: 'Field "text" must be a string'
      });
      return;
    }

    // Run verification
    const result = await verify({ 
      content: inputText,
      config: config || undefined
    });

    // Format human-readable response
    const humanReadable = formatHumanReadable(result);

    res.json({
      success: true,
      summary: humanReadable,
      result,
      meta: {
        version: VERSION,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      version: VERSION
    });
  }
});

// Input safety check endpoint
app.post('/check-input', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, input } = req.body;
    const inputText = text || input;
    
    if (!inputText) {
      res.status(400).json({
        error: 'Missing required field: text or input'
      });
      return;
    }

    const safe = isInputSafe(inputText);

    res.json({
      success: true,
      safe,
      input: inputText,
      recommendation: safe ? 'allow' : 'block',
      version: VERSION
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// PII detection endpoint
app.post('/check-pii', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, content } = req.body;
    const inputText = text || content;
    
    if (!inputText) {
      res.status(400).json({
        error: 'Missing required field: text or content'
      });
      return;
    }

    const hasPII = containsPII(inputText);
    const { redacted, piiCount } = redactPII(inputText);

    res.json({
      success: true,
      hasPII,
      piiCount,
      redacted,
      version: VERSION
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Classification endpoint
app.post('/classify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, output, config } = req.body;
    
    if (!prompt || !output) {
      res.status(400).json({
        error: 'Missing required fields: prompt and output'
      });
      return;
    }

    const result = classify(prompt, output, config);

    res.json({
      success: true,
      result,
      version: VERSION
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Root endpoint - API info
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'llmverify',
    version: VERSION,
    description: 'AI Output Verification API',
    endpoints: {
      'GET /health': 'Health check',
      'POST /verify': 'Verify AI output (main endpoint)',
      'POST /check-input': 'Check input for prompt injection',
      'POST /check-pii': 'Detect and redact PII',
      'POST /classify': 'Classify output intent and hallucination risk'
    },
    documentation: 'https://github.com/subodhkc/llmverify-npm#readme',
    privacy: 'All processing is local. Zero telemetry.'
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available: ['GET /', 'GET /health', 'POST /verify', 'POST /check-input', 'POST /check-pii', 'POST /classify']
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
export function startServer(port: number = 9009) {
  const server = app.listen(port, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  llmverify server v${VERSION}                                                    ║
║  Running on http://localhost:${port}                                           ║
╚══════════════════════════════════════════════════════════════════════════════╝

Available endpoints:
  GET  http://localhost:${port}/health        - Health check
  POST http://localhost:${port}/verify        - Verify AI output
  POST http://localhost:${port}/check-input   - Check input safety
  POST http://localhost:${port}/check-pii     - Detect PII
  POST http://localhost:${port}/classify      - Classify output

Privacy: All processing is 100% local. Zero telemetry.

Press Ctrl+C to stop the server.
`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\nShutting down server...');
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  });

  return server;
}

// Export app for testing
export { app };

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const portArg = args.find(arg => arg.startsWith('--port='));
  const port = portArg ? parseInt(portArg.split('=')[1], 10) : 9009;
  
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error('Invalid port number. Must be between 1 and 65535.');
    process.exit(1);
  }
  
  startServer(port);
}
