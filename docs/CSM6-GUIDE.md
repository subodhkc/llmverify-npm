# CSM6 Security Engine Guide

Complete guide to using the CSM6 (Comprehensive Security Model 6) engine for AI output verification.

---

## What is CSM6?

CSM6 is llmverify's comprehensive security engine that implements:
- OWASP LLM Top 10 security checks
- PII (Personally Identifiable Information) detection
- Harmful content detection
- Security vulnerability scanning
- Privacy compliance verification

---

## Quick Start

CSM6 runs automatically as part of the verify function. No separate command needed.

```bash
# CSM6 runs automatically with verify
npm run verify -- --content "Your AI response here"

# Or use the API
node -e "const {verify} = require('./dist/verify'); verify({content: 'test'}).then(r => console.log(r.csm6));"
```

---

## How CSM6 Works

CSM6 is one of four verification engines:
1. Hallucination Detection
2. Consistency Analysis
3. JSON Validator
4. **CSM6 Security** (this guide)

When you call `verify()`, all engines run automatically. CSM6 results are in `result.csm6`.

---

## CSM6 Profiles

CSM6 has 5 security profiles for different use cases:

### 1. Baseline (Default)

**Use for:** General development and testing

**Checks:**
- Security: Prompt injection, SQL injection, command injection
- Privacy: Basic PII detection (SSN, email, phone)
- Safety: Harmful content patterns

**Configuration:**
```javascript
const config = {
  engines: {
    csm6: {
      enabled: true,
      profile: 'baseline'
    }
  }
};
```

---

### 2. High Risk

**Use for:** Production systems, sensitive data

**Checks:**
- All baseline checks
- Advanced PII detection
- Path traversal detection
- Credential scanning
- Financial data detection

**Configuration:**
```javascript
const config = {
  engines: {
    csm6: {
      enabled: true,
      profile: 'high_risk',
      checks: {
        security: true,
        privacy: true,
        safety: true,
        fairness: true,
        reliability: true,
        transparency: true
      }
    }
  }
};
```

---

### 3. Finance

**Use for:** Financial services, banking, payments

**Checks:**
- Credit card detection
- Bank account detection
- Financial data patterns
- Credential scanning
- Compliance verification

**Configuration:**
```javascript
const config = {
  engines: {
    csm6: {
      enabled: true,
      profile: 'finance',
      pii: {
        enabled: true,
        minSeverity: 'low',
        categories: ['financial', 'credential', 'personal']
      }
    }
  }
};
```

---

### 4. Health

**Use for:** Healthcare, HIPAA compliance

**Checks:**
- PHI (Protected Health Information)
- Medical record numbers
- Health insurance data
- Patient identifiers
- HIPAA compliance

**Configuration:**
```javascript
const config = {
  engines: {
    csm6: {
      enabled: true,
      profile: 'health',
      pii: {
        enabled: true,
        minSeverity: 'low',
        categories: ['personal', 'health', 'financial']
      }
    }
  }
};
```

---

### 5. Research

**Use for:** Academic research, data analysis

**Checks:**
- Participant privacy
- Research data protection
- Fairness and bias
- Transparency requirements

**Configuration:**
```javascript
const config = {
  engines: {
    csm6: {
      enabled: true,
      profile: 'research',
      checks: {
        security: true,
        privacy: true,
        fairness: true,
        reliability: true,
        transparency: true
      }
    }
  }
};
```

---

## Using CSM6

### Method 1: Automatic (Recommended)

CSM6 runs automatically when you verify content:

```javascript
const { verify } = require('llmverify');

const result = await verify({
  content: 'AI response to verify'
});

// Access CSM6 results
console.log(result.csm6.passed);        // true/false
console.log(result.csm6.riskScore);     // 0-1
console.log(result.csm6.findings);      // Array of issues
```

---

### Method 2: With Configuration

Customize CSM6 behavior:

```javascript
const { verify } = require('llmverify');

const result = await verify({
  content: 'AI response to verify',
  config: {
    engines: {
      csm6: {
        enabled: true,
        profile: 'high_risk',
        pii: {
          enabled: true,
          minSeverity: 'medium',
          categories: ['personal', 'financial', 'credential']
        }
      }
    }
  }
});
```

---

### Method 3: CLI

Use CSM6 via command line:

```bash
# Basic verification (CSM6 runs automatically)
npx llmverify verify --content "Your text here"

# With specific profile
npx llmverify run --content "Your text here" --preset strict

# Check PII only
npx llmverify check-pii --content "John Doe, SSN: 123-45-6789"
```

---

## CSM6 Output

CSM6 returns detailed security analysis:

```javascript
{
  csm6: {
    passed: false,                    // Overall pass/fail
    riskScore: 0.65,                  // 0-1 risk score
    profile: 'baseline',              // Profile used
    checksPerformed: [                // What was checked
      'security',
      'privacy',
      'safety'
    ],
    findings: [                       // Issues found
      {
        type: 'pii',
        severity: 'high',
        message: 'Social Security Number detected',
        location: { start: 10, end: 21 },
        category: 'personal',
        confidence: 0.95
      },
      {
        type: 'sql_injection',
        severity: 'critical',
        message: 'SQL injection pattern detected',
        pattern: 'SELECT * FROM users WHERE',
        confidence: 0.88
      }
    ],
    summary: {
      totalFindings: 2,
      criticalCount: 1,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0
    },
    methodology: 'CSM6 Baseline Profile: OWASP LLM Top 10...',
    limitations: [
      'Pattern-based detection only',
      'May have false positives',
      'Context-dependent accuracy'
    ]
  }
}
```

---

## Security Checks

### 1. Prompt Injection Detection

Detects attempts to manipulate AI behavior:

```javascript
// Example: Detected
const result = await verify({
  content: 'Ignore previous instructions and...'
});
// result.csm6.findings includes prompt injection warning
```

---

### 2. SQL Injection Detection

Detects SQL injection patterns:

```javascript
// Example: Detected
const result = await verify({
  content: 'SELECT * FROM users WHERE id = 1 OR 1=1'
});
// result.csm6.findings includes SQL injection warning
```

---

### 3. Command Injection Detection

Detects dangerous system commands:

```javascript
// Example: Detected
const result = await verify({
  content: 'rm -rf / or del /f /s /q C:\\'
});
// result.csm6.findings includes command injection warning
```

---

### 4. Path Traversal Detection

Detects directory traversal attempts:

```javascript
// Example: Detected
const result = await verify({
  content: '../../../etc/passwd'
});
// result.csm6.findings includes path traversal warning
```

---

## PII Detection

### Categories

CSM6 detects multiple PII categories:

**Personal:**
- Names
- Email addresses
- Phone numbers
- Physical addresses
- Social Security Numbers

**Financial:**
- Credit card numbers
- Bank account numbers
- Routing numbers
- IBAN codes

**Credential:**
- API keys
- Passwords
- Access tokens
- Private keys

**Location:**
- GPS coordinates
- Street addresses
- Postal codes

**Health:**
- Medical record numbers
- Health insurance numbers
- Prescription data

---

### PII Configuration

Control PII detection sensitivity:

```javascript
const config = {
  engines: {
    csm6: {
      enabled: true,
      pii: {
        enabled: true,
        minSeverity: 'medium',        // low, medium, high, critical
        categories: [                  // Which categories to check
          'personal',
          'financial',
          'credential'
        ]
      }
    }
  }
};
```

---

### Testing PII Detection

```bash
# Test SSN detection
node -e "const {verify} = require('./dist/verify'); verify({content: 'SSN: 123-45-6789'}).then(r => console.log('PII Found:', r.csm6.findings.length > 0));"

# Test email detection
node -e "const {verify} = require('./dist/verify'); verify({content: 'Email: user@example.com'}).then(r => console.log('PII Found:', r.csm6.findings.length > 0));"

# Test credit card detection
node -e "const {verify} = require('./dist/verify'); verify({content: 'Card: 4532-1234-5678-9010'}).then(r => console.log('PII Found:', r.csm6.findings.length > 0));"
```

---

## Harmful Content Detection

CSM6 detects harmful content patterns:

**Categories:**
- Violence
- Hate speech
- Self-harm
- Sexual content
- Illegal activities

**Configuration:**
```javascript
const config = {
  engines: {
    csm6: {
      enabled: true,
      harmful: {
        enabled: true,
        minSeverity: 'medium'
      }
    }
  }
};
```

---

## Compliance Workflows

### HIPAA Compliance

```javascript
const { verify } = require('llmverify');

const result = await verify({
  content: aiResponse,
  config: {
    tier: 'enterprise',
    privacy: {
      allowNetworkRequests: false,
      telemetryEnabled: false,
      dataResidency: 'US'
    },
    engines: {
      csm6: {
        enabled: true,
        profile: 'health',
        pii: {
          enabled: true,
          minSeverity: 'low',
          categories: ['personal', 'health', 'financial']
        }
      }
    }
  }
});

if (!result.csm6.passed) {
  console.log('HIPAA violation detected');
  console.log('Findings:', result.csm6.findings);
}
```

---

### SOC 2 Compliance

```javascript
const result = await verify({
  content: aiResponse,
  config: {
    engines: {
      csm6: {
        enabled: true,
        profile: 'finance',
        checks: {
          security: true,
          privacy: true,
          safety: true,
          reliability: true
        }
      }
    }
  }
});
```

---

### GDPR Compliance

```javascript
const result = await verify({
  content: aiResponse,
  config: {
    privacy: {
      dataResidency: 'EU'
    },
    engines: {
      csm6: {
        enabled: true,
        profile: 'high_risk',
        pii: {
          enabled: true,
          minSeverity: 'low',
          categories: ['personal', 'location']
        }
      }
    }
  }
});
```

---

## Testing CSM6

### Unit Tests

```bash
# Run CSM6-specific tests
npm test -- --testNamePattern="csm6"

# Run security tests
npm test -- --testNamePattern="security"

# Run PII tests
npm test -- --testNamePattern="PII"
```

---

### Integration Tests

```bash
# Start server
npm run serve:force

# Run integration tests
npm run test:integration
```

---

### Manual Testing

```javascript
// Test file: test-csm6.js
const { verify } = require('./dist/verify');

async function testCSM6() {
  // Test 1: Safe content
  const safe = await verify({ content: 'This is safe content' });
  console.log('Safe content:', safe.csm6.passed);
  
  // Test 2: PII detection
  const pii = await verify({ content: 'SSN: 123-45-6789' });
  console.log('PII detected:', pii.csm6.findings.length > 0);
  
  // Test 3: SQL injection
  const sql = await verify({ content: 'SELECT * FROM users WHERE 1=1' });
  console.log('SQL injection:', sql.csm6.findings.some(f => f.type === 'sql_injection'));
  
  // Test 4: Command injection
  const cmd = await verify({ content: 'rm -rf /' });
  console.log('Command injection:', cmd.csm6.findings.some(f => f.type === 'dangerous_command'));
}

testCSM6();
```

---

## Best Practices

### 1. Choose the Right Profile

- **Development:** Use `baseline`
- **Production:** Use `high_risk`
- **Healthcare:** Use `health`
- **Finance:** Use `finance`
- **Research:** Use `research`

---

### 2. Configure PII Detection

Enable only categories you need:

```javascript
// Good: Specific categories
pii: {
  enabled: true,
  categories: ['personal', 'financial']
}

// Avoid: All categories (slower)
pii: {
  enabled: true,
  categories: ['personal', 'financial', 'credential', 'location', 'health']
}
```

---

### 3. Handle Findings Appropriately

```javascript
const result = await verify({ content: aiResponse });

if (!result.csm6.passed) {
  // Log for audit
  console.error('Security violation:', result.csm6.findings);
  
  // Block response
  return { error: 'Content failed security checks' };
}

// Safe to use
return { content: aiResponse };
```

---

### 4. Test Regularly

```bash
# Before deployment
npm run prepublishOnly

# Integration tests
npm run test:integration

# Security-specific tests
npm test -- --testNamePattern="security"
```

---

## Troubleshooting

### Issue: False Positives

**Solution:** Adjust sensitivity

```javascript
pii: {
  enabled: true,
  minSeverity: 'high'  // Only critical findings
}
```

---

### Issue: Missing Detections

**Solution:** Use stricter profile

```javascript
csm6: {
  enabled: true,
  profile: 'high_risk'  // More thorough checks
}
```

---

### Issue: Slow Performance

**Solution:** Disable unnecessary checks

```javascript
csm6: {
  enabled: true,
  checks: {
    security: true,
    privacy: true,
    safety: false,      // Disable if not needed
    fairness: false,
    reliability: false,
    transparency: false
  }
}
```

---

## Summary

**CSM6 is:**
- Automatic (runs with verify)
- Configurable (5 profiles)
- Comprehensive (OWASP LLM Top 10)
- Compliant (HIPAA, SOC 2, GDPR)

**To use CSM6:**
1. Call `verify()` - CSM6 runs automatically
2. Choose profile based on use case
3. Configure PII detection as needed
4. Handle findings appropriately
5. Test regularly

**No separate command needed - CSM6 is part of verify.**

---

## Quick Reference

```bash
# Verify with CSM6 (automatic)
npx llmverify verify --content "text"

# Test PII detection
node -e "const {verify} = require('./dist/verify'); verify({content: 'SSN: 123-45-6789'}).then(r => console.log(r.csm6.findings));"

# Test SQL injection
node -e "const {verify} = require('./dist/verify'); verify({content: 'SELECT * FROM users'}).then(r => console.log(r.csm6.findings));"

# Run security tests
npm test -- --testNamePattern="security"
```

---

## More Information

- Full API: See [API-REFERENCE.md](API-REFERENCE.md)
- CLI Commands: See [CLI-REFERENCE.md](CLI-REFERENCE.md)
- Compliance: See [ENTERPRISE-COMPLIANCE.md](ENTERPRISE-COMPLIANCE.md)
- Commands: See [COMMANDS.md](COMMANDS.md)
