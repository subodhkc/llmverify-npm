#!/usr/bin/env node

/**
 * llmverify CLI
 * 
 * Command-line interface for AI output verification.
 * 
 * @module cli
 * @author Haiec
 * @license MIT
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { verify } from './verify';
import { VERSION, PRIVACY_GUARANTEE } from './constants';
import { Config, DEFAULT_CONFIG } from './types/config';
import { VerifyResult, Finding } from './types/results';

const program = new Command();

program
  .name('llmverify')
  .description('AI Output Verification Toolkit - Local-first, privacy-preserving')
  .version(VERSION, '-V, --version', 'Output the version number')
  .addHelpText('beforeAll', chalk.cyan(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  llmverify v${VERSION} — AI Output Verification Toolkit                          ║
║  Local-first • Zero telemetry • Privacy-preserving                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
`))
  .addHelpText('after', `
${chalk.bold('Core Commands:')}
  ${chalk.cyan('run')}         ${chalk.yellow('★')} Master command - run all engines with presets (dev/prod/strict/fast/ci)
  ${chalk.cyan('verify')}      Run multi-engine verification on AI output (default)
  ${chalk.cyan('engines')}     List all verification engines with status
  ${chalk.cyan('explain')}     Explain how a specific engine works
  ${chalk.cyan('adapters')}    List available LLM provider adapters

${chalk.bold('Setup & Config:')}
  ${chalk.cyan('wizard')}      ${chalk.yellow('★')} Interactive setup wizard for first-time users
  ${chalk.cyan('presets')}     List available preset configurations
  ${chalk.cyan('init')}        Initialize llmverify.config.json
  ${chalk.cyan('doctor')}      Check system health and configuration
  ${chalk.cyan('privacy')}     Show privacy guarantees

${chalk.bold('Help & Info:')}
  ${chalk.cyan('info')}        Show package info, docs, and funding links
  ${chalk.cyan('tutorial')}    Show usage examples and quick start guide

${chalk.bold('Quick Examples:')}
  ${chalk.green('$ npx llmverify run "AI output" --preset dev')}       ${chalk.dim('# Master command')}
  ${chalk.green('$ npx llmverify run "AI output" --preset prod')}      ${chalk.dim('# Production mode')}
  ${chalk.green('$ npx llmverify wizard')}                             ${chalk.dim('# First-time setup')}
  ${chalk.green('$ npx llmverify verify "Your AI response here"')}
  ${chalk.green('$ npx llmverify doctor')}

${chalk.bold('Exit Codes (CI/CD):')}
  ${chalk.green('0')} = Low risk (allow)
  ${chalk.yellow('1')} = Moderate risk (review)
  ${chalk.red('2')} = High/Critical risk (block)

${chalk.bold('Documentation:')}
  README:          ${chalk.blue('https://github.com/subodhkc/llmverify-npm#readme')}
  CLI Reference:   ${chalk.blue('docs/CLI-REFERENCE.md')}
  Troubleshooting: ${chalk.blue('docs/TROUBLESHOOTING.md')}

${chalk.yellow('☕ Support development:')} npm fund or https://www.buymeacoffee.com/subodhkc
`);

program
  .command('verify', { isDefault: true })
  .description('Verify AI output for risks')
  .argument('[content]', 'Content to verify (or use --file)')
  .option('-f, --file <path>', 'Read content from file')
  .option('-j, --json', 'Content is JSON')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v, --verbose', 'Verbose output')
  .option('-o, --output <format>', 'Output format: text, json', 'text')
  .action(async (content: string | undefined, options) => {
    try {
      // Get content
      let inputContent = content;
      
      if (options.file) {
        const filePath = path.resolve(options.file);
        if (!fs.existsSync(filePath)) {
          console.error(chalk.red(`File not found: ${filePath}`));
          process.exit(1);
        }
        inputContent = fs.readFileSync(filePath, 'utf-8');
      }
      
      if (!inputContent) {
        console.error(chalk.red('No content provided. Use --file or provide content as argument.'));
        program.help();
        process.exit(1);
      }
      
      // Load config
      let config: Partial<Config> = {};
      if (options.config) {
        const configPath = path.resolve(options.config);
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
      }
      
      if (options.verbose) {
        config.output = { 
          verbose: true,
          includeEvidence: true,
          includeMethodology: true,
          includeLimitations: true
        };
      }
      
      // Run verification
      console.log(chalk.blue('\n🔍 Running llmverify...\n'));
      
      const result = await verify({
        content: inputContent,
        config,
        context: {
          isJSON: options.json
        }
      });
      
      // Output results
      if (options.output === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printTextResult(result, options.verbose);
      }
      
      // Exit code based on risk level
      const exitCodes: Record<string, number> = {
        low: 0,
        moderate: 1,
        high: 2,
        critical: 2
      };
      
      process.exit(exitCodes[result.risk.level] || 0);
      
    } catch (error) {
      console.error(chalk.red(`\nError: ${(error as Error).message}`));
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize llmverify config file')
  .action(() => {
    const configPath = path.resolve('llmverify.config.json');
    
    if (fs.existsSync(configPath)) {
      console.log(chalk.yellow('Config file already exists: llmverify.config.json'));
      return;
    }
    
    try {
      const { createDefaultConfigFile } = require('./config');
      createDefaultConfigFile();
      console.log(chalk.green('[OK] Created llmverify.config.json'));
      console.log(chalk.dim('  Edit this file to customize your verification settings'));
    } catch (error) {
      // Fallback to inline config creation
      const config = {
        tier: 'free',
        engines: DEFAULT_CONFIG.engines,
        performance: DEFAULT_CONFIG.performance,
        output: DEFAULT_CONFIG.output
      };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(chalk.green('[OK] Created llmverify.config.json'));
    }
  });

program
  .command('privacy')
  .description('Show privacy guarantees')
  .action(() => {
    console.log(chalk.blue('\n📋 llmverify Privacy Guarantees\n'));
    
    console.log(chalk.green('Free Tier:'));
    console.log(`  • Network Traffic: ${PRIVACY_GUARANTEE.freeTier.networkTraffic}`);
    console.log(`  • Data Transmission: ${PRIVACY_GUARANTEE.freeTier.dataTransmission}`);
    console.log(`  • Telemetry: ${PRIVACY_GUARANTEE.freeTier.telemetry}`);
    console.log(`  • Verification: ${PRIVACY_GUARANTEE.freeTier.verification}`);
    
    console.log(chalk.yellow('\nPaid Tiers:'));
    console.log(`  • Default: ${PRIVACY_GUARANTEE.paidTiers.defaultBehavior}`);
    console.log(`  • API Calls: ${PRIVACY_GUARANTEE.paidTiers.apiCalls}`);
    console.log(`  • Requires: ${PRIVACY_GUARANTEE.paidTiers.requires}`);
    
    console.log(chalk.red('\nWe NEVER:'));
    PRIVACY_GUARANTEE.neverEver.forEach(item => {
      console.log(`  [FAIL] ${item}`);
    });
    
    console.log();
  });

// ============================================================================
// COMMAND: info
// ============================================================================

program
  .command('info')
  .description('Show package info, docs, privacy, and funding options')
  .option('--json', 'Output as JSON')
  .action((options) => {
    const info = {
      name: 'llmverify',
      version: VERSION,
      maintainer: 'Subodh KC (HAIEC)',
      engines: [
        'classification (intent, hallucination, reasoning)',
        'CSM6 (security, PII, harmful content, injection)',
        'hallucination detection',
        'drift analysis',
        'latency monitoring',
        'token-rate tracking'
      ],
      docs: {
        readme: 'README.md',
        cli: 'docs/CLI.md',
        engines: 'docs/ENGINES.md',
        api: 'docs/API.md'
      },
      privacy: 'No telemetry, no remote logging. All analysis local.',
      funding: 'https://www.buymeacoffee.com/subodhkc'
    };
    
    if (options.json) {
      console.log(JSON.stringify(info, null, 2));
      return;
    }
    
    console.log(chalk.blue('\n📦 llmverify Package Information\n'));
    
    console.log(chalk.bold('Package'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  ${chalk.cyan('Name:')}        ${info.name}`);
    console.log(`  ${chalk.cyan('Version:')}     ${info.version}`);
    console.log(`  ${chalk.cyan('Maintainer:')}  ${info.maintainer}`);
    console.log();
    
    console.log(chalk.bold('Engines Included'));
    console.log(chalk.gray('─'.repeat(50)));
    info.engines.forEach(engine => {
      console.log(`  ${chalk.green('[OK]')} ${engine}`);
    });
    console.log();
    
    console.log(chalk.bold('Documentation'));
    console.log(chalk.gray('─'.repeat(50)));
    Object.entries(info.docs).forEach(([key, value]) => {
      console.log(`  ${chalk.cyan(key.toUpperCase().padEnd(10))} ${value}`);
    });
    console.log();
    
    console.log(chalk.bold('Privacy'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  ${chalk.green('[LOCK]')} ${info.privacy}`);
    console.log();
    
    console.log(chalk.bold('Support Development'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  ${chalk.yellow('☕')} ${info.funding}`);
    console.log();
  });

// ============================================================================
// COMMAND: engines
// ============================================================================

program
  .command('engines')
  .description('List all verification engines with status')
  .option('--json', 'Output as JSON')
  .action((options) => {
    const engines = [
      { name: 'classification', status: 'enabled', description: 'Intent, hallucination, reasoning detection' },
      { name: 'csm6', status: 'enabled', description: 'Security checks (PII, harmful content, injection)' },
      { name: 'hallucination', status: 'enabled', description: 'Hallucination and factuality detection' },
      { name: 'drift', status: 'enabled', description: 'Fingerprint drift analysis' },
      { name: 'token-rate', status: 'disabled', description: 'Token rate monitoring (static mode)' },
      { name: 'latency', status: 'disabled', description: 'Latency tracking (no wrapping client)' }
    ];
    
    if (options.json) {
      console.log(JSON.stringify(engines, null, 2));
      return;
    }
    
    console.log(chalk.blue('\n🔧 Verification Engines\n'));
    
    engines.forEach(engine => {
      const statusIcon = engine.status === 'enabled' 
        ? chalk.green('[*]') 
        : chalk.gray('[ ]');
      const statusText = engine.status === 'enabled'
        ? chalk.green('enabled')
        : chalk.gray('disabled');
      
      console.log(`  ${statusIcon} ${chalk.cyan(engine.name.padEnd(16))} ${statusText.padEnd(18)} ${chalk.gray(engine.description)}`);
    });
    console.log();
  });

// ============================================================================
// COMMAND: explain
// ============================================================================

program
  .command('explain <engine>')
  .description('Explain how a verification engine works')
  .action((engine) => {
    const explanations: Record<string, { description: string; signals: string[] }> = {
      'hallucination': {
        description: 'Detects AI-generated content that may be factually incorrect or fabricated.',
        signals: [
          'contradiction signal - conflicting statements within response',
          'low-confidence signal - hedging language patterns',
          'compression signal - information density anomalies',
          'domain mismatch signal - out-of-context claims',
          'pattern mismatch signal - structural inconsistencies'
        ]
      },
      'classification': {
        description: 'Classifies AI output by intent, reasoning quality, and potential issues.',
        signals: [
          'intent classification - what the AI is trying to do',
          'reasoning quality - logical consistency check',
          'confidence scoring - certainty of classification',
          'category mapping - maps to risk categories'
        ]
      },
      'csm6': {
        description: 'CSM6 security framework for comprehensive content safety.',
        signals: [
          'PII detection - personal identifiable information',
          'harmful content - violence, hate, self-harm',
          'prompt injection - manipulation attempts',
          'jailbreak detection - bypass attempts',
          'data leakage - sensitive information exposure'
        ]
      },
      'drift': {
        description: 'Monitors changes in AI behavior over time.',
        signals: [
          'fingerprint comparison - baseline vs current',
          'distribution shift - output pattern changes',
          'vocabulary drift - language changes',
          'confidence drift - certainty changes'
        ]
      }
    };
    
    const info = explanations[engine];
    
    if (!info) {
      console.log(chalk.red(`\nUnknown engine: ${engine}`));
      console.log(chalk.gray('Available engines: ' + Object.keys(explanations).join(', ')));
      console.log();
      return;
    }
    
    console.log(chalk.blue(`\n🔍 Engine: ${engine}\n`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(info.description);
    console.log();
    console.log(chalk.bold('Detection Signals:'));
    info.signals.forEach(signal => {
      console.log(`  ${chalk.cyan('•')} ${signal}`);
    });
    console.log();
  });

// ============================================================================
// COMMAND: doctor (hidden)
// ============================================================================

program
  .command('doctor')
  .description('Check system health and configuration')
  .action(() => {
    console.log(chalk.blue('\n[CHECK] llmverify Doctor\n'));
    console.log(chalk.gray('─'.repeat(50)));
    
    // Node version check
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
    const nodeOk = nodeMajor >= 18;
    console.log(`  ${nodeOk ? chalk.green('[OK]') : chalk.red('[FAIL]')} Node.js Version: ${nodeVersion} ${nodeOk ? '' : chalk.red('(requires >=18)')}`);
    
    // Config file check
    const configPath = path.resolve('llmverify.config.json');
    const configExists = fs.existsSync(configPath);
    console.log(`  ${configExists ? chalk.green('[OK]') : chalk.yellow('[ ]')} Config File: ${configExists ? 'Found' : 'Not found (optional)'}`);
    
    // Environment variables
    const envVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
    envVars.forEach(envVar => {
      const exists = !!process.env[envVar];
      console.log(`  ${exists ? chalk.green('[OK]') : chalk.gray('[ ]')} ${envVar}: ${exists ? 'Set' : 'Not set'}`);
    });
    
    // Postinstall check
    const postinstallPath = path.resolve(__dirname, 'postinstall.js');
    const postinstallExists = fs.existsSync(postinstallPath);
    console.log(`  ${postinstallExists ? chalk.green('[OK]') : chalk.yellow('[ ]')} Postinstall: ${postinstallExists ? 'Present' : 'Not found'}`);
    
    console.log();
    console.log(chalk.dim('Run "llmverify init" to create a config file.'));
    console.log();
  });

// ============================================================================
// COMMAND: version (detailed)
// ============================================================================

program
  .command('version')
  .description('Show detailed version information')
  .option('--detailed', 'Show detailed system information')
  .option('--json', 'Output as JSON')
  .action((options) => {
    const versionInfo = {
      package: {
        name: 'llmverify',
        version: VERSION,
        description: 'AI Output Verification Toolkit'
      },
      system: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd()
      },
      engines: {
        classification: 'enabled',
        csm6: 'enabled',
        hallucination: 'enabled',
        drift: 'enabled',
        'token-rate': 'disabled (static mode)',
        latency: 'disabled (no client)'
      },
      adapters: ['openai', 'anthropic', 'groq', 'google', 'deepseek', 'mistral', 'cohere', 'local', 'custom'],
      compliance: ['OWASP LLM Top 10', 'NIST AI RMF', 'EU AI Act', 'ISO 42001'],
      privacy: 'Zero telemetry, 100% local processing',
      links: {
        repository: 'https://github.com/subodhkc/llmverify-npm',
        issues: 'https://github.com/subodhkc/llmverify-npm/issues',
        funding: 'https://www.buymeacoffee.com/subodhkc'
      }
    };
    
    if (options.json) {
      console.log(JSON.stringify(versionInfo, null, 2));
      return;
    }
    
    if (options.detailed) {
      console.log(chalk.blue('\n📦 llmverify Detailed Version Information\n'));
      console.log(chalk.gray('═'.repeat(60)));
      
      console.log(chalk.bold('\nPackage'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(`  ${chalk.cyan('Name:')}        ${versionInfo.package.name}`);
      console.log(`  ${chalk.cyan('Version:')}     ${versionInfo.package.version}`);
      console.log(`  ${chalk.cyan('Description:')} ${versionInfo.package.description}`);
      
      console.log(chalk.bold('\nSystem'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(`  ${chalk.cyan('Node.js:')}     ${versionInfo.system.node}`);
      console.log(`  ${chalk.cyan('Platform:')}    ${versionInfo.system.platform}`);
      console.log(`  ${chalk.cyan('Architecture:')} ${versionInfo.system.arch}`);
      console.log(`  ${chalk.cyan('Working Dir:')} ${versionInfo.system.cwd}`);
      
      console.log(chalk.bold('\nEngines'));
      console.log(chalk.gray('─'.repeat(60)));
      Object.entries(versionInfo.engines).forEach(([engine, status]) => {
        const icon = status === 'enabled' ? chalk.green('[*]') : chalk.gray('[ ]');
        console.log(`  ${icon} ${chalk.cyan(engine.padEnd(16))} ${status}`);
      });
      
      console.log(chalk.bold('\nAdapters'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(`  ${versionInfo.adapters.join(', ')}`);
      
      console.log(chalk.bold('\nCompliance Frameworks'));
      console.log(chalk.gray('─'.repeat(60)));
      versionInfo.compliance.forEach(framework => {
        console.log(`  ${chalk.green('[OK]')} ${framework}`);
      });
      
      console.log(chalk.bold('\nPrivacy'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(`  ${chalk.green('[LOCK]')} ${versionInfo.privacy}`);
      
      console.log(chalk.bold('\nLinks'));
      console.log(chalk.gray('─'.repeat(60)));
      console.log(`  ${chalk.cyan('Repository:')} ${versionInfo.links.repository}`);
      console.log(`  ${chalk.cyan('Issues:')}     ${versionInfo.links.issues}`);
      console.log(`  ${chalk.cyan('Funding:')}    ${versionInfo.links.funding}`);
      
      console.log();
    } else {
      console.log(`llmverify v${VERSION}`);
    }
  });

// ============================================================================
// COMMAND: tutorial
// ============================================================================

program
  .command('tutorial')
  .description('Show usage examples and quick start guide')
  .action(() => {
    console.log(chalk.blue('\n📚 llmverify Quick Start Guide\n'));
    console.log(chalk.gray('═'.repeat(60)));
    console.log();
    
    console.log(chalk.bold('1. Basic Verification'));
    console.log(chalk.gray('   Verify AI output directly:'));
    console.log(chalk.cyan('   $ npx llmverify verify "Your AI response here"'));
    console.log();
    
    console.log(chalk.bold('2. Verify from File'));
    console.log(chalk.gray('   Verify content from a file:'));
    console.log(chalk.cyan('   $ npx llmverify verify --file response.txt'));
    console.log();
    
    console.log(chalk.bold('3. JSON Output'));
    console.log(chalk.gray('   Get results as JSON for programmatic use:'));
    console.log(chalk.cyan('   $ npx llmverify verify "content" --output json'));
    console.log();
    
    console.log(chalk.bold('4. Initialize Config'));
    console.log(chalk.gray('   Create a config file for your project:'));
    console.log(chalk.cyan('   $ npx llmverify init'));
    console.log();
    
    console.log(chalk.bold('5. Check Engines'));
    console.log(chalk.gray('   See available verification engines:'));
    console.log(chalk.cyan('   $ npx llmverify engines'));
    console.log();
    
    console.log(chalk.bold('6. Learn About Engines'));
    console.log(chalk.gray('   Understand how detection works:'));
    console.log(chalk.cyan('   $ npx llmverify explain hallucination'));
    console.log();
    
    console.log(chalk.bold('7. System Health'));
    console.log(chalk.gray('   Verify your setup:'));
    console.log(chalk.cyan('   $ npx llmverify doctor'));
    console.log();
    
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`For more help: ${chalk.cyan('npx llmverify --help')}`);
    console.log(`Documentation: ${chalk.cyan('https://github.com/subodhkc/llmverify-npm')}`);
    console.log();
  });

// ============================================================================
// COMMAND: run (Master command with presets)
// ============================================================================

import { run as coreRun, PRESETS, PresetMode, CoreRunResult } from './core';

program
  .command('run')
  .description('Run all verification engines with preset configuration (dev/prod/strict/fast/ci)')
  .argument('[content]', 'Content to verify (or use --file)')
  .option('-f, --file <path>', 'Read content from file')
  .option('-p, --preset <mode>', 'Preset mode: dev, prod, strict, fast, ci', 'dev')
  .option('--prompt <text>', 'Original prompt for classification')
  .option('--input <text>', 'User input to check for injection')
  .option('-o, --output <format>', 'Output format: text, json, summary', 'text')
  .option('--parallel', 'Run engines in parallel (default: true)', true)
  .option('--no-parallel', 'Run engines sequentially')
  .action(async (content: string | undefined, options) => {
    try {
      // Get content
      let inputContent = content;
      
      if (options.file) {
        const filePath = path.resolve(options.file);
        if (!fs.existsSync(filePath)) {
          console.error(chalk.red(`File not found: ${filePath}`));
          process.exit(1);
        }
        inputContent = fs.readFileSync(filePath, 'utf-8');
      }
      
      if (!inputContent) {
        console.error(chalk.red('No content provided. Use --file or provide content as argument.'));
        process.exit(1);
      }

      const preset = options.preset as PresetMode;
      if (!['dev', 'prod', 'strict', 'fast', 'ci'].includes(preset)) {
        console.error(chalk.red(`Invalid preset: ${preset}. Use: dev, prod, strict, fast, ci`));
        process.exit(1);
      }

      console.log(chalk.blue(`\n🚀 Running llmverify with ${chalk.bold(preset.toUpperCase())} preset...\n`));

      const startTime = Date.now();
      const result = await coreRun({
        content: inputContent,
        prompt: options.prompt,
        userInput: options.input,
        preset,
        parallel: options.parallel
      });

      if (options.output === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else if (options.output === 'summary') {
        printRunSummary(result);
      } else {
        printRunResult(result);
      }

      // Exit code based on risk level
      const exitCodes: Record<string, number> = {
        low: 0,
        moderate: 1,
        high: 2,
        critical: 2
      };
      
      process.exit(exitCodes[result.verification.risk.level] || 0);

    } catch (error) {
      console.error(chalk.red(`\nError: ${(error as Error).message}`));
      process.exit(1);
    }
  });

function printRunResult(result: CoreRunResult): void {
  const riskColors: Record<string, typeof chalk.green> = {
    low: chalk.green,
    moderate: chalk.yellow,
    high: chalk.red,
    critical: chalk.bgRed.white
  };

  // Header
  console.log(chalk.gray('═'.repeat(60)));
  console.log(chalk.bold('📊 VERIFICATION RESULTS'));
  console.log(chalk.gray('═'.repeat(60)));
  console.log();

  // Risk Assessment
  const riskColor = riskColors[result.verification.risk.level] || chalk.white;
  console.log(chalk.bold('Risk Assessment'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`  Level:  ${riskColor(result.verification.risk.level.toUpperCase())}`);
  console.log(`  Score:  ${(result.verification.risk.overall * 100).toFixed(1)}%`);
  console.log(`  Action: ${result.verification.risk.action}`);
  console.log();

  // Classification (if available)
  if (result.classification) {
    console.log(chalk.bold('Classification'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`  Intent:             ${chalk.cyan(result.classification.intent)}`);
    console.log(`  Hallucination Risk: ${getHallucinationColor(result.classification.hallucinationLabel)(result.classification.hallucinationLabel)} (${(result.classification.hallucinationRisk * 100).toFixed(0)}%)`);
    if (result.classification.isJson) {
      console.log(`  JSON Valid:         ${chalk.green('[OK]')}`);
    }
    console.log();
  }

  // Input Safety (if checked)
  if (result.inputSafety) {
    console.log(chalk.bold('Input Safety'));
    console.log(chalk.gray('─'.repeat(40)));
    const safeIcon = result.inputSafety.safe ? chalk.green('[OK] Safe') : chalk.red('[FAIL] Unsafe');
    console.log(`  Status:   ${safeIcon}`);
    console.log(`  Findings: ${result.inputSafety.injectionFindings.length}`);
    console.log();
  }

  // PII Check
  if (result.piiCheck) {
    console.log(chalk.bold('PII Detection'));
    console.log(chalk.gray('─'.repeat(40)));
    const piiIcon = result.piiCheck.hasPII ? chalk.yellow('[WARN] Found') : chalk.green('[OK] None');
    console.log(`  Status: ${piiIcon}`);
    console.log(`  Count:  ${result.piiCheck.piiCount}`);
    console.log();
  }

  // Harmful Content
  if (result.harmfulCheck) {
    console.log(chalk.bold('Harmful Content'));
    console.log(chalk.gray('─'.repeat(40)));
    const harmIcon = result.harmfulCheck.hasHarmful ? chalk.red('[FAIL] Found') : chalk.green('[OK] None');
    console.log(`  Status:   ${harmIcon}`);
    console.log(`  Findings: ${result.harmfulCheck.findings.length}`);
    console.log();
  }

  // Meta
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.dim(`Preset: ${result.meta.preset} | Engines: ${result.meta.enginesRun.join(', ')}`));
  console.log(chalk.dim(`Latency: ${result.meta.totalLatencyMs}ms | ${result.meta.timestamp}`));
  console.log();
}

function printRunSummary(result: CoreRunResult): void {
  const riskColors: Record<string, typeof chalk.green> = {
    low: chalk.green,
    moderate: chalk.yellow,
    high: chalk.red,
    critical: chalk.bgRed.white
  };
  const riskColor = riskColors[result.verification.risk.level] || chalk.white;

  console.log(`${riskColor('[*]')} Risk: ${riskColor(result.verification.risk.level.toUpperCase())} | Action: ${result.verification.risk.action} | ${result.meta.totalLatencyMs}ms`);
  
  const checks: string[] = [];
  if (result.inputSafety) checks.push(result.inputSafety.safe ? '[OK]input' : '[FAIL]input');
  if (result.piiCheck) checks.push(result.piiCheck.hasPII ? '[WARN]pii' : '[OK]pii');
  if (result.harmfulCheck) checks.push(result.harmfulCheck.hasHarmful ? '[FAIL]harm' : '[OK]harm');
  if (result.classification) checks.push(`intent:${result.classification.intent}`);
  
  if (checks.length > 0) {
    console.log(chalk.dim(`  ${checks.join(' | ')}`));
  }
}

function getHallucinationColor(label: string): typeof chalk.green {
  switch (label) {
    case 'low': return chalk.green;
    case 'medium': return chalk.yellow;
    case 'high': return chalk.red;
    default: return chalk.white;
  }
}

// ============================================================================
// COMMAND: wizard (Interactive setup)
// ============================================================================

program
  .command('wizard')
  .description('Interactive setup wizard for first-time configuration')
  .action(async () => {
    console.log(chalk.blue(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ${chalk.bold('🧙 llmverify Setup Wizard')}                                                 ║
║                                                                              ║
║   This wizard will help you configure llmverify for your project.            ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
`));

    // Since we can't use readline in a simple way, provide guided instructions
    console.log(chalk.bold('\n📋 Step 1: Choose Your Preset\n'));
    console.log(chalk.gray('─'.repeat(60)));
    
    const presetTable = new Table({
      head: ['Preset', 'Use Case', 'Speed', 'Thoroughness'],
      style: { head: ['cyan'] }
    });
    
    presetTable.push(
      [chalk.green('dev'), 'Local development & testing', '[*][*][*][ ][ ]', '[*][*][*][*][ ]'],
      [chalk.yellow('prod'), 'Production APIs (low latency)', '[*][*][*][*][*]', '[*][*][*][ ][ ]'],
      [chalk.red('strict'), 'High-stakes, compliance', '[*][*][ ][ ][ ]', '[*][*][*][*][*]'],
      [chalk.cyan('fast'), 'High-throughput pipelines', '[*][*][*][*][*]', '[*][*][ ][ ][ ]'],
      [chalk.magenta('ci'), 'CI/CD pipelines', '[*][*][*][*][ ]', '[*][*][*][*][ ]']
    );
    
    console.log(presetTable.toString());
    console.log();

    console.log(chalk.bold('\n📋 Step 2: Quick Start Commands\n'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log();
    console.log(chalk.dim('  # Run with dev preset (recommended for starting)'));
    console.log(chalk.green('  npx llmverify run "Your AI output" --preset dev'));
    console.log();
    console.log(chalk.dim('  # Run with production preset'));
    console.log(chalk.green('  npx llmverify run "Your AI output" --preset prod'));
    console.log();
    console.log(chalk.dim('  # Run with classification (provide original prompt)'));
    console.log(chalk.green('  npx llmverify run "AI response" --prompt "Original question" --preset dev'));
    console.log();
    console.log(chalk.dim('  # Check user input for injection attacks'));
    console.log(chalk.green('  npx llmverify run "AI response" --input "User message" --preset strict'));
    console.log();
    console.log(chalk.dim('  # Output as JSON for programmatic use'));
    console.log(chalk.green('  npx llmverify run "Your AI output" --preset ci --output json'));
    console.log();

    console.log(chalk.bold('\n📋 Step 3: Initialize Config File\n'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log();
    console.log(chalk.dim('  Create a config file for persistent settings:'));
    console.log(chalk.green('  npx llmverify init'));
    console.log();
    console.log(chalk.dim('  This creates llmverify.config.json in your project root.'));
    console.log();

    console.log(chalk.bold('\n📋 Step 4: Programmatic Usage\n'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log();
    console.log(chalk.dim('  // Quick verification with preset'));
    console.log(chalk.cyan(`  import { run, devVerify, prodVerify } from 'llmverify';`));
    console.log();
    console.log(chalk.dim('  // Using the run function with options'));
    console.log(chalk.white(`  const result = await run({`));
    console.log(chalk.white(`    content: aiOutput,`));
    console.log(chalk.white(`    prompt: originalPrompt,`));
    console.log(chalk.white(`    preset: 'dev'`));
    console.log(chalk.white(`  });`));
    console.log();
    console.log(chalk.dim('  // Quick helpers'));
    console.log(chalk.white(`  const result = await devVerify(aiOutput, prompt);`));
    console.log(chalk.white(`  const result = await prodVerify(aiOutput);`));
    console.log(chalk.white(`  const result = await strictVerify(aiOutput, prompt);`));
    console.log();

    console.log(chalk.bold('\n📋 Step 5: Verify Setup\n'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log();
    console.log(chalk.dim('  Run the doctor command to verify your setup:'));
    console.log(chalk.green('  npx llmverify doctor'));
    console.log();

    console.log(chalk.bold('\n📚 Additional Resources\n'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`  ${chalk.cyan('Documentation:')}    https://github.com/subodhkc/llmverify-npm#readme`);
    console.log(`  ${chalk.cyan('CLI Reference:')}    docs/CLI-REFERENCE.md`);
    console.log(`  ${chalk.cyan('Troubleshooting:')} docs/TROUBLESHOOTING.md`);
    console.log(`  ${chalk.cyan('Getting Started:')} docs/GETTING-STARTED.md`);
    console.log();

    console.log(chalk.green.bold('\n[OK] Wizard complete! You\'re ready to use llmverify.\n'));
    console.log(chalk.dim('Run "npx llmverify run --help" for more options.\n'));
  });

// ============================================================================
// COMMAND: presets (List available presets)
// ============================================================================

program
  .command('presets')
  .description('List available preset configurations')
  .option('--json', 'Output as JSON')
  .action((options) => {
    if (options.json) {
      console.log(JSON.stringify(PRESETS, null, 2));
      return;
    }

    console.log(chalk.blue('\n⚙️  Available Presets\n'));
    console.log(chalk.gray('═'.repeat(60)));
    console.log();

    const presetInfo = [
      {
        name: 'dev',
        description: 'Development mode - balanced, informative output',
        useCase: 'Local development and testing',
        engines: ['hallucination', 'consistency', 'jsonValidator', 'csm6'],
        speed: '[*][*][*][ ][ ]',
        thoroughness: '[*][*][*][*][ ]'
      },
      {
        name: 'prod',
        description: 'Production mode - optimized for speed',
        useCase: 'Production APIs with latency requirements',
        engines: ['jsonValidator', 'csm6'],
        speed: '[*][*][*][*][*]',
        thoroughness: '[*][*][*][ ][ ]'
      },
      {
        name: 'strict',
        description: 'Strict mode - all engines, maximum scrutiny',
        useCase: 'High-stakes content, compliance requirements',
        engines: ['hallucination', 'consistency', 'jsonValidator', 'csm6 (all checks)'],
        speed: '[*][*][ ][ ][ ]',
        thoroughness: '[*][*][*][*][*]'
      },
      {
        name: 'fast',
        description: 'Fast mode - minimal checks, maximum speed',
        useCase: 'High-throughput scenarios',
        engines: ['csm6 (security only)'],
        speed: '[*][*][*][*][*]',
        thoroughness: '[*][*][ ][ ][ ]'
      },
      {
        name: 'ci',
        description: 'CI mode - optimized for CI/CD pipelines',
        useCase: 'Automated testing and deployment',
        engines: ['hallucination', 'consistency', 'jsonValidator', 'csm6'],
        speed: '[*][*][*][*][ ]',
        thoroughness: '[*][*][*][*][ ]'
      }
    ];

    presetInfo.forEach(preset => {
      const nameColors: Record<string, typeof chalk.green> = {
        dev: chalk.green,
        prod: chalk.yellow,
        strict: chalk.red,
        fast: chalk.cyan,
        ci: chalk.magenta
      };
      const nameColor = nameColors[preset.name] || chalk.white;

      console.log(`${nameColor.bold(preset.name.toUpperCase())}`);
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`  ${chalk.dim('Description:')} ${preset.description}`);
      console.log(`  ${chalk.dim('Use Case:')}    ${preset.useCase}`);
      console.log(`  ${chalk.dim('Speed:')}       ${preset.speed}`);
      console.log(`  ${chalk.dim('Thoroughness:')} ${preset.thoroughness}`);
      console.log(`  ${chalk.dim('Engines:')}     ${preset.engines.join(', ')}`);
      console.log();
    });

    console.log(chalk.dim('Usage: npx llmverify run "content" --preset <name>'));
    console.log();
  });

// ============================================================================
// COMMAND: benchmark
// ============================================================================

program
  .command('benchmark')
  .description('Benchmark verification latency across all presets')
  .option('-i, --iterations <n>', 'Number of iterations per preset', '3')
  .option('-c, --content <text>', 'Custom content to benchmark', 'The capital of France is Paris. This is a test response from an AI assistant.')
  .option('--json', 'Output results as JSON')
  .action(async (options) => {
    const iterations = parseInt(options.iterations, 10);
    const content = options.content;
    const presetNames: PresetMode[] = ['fast', 'prod', 'dev', 'ci', 'strict'];

    console.log(chalk.blue(`\n⏱️  Benchmarking llmverify (${iterations} iterations per preset)\n`));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.dim(`Content: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`));
    console.log(chalk.gray('─'.repeat(60)));
    console.log();

    const results: Array<{
      preset: string;
      avgMs: number;
      minMs: number;
      maxMs: number;
      iterations: number;
    }> = [];

    for (const preset of presetNames) {
      const times: number[] = [];
      
      process.stdout.write(chalk.cyan(`  ${preset.padEnd(8)}`));
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await coreRun({ content, preset });
        const elapsed = Date.now() - start;
        times.push(elapsed);
        process.stdout.write(chalk.dim('.'));
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);

      results.push({ preset, avgMs: avg, minMs: min, maxMs: max, iterations });

      // Color based on speed
      const avgColor = avg < 20 ? chalk.green : avg < 50 ? chalk.yellow : chalk.red;
      console.log(` ${avgColor(`${avg.toFixed(1)}ms`)} avg (${min}-${max}ms)`);
    }

    console.log();

    if (options.json) {
      console.log(JSON.stringify({ benchmarks: results, content: content.substring(0, 100) }, null, 2));
    } else {
      // Summary table
      console.log(chalk.bold('📊 Summary'));
      console.log(chalk.gray('─'.repeat(60)));
      
      const table = new Table({
        head: ['Preset', 'Avg (ms)', 'Min (ms)', 'Max (ms)', 'Speed'],
        style: { head: ['cyan'] }
      });

      results.forEach(r => {
        const speedBars = r.avgMs < 15 ? '[*][*][*][*][*]' : r.avgMs < 25 ? '[*][*][*][*][ ]' : r.avgMs < 40 ? '[*][*][*][ ][ ]' : r.avgMs < 60 ? '[*][*][ ][ ][ ]' : '[*][ ][ ][ ][ ]';
        const avgColor = r.avgMs < 20 ? chalk.green : r.avgMs < 50 ? chalk.yellow : chalk.red;
        table.push([
          r.preset,
          avgColor(r.avgMs.toFixed(1)),
          r.minMs.toString(),
          r.maxMs.toString(),
          speedBars
        ]);
      });

      console.log(table.toString());
      console.log();
      console.log(chalk.dim('Tip: Use --preset fast for high-throughput, --preset strict for compliance'));
      console.log();
    }
  });

// ============================================================================
// COMMAND: adapters
// ============================================================================

program
  .command('baseline')
  .description('Manage baseline metrics and drift detection')
  .action(() => {
    console.log(chalk.blue('\n📊 Baseline Management\n'));
    console.log('Available subcommands:');
    console.log(`  ${chalk.cyan('baseline stats')}   - Show baseline statistics`);
    console.log(`  ${chalk.cyan('baseline reset')}   - Reset baseline metrics`);
    console.log(`  ${chalk.cyan('baseline drift')}   - Show recent drift records`);
    console.log('\nRun with --help for more information');
  });

program
  .command('baseline:stats')
  .description('Show baseline statistics')
  .action(() => {
    try {
      const { getBaselineStorage } = require('./baseline/storage');
      const storage = getBaselineStorage();
      const stats = storage.getStatistics();
      
      console.log(chalk.blue('\n📊 Baseline Statistics\n'));
      
      if (!stats.hasBaseline) {
        console.log(chalk.yellow('No baseline data available yet.'));
        console.log(chalk.dim('Baseline will be created automatically as you use llmverify.'));
        return;
      }
      
      console.log(chalk.green('Status:'), 'Active');
      console.log(chalk.green('Sample Count:'), stats.sampleCount);
      console.log(chalk.green('Created:'), stats.createdAt);
      console.log(chalk.green('Updated:'), stats.updatedAt);
      console.log(chalk.green('Drift Records:'), stats.driftRecordCount);
      
      if (stats.recentDrifts.length > 0) {
        console.log(chalk.yellow('\n[WARN]️  Recent Drift Detected:\n'));
        stats.recentDrifts.forEach((drift: any) => {
          console.log(`  ${chalk.cyan(drift.metric)}: ${drift.driftPercent.toFixed(2)}% (${drift.severity})`);
        });
      } else {
        console.log(chalk.green('\n[OK] No significant drift detected'));
      }
    } catch (error) {
      console.error(chalk.red('Failed to load baseline stats:', (error as Error).message));
    }
  });

program
  .command('baseline:reset')
  .description('Reset baseline metrics')
  .action(() => {
    try {
      const { getBaselineStorage } = require('./baseline/storage');
      const storage = getBaselineStorage();
      storage.resetBaseline();
      console.log(chalk.green('\n[OK] Baseline reset successfully'));
      console.log(chalk.dim('New baseline will be created on next verification'));
    } catch (error) {
      console.error(chalk.red('Failed to reset baseline:', (error as Error).message));
    }
  });

program
  .command('baseline:drift')
  .description('Show recent drift records')
  .option('-n, --limit <number>', 'Number of records to show', '20')
  .action((options) => {
    try {
      const { getBaselineStorage } = require('./baseline/storage');
      const storage = getBaselineStorage();
      const drifts = storage.readDriftHistory(parseInt(options.limit));
      
      console.log(chalk.blue(`\n📈 Recent Drift Records (${drifts.length})\n`));
      
      if (drifts.length === 0) {
        console.log(chalk.green('No drift records found'));
        return;
      }
      
      drifts.forEach((drift: any) => {
        const color = drift.severity === 'significant' ? chalk.red : 
                     drift.severity === 'moderate' ? chalk.yellow : chalk.dim;
        console.log(color(`[${drift.timestamp}] ${drift.metric}: ${drift.driftPercent.toFixed(2)}% (${drift.severity})`));
      });
    } catch (error) {
      console.error(chalk.red('Failed to read drift history:', (error as Error).message));
    }
  });

program
  .command('badge')
  .description('Generate "Built with llmverify" badge for your project')
  .option('-n, --name <name>', 'Project name')
  .option('-u, --url <url>', 'Project URL')
  .option('-o, --output <path>', 'Output file path')
  .action((options) => {
    try {
      const { generateBadgeForProject, saveBadgeToFile } = require('./badge/generator');
      
      if (!options.name) {
        console.error(chalk.red('Error: Project name is required'));
        console.log(chalk.dim('Usage: npx llmverify badge --name "My Project" --url "https://example.com"'));
        return;
      }
      
      if (options.output) {
        saveBadgeToFile(options.output, options.name, options.url);
        console.log(chalk.green(`\n[OK] Badge saved to: ${options.output}\n`));
      } else {
        const { markdown, html, signature } = generateBadgeForProject(options.name, options.url);
        
        console.log(chalk.blue('\n📛 Built with llmverify Badge\n'));
        console.log(chalk.green('Markdown:'));
        console.log(chalk.dim(markdown));
        console.log('\n' + chalk.green('HTML:'));
        console.log(chalk.dim(html));
        console.log('\n' + chalk.green('Verification Signature:'));
        console.log(chalk.dim(signature));
        console.log('\n' + chalk.yellow('💡 Copy the code above and paste it into your README.md'));
      }
    } catch (error) {
      console.error(chalk.red('Failed to generate badge:', (error as Error).message));
    }
  });

program
  .command('adapters')
  .description('List available provider adapters')
  .action(() => {
    console.log(chalk.blue('\n🔌 Available Adapters\n'));
    
    const adapters = [
      { name: 'openai', status: 'available', description: 'OpenAI GPT models' },
      { name: 'anthropic', status: 'available', description: 'Anthropic Claude models' },
      { name: 'langchain', status: 'available', description: 'LangChain integration' },
      { name: 'vercel-ai', status: 'planned', description: 'Vercel AI SDK' },
      { name: 'ollama', status: 'planned', description: 'Local Ollama models' }
    ];
    
    adapters.forEach(adapter => {
      const statusIcon = adapter.status === 'available' 
        ? chalk.green('[*]') 
        : chalk.yellow('[ ]');
      const statusText = adapter.status === 'available'
        ? chalk.green('available')
        : chalk.yellow('planned');
      
      console.log(`  ${statusIcon} ${chalk.cyan(adapter.name.padEnd(12))} ${statusText.padEnd(14)} ${chalk.gray(adapter.description)}`);
    });
    console.log();
  });

function printTextResult(result: VerifyResult, verbose: boolean): void {
  // Risk summary
  const riskColors: Record<string, typeof chalk.green> = {
    low: chalk.green,
    moderate: chalk.yellow,
    high: chalk.red,
    critical: chalk.bgRed.white
  };
  
  const riskColor = riskColors[result.risk.level] || chalk.white;
  
  console.log(chalk.bold('📊 Risk Assessment'));
  console.log(`   Level: ${riskColor(result.risk.level.toUpperCase())}`);
  console.log(`   Score: ${(result.risk.overall * 100).toFixed(1)}%`);
  console.log(`   Action: ${result.risk.action}`);
  console.log();
  
  // Findings
  if (result.csm6 && result.csm6.findings.length > 0) {
    console.log(chalk.bold('🔍 Findings'));
    
    const table = new Table({
      head: ['Severity', 'Category', 'Message', 'Confidence'],
      style: { head: ['cyan'] }
    });
    
    result.csm6.findings.forEach((finding: Finding) => {
      const severityColors: Record<string, typeof chalk.green> = {
        info: chalk.blue,
        low: chalk.green,
        medium: chalk.yellow,
        high: chalk.red,
        critical: chalk.bgRed.white
      };
      
      const sevColor = severityColors[finding.severity] || chalk.white;
      
      table.push([
        sevColor(finding.severity),
        finding.category,
        finding.message.substring(0, 50),
        `${(finding.confidence.value * 100).toFixed(0)}%`
      ]);
    });
    
    console.log(table.toString());
    console.log();
  }
  
  // Blockers
  if (result.risk.blockers.length > 0) {
    console.log(chalk.red.bold('🚫 Blockers'));
    result.risk.blockers.forEach(blocker => {
      console.log(`   • ${blocker}`);
    });
    console.log();
  }
  
  // Interpretation
  console.log(chalk.bold('📝 Interpretation'));
  console.log(`   ${result.risk.interpretation}`);
  console.log();
  
  // Limitations
  if (verbose) {
    console.log(chalk.yellow.bold('[WARN]️  Limitations'));
    result.limitations.slice(0, 5).forEach(limitation => {
      console.log(`   • ${limitation}`);
    });
    console.log();
  }
  
  // Meta
  console.log(chalk.dim(`Verification ID: ${result.meta.verification_id}`));
  console.log(chalk.dim(`Latency: ${result.meta.latency_ms}ms | Version: ${result.meta.version}`));
  console.log();
}

// ============================================================================
// COMMAND: connect (Opt-in dashboard connection)
// ============================================================================

const CONFIG_DIR = path.join(os.homedir(), '.llmverify');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface DashboardConfig {
  apiKey?: string;
  apiUrl?: string;
  connectedAt?: string;
  tier?: string;
}

function readDashboardConfig(): DashboardConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {
    // Corrupted config — return empty
  }
  return {};
}

function writeDashboardConfig(config: DashboardConfig): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error(chalk.red(`Failed to write config: ${(err as Error).message}`));
  }
}

program
  .command('connect')
  .description('Connect to HAIEC dashboard (opt-in, enables usage sync and tier upgrades)')
  .argument('<apiKey>', 'Your HAIEC API key (get one at haiec.com/dashboard/api-keys)')
  .option('--url <url>', 'API base URL', 'https://www.haiec.com')
  .action(async (apiKey: string, options: { url: string }) => {
    console.log(chalk.blue('\n🔗 Connecting to HAIEC Dashboard...\n'));

    // Validate API key format
    if (!/^haiec_(live|test)_[A-Za-z0-9_-]{20,}$/.test(apiKey)) {
      console.error(chalk.red('Invalid API key format.'));
      console.log(chalk.dim('Expected format: haiec_live_... or haiec_test_...'));
      console.log(chalk.dim('Get a key at: https://www.haiec.com/dashboard/api-keys'));
      process.exit(1);
    }

    // Verify key with server
    try {
      const res = await fetch(`${options.url}/api/llmverify/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': `llmverify-cli/${VERSION}`,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error(chalk.red(`Authentication failed: ${(body as any).error || res.statusText}`));
        process.exit(1);
      }

      const data = await res.json() as { success: boolean; data?: { tier: string } };
      if (!data.success) {
        console.error(chalk.red('Server rejected the API key.'));
        process.exit(1);
      }

      // Save config
      const config = readDashboardConfig();
      config.apiKey = apiKey;
      config.apiUrl = options.url;
      config.connectedAt = new Date().toISOString();
      config.tier = (data.data as any)?.tier || 'free';
      writeDashboardConfig(config);

      console.log(chalk.green('[OK] Connected to HAIEC Dashboard'));
      console.log(`  ${chalk.cyan('Tier:')}      ${config.tier}`);
      console.log(`  ${chalk.cyan('API URL:')}   ${config.apiUrl}`);
      console.log(`  ${chalk.cyan('Config:')}    ${CONFIG_FILE}`);
      console.log();
      console.log(chalk.dim('Your free tier still works 100% locally with zero network.'));
      console.log(chalk.dim('Dashboard connection is opt-in — use "npx llmverify sync" to push usage.'));
      console.log(chalk.dim('Use "npx llmverify disconnect" to remove the connection.'));
      console.log();
    } catch (err) {
      console.error(chalk.red(`Connection failed: ${(err as Error).message}`));
      console.log(chalk.dim('Check your network connection and API URL.'));
      process.exit(1);
    }
  });

// ============================================================================
// COMMAND: disconnect
// ============================================================================

program
  .command('disconnect')
  .description('Remove HAIEC dashboard connection (reverts to 100% local mode)')
  .action(() => {
    const config = readDashboardConfig();

    if (!config.apiKey) {
      console.log(chalk.yellow('\nNot connected to any dashboard.'));
      console.log();
      return;
    }

    // Remove API key but keep other settings
    delete config.apiKey;
    delete config.connectedAt;
    delete config.tier;
    writeDashboardConfig(config);

    console.log(chalk.green('\n[OK] Disconnected from HAIEC Dashboard'));
    console.log(chalk.dim('All verification continues to work 100% locally.'));
    console.log(chalk.dim('Your local usage data is unchanged.'));
    console.log();
  });

// ============================================================================
// COMMAND: sync (Push usage to dashboard)
// ============================================================================

program
  .command('sync')
  .description('Sync local usage data to HAIEC dashboard (requires connect first)')
  .action(async () => {
    const config = readDashboardConfig();

    if (!config.apiKey || !config.apiUrl) {
      console.error(chalk.red('\nNot connected to dashboard.'));
      console.log(chalk.dim('Run: npx llmverify connect <API_KEY>'));
      console.log();
      process.exit(1);
    }

    console.log(chalk.blue('\n📤 Syncing usage to HAIEC Dashboard...\n'));

    // Read local usage
    const { readUsage } = require('./usage/tracker');
    const usage = readUsage(config.tier || 'free');

    try {
      const res = await fetch(`${config.apiUrl}/api/llmverify/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': `llmverify-cli/${VERSION}`,
        },
        body: JSON.stringify({
          packageVersion: VERSION,
          tier: config.tier || 'free',
          usage: {
            date: usage.date,
            totalCalls: usage.calls,
            featureBreakdown: usage.breakdown,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error(chalk.red(`Sync failed: ${(body as any).error || res.statusText}`));
        process.exit(1);
      }

      const data = await res.json() as { success: boolean; data?: any };
      if (!data.success) {
        console.error(chalk.red('Sync rejected by server.'));
        process.exit(1);
      }

      const result = data.data;

      // Update local tier if server says different
      if (result?.tierMismatch && result?.serverTier) {
        config.tier = result.serverTier;
        writeDashboardConfig(config);
        console.log(chalk.yellow(`  Tier updated: ${result.serverTier} (from server)`));
      }

      console.log(chalk.green('[OK] Usage synced successfully'));
      console.log(`  ${chalk.cyan('Date:')}       ${usage.date}`);
      console.log(`  ${chalk.cyan('Calls:')}      ${usage.calls}`);
      console.log(`  ${chalk.cyan('Tier:')}       ${result?.serverTier || config.tier}`);
      if (result?.limits?.dailyCallLimit) {
        console.log(`  ${chalk.cyan('Limit:')}      ${result.limits.dailyCallLimit}/day`);
      }
      console.log();
    } catch (err) {
      console.error(chalk.red(`Sync failed: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// ============================================================================
// COMMAND: status (Show connection and usage status)
// ============================================================================

program
  .command('status')
  .description('Show current tier, usage, and dashboard connection status')
  .option('--json', 'Output as JSON')
  .action((options: { json?: boolean }) => {
    const config = readDashboardConfig();
    const { readUsage } = require('./usage/tracker');
    const usage = readUsage(config.tier || 'free');

    const tierLimits: Record<string, number> = {
      free: 500,
      starter: 5000,
      pro: 50000,
      business: Infinity,
      enterprise: Infinity,
    };

    const limit = tierLimits[config.tier || 'free'] || 500;
    const remaining = Math.max(0, limit - usage.calls);
    const pct = limit === Infinity ? 0 : Math.round((usage.calls / limit) * 100);

    const status = {
      connected: !!config.apiKey,
      tier: config.tier || 'free',
      usage: {
        date: usage.date,
        calls: usage.calls,
        limit: limit === Infinity ? 'unlimited' : limit,
        remaining: limit === Infinity ? 'unlimited' : remaining,
        percentUsed: limit === Infinity ? 0 : pct,
      },
      breakdown: usage.breakdown,
      dashboard: config.apiKey ? {
        apiUrl: config.apiUrl,
        connectedAt: config.connectedAt,
      } : null,
      package: {
        version: VERSION,
        privacy: 'Zero telemetry on free tier. Dashboard sync is opt-in.',
      },
    };

    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    console.log(chalk.blue(`\n📊 llmverify Status (v${VERSION})\n`));
    console.log(chalk.gray('═'.repeat(50)));

    // Connection
    console.log(chalk.bold('\nDashboard Connection'));
    console.log(chalk.gray('─'.repeat(50)));
    if (config.apiKey) {
      console.log(`  ${chalk.green('[OK]')} Connected to ${config.apiUrl}`);
      console.log(`  ${chalk.dim('Connected:')} ${config.connectedAt}`);
    } else {
      console.log(`  ${chalk.gray('[ ]')} Not connected (100% local mode)`);
      console.log(`  ${chalk.dim('Connect:')} npx llmverify connect <API_KEY>`);
    }

    // Tier
    console.log(chalk.bold('\nTier'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  ${chalk.cyan('Current:')}   ${(config.tier || 'free').toUpperCase()}`);
    console.log(`  ${chalk.cyan('Limit:')}     ${limit === Infinity ? 'Unlimited' : `${limit}/day`}`);

    // Usage
    console.log(chalk.bold('\nToday\'s Usage'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`  ${chalk.cyan('Date:')}      ${usage.date}`);
    console.log(`  ${chalk.cyan('Calls:')}     ${usage.calls}${limit !== Infinity ? ` / ${limit} (${pct}%)` : ''}`);
    console.log(`  ${chalk.cyan('Remaining:')} ${limit === Infinity ? 'Unlimited' : remaining}`);

    // Progress bar
    if (limit !== Infinity) {
      const barWidth = 30;
      const filled = Math.round((pct / 100) * barWidth);
      const bar = chalk.green('█'.repeat(Math.min(filled, barWidth))) + chalk.gray('░'.repeat(Math.max(0, barWidth - filled)));
      console.log(`  [${bar}] ${pct}%`);
    }

    // Breakdown
    if (usage.breakdown) {
      console.log(chalk.bold('\nBreakdown'));
      console.log(chalk.gray('─'.repeat(50)));
      Object.entries(usage.breakdown).forEach(([fn, count]) => {
        if ((count as number) > 0) {
          console.log(`  ${chalk.cyan(fn.padEnd(16))} ${count}`);
        }
      });
    }

    console.log();
  });

// ============================================================================
// COMMAND: usage (alias for status — backward compatibility)
// ============================================================================

program
  .command('usage')
  .description('Show daily usage (alias for status)')
  .option('--json', 'Output as JSON')
  .action((options: { json?: boolean }) => {
    // Inline the same logic as status command to avoid recursive parse
    const config = readDashboardConfig();
    const { readUsage } = require('./usage/tracker');
    const usage = readUsage(config.tier || 'free');

    const tierLimits: Record<string, number> = {
      free: 500, starter: 5000, pro: 50000, business: Infinity, enterprise: Infinity,
    };
    const limit = tierLimits[config.tier || 'free'] || 500;
    const remaining = Math.max(0, limit - usage.calls);
    const pct = limit === Infinity ? 0 : Math.round((usage.calls / limit) * 100);

    if (options.json) {
      console.log(JSON.stringify({ tier: config.tier || 'free', date: usage.date, calls: usage.calls, limit: limit === Infinity ? 'unlimited' : limit, remaining: limit === Infinity ? 'unlimited' : remaining }, null, 2));
      return;
    }

    console.log(chalk.blue(`\n📊 llmverify Usage (v${VERSION})\n`));
    console.log(`  ${chalk.cyan('Date:')}      ${usage.date}`);
    console.log(`  ${chalk.cyan('Tier:')}      ${(config.tier || 'free').toUpperCase()}`);
    console.log(`  ${chalk.cyan('Calls:')}     ${usage.calls}${limit !== Infinity ? ` / ${limit} (${pct}%)` : ''}`);
    console.log(`  ${chalk.cyan('Remaining:')} ${limit === Infinity ? 'Unlimited' : remaining}`);
    console.log();
  });

program.parse();
