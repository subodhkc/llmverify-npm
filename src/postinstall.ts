#!/usr/bin/env node
/**
 * llmverify - Postinstall Message
 * Displays a rich, informative banner after npm install
 * 
 * @module postinstall
 * @author HAIEC
 * @license MIT
 */

const VERSION = '1.5.1';

// ANSI color codes (works in most terminals)
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
};

const c = colors;

function printBanner(): void {
  const banner = `
${c.cyan}${c.bright}╔══════════════════════════════════════════════════════════════════════════════╗${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.green}${c.bright}[OK] llmverify ${VERSION}${c.reset} ${c.dim}— AI Output Verification Toolkit${c.reset}                        ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.yellow}Local-first${c.reset} • ${c.yellow}Zero telemetry${c.reset} • ${c.yellow}Privacy-preserving${c.reset}                      ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}╠══════════════════════════════════════════════════════════════════════════════╣${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.bright}QUICK START${c.reset}                                                               ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.dim}─────────────────────────────────────────────────────────────────────${c.reset}   ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.cyan}1.${c.reset} Setup wizard:         ${c.green}npx llmverify wizard${c.reset}                          ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.cyan}2.${c.reset} Run with preset:      ${c.green}npx llmverify run "AI output" --preset dev${c.reset}    ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.cyan}3.${c.reset} Check system health:  ${c.green}npx llmverify doctor${c.reset}                          ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.cyan}4.${c.reset} See all commands:     ${c.green}npx llmverify --help${c.reset}                          ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}╠══════════════════════════════════════════════════════════════════════════════╣${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.bright}PROGRAMMATIC USAGE${c.reset}                                                        ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.dim}─────────────────────────────────────────────────────────────────────${c.reset}   ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.magenta}import${c.reset} { verify, isInputSafe, redactPII } ${c.magenta}from${c.reset} ${c.green}'llmverify'${c.reset};           ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.dim}// Verify AI output safety${c.reset}                                               ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.magenta}const${c.reset} result = ${c.magenta}await${c.reset} verify({ content: aiOutput });                    ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.dim}// Check for prompt injection${c.reset}                                            ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.magenta}if${c.reset} (!isInputSafe(userInput)) ${c.magenta}throw new${c.reset} Error(${c.green}'Attack detected'${c.reset});       ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.dim}// Redact PII before displaying${c.reset}                                          ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.magenta}const${c.reset} { redacted } = redactPII(aiOutput);                                 ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}╠══════════════════════════════════════════════════════════════════════════════╣${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.bright}AVAILABLE CLI COMMANDS${c.reset}                                                    ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.dim}─────────────────────────────────────────────────────────────────────${c.reset}   ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.yellow}run${c.reset}         ${c.bright}★${c.reset} Master command - run all engines with presets          ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.yellow}wizard${c.reset}      ${c.bright}★${c.reset} Interactive setup wizard for first-time users          ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.cyan}verify${c.reset}      Run multi-engine verification on AI output                  ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.cyan}presets${c.reset}     List available preset configurations                        ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.cyan}engines${c.reset}     List all verification engines with status                   ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.cyan}doctor${c.reset}      Check system health and configuration                       ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.cyan}init${c.reset}        Initialize config file (llmverify.config.json)               ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.cyan}tutorial${c.reset}    Show usage examples and quick start guide                    ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}╠══════════════════════════════════════════════════════════════════════════════╣${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.bright}LINKS${c.reset}                                                                     ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.dim}─────────────────────────────────────────────────────────────────────${c.reset}   ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.blue}📖 Docs${c.reset}     https://github.com/subodhkc/llmverify-npm#readme            ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.blue}🐛 Issues${c.reset}   https://github.com/subodhkc/llmverify-npm/issues             ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.yellow}☕ Support${c.reset}  https://www.buymeacoffee.com/subodhkc                        ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}╠══════════════════════════════════════════════════════════════════════════════╣${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.bright}FREE TIER${c.reset}                                                                  ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.dim}─────────────────────────────────────────────────────────────────────${c.reset}   ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.green}500 calls/day${c.reset} • All features included • No account needed             ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   Check usage:  ${c.green}npx llmverify usage${c.reset}                                       ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   Upgrade:      ${c.blue}https://haiec.com/llmverify/pricing${c.reset}                        ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}╠══════════════════════════════════════════════════════════════════════════════╣${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.green}[LOCK] PRIVACY${c.reset}  100% local • Zero network requests • Zero telemetry         ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}   ${c.green}[OK] VERIFIED${c.reset}  Run tcpdump while using — you'll see nothing                ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}║${c.reset}                                                                              ${c.cyan}${c.bright}║${c.reset}
${c.cyan}${c.bright}╚══════════════════════════════════════════════════════════════════════════════╝${c.reset}

${c.dim}Maintained by HAIEC • MIT License${c.reset}
`;

  console.log(banner);
}

// Only run if not in CI/CD or silent mode
const isSilent = process.env.npm_config_loglevel === 'silent' || 
                 process.env.CI === 'true' ||
                 process.env.LLMVERIFY_SILENT === 'true';

if (!isSilent) {
  printBanner();
} else {
  console.log('[llmverify] Installed successfully. Run "npx llmverify --help" for usage.')
}
