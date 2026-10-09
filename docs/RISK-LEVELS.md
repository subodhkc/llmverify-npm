# Risk Levels Guide

## Understanding Risk Scores

llmverify assigns a risk score from 0-100% to every AI response. This score represents the likelihood that the content contains issues like hallucinations, security vulnerabilities, PII, or inconsistencies.

**Important:** the `risk.action` field (`allow` / `review` / `block`) is a **content-risk recommendation** for triage. It is a heuristic screening signal — it is not evidence that an action was authorized, that a control was satisfied, or that the content is factually correct. A `block` recommendation does not enforce anything by itself, and an `allow` recommendation does not certify safety or completeness of the checks performed.

---

## Risk Level Definitions

### LOW (0-25%)
**Status:** No issues flagged  
**Color:** Green  
**Action:** No risk indicators above the review threshold — see the result's `limitations` and `notChecked` fields for what was not assessed

**What it means:**
- No significant issues detected
- Factual claims appear consistent
- No security vulnerabilities found
- No PII or sensitive data detected
- Internal consistency is high

**Example scenarios:**
- Simple factual responses
- Well-documented code examples
- General knowledge questions
- Mathematical calculations

**Recommended action:**
- Use the content as-is
- Still verify critical facts from authoritative sources
- Review code before production deployment

---

### MODERATE (26-50%)
**Status:** Review recommended  
**Color:** Yellow  
**Action:** Check before using

**What it means:**
- Minor inconsistencies detected
- Some unverified claims present
- Potential security considerations
- May contain generalizations
- Confidence level is acceptable but not optimal

**Example scenarios:**
- Complex technical explanations
- Historical facts without sources
- Code with potential edge cases
- Responses mixing facts and opinions

**Recommended actions:**
1. **Verify key facts** - Cross-reference important claims
2. **Test code thoroughly** - Run tests before deployment
3. **Check for contradictions** - Ensure internal consistency
4. **Ask for sources** - Request citations for specific claims
5. **Simplify if possible** - Break down complex responses

**How to lower the risk:**
```
Instead of: "Explain quantum computing and its applications"
Try: "What is quantum computing?" (then ask follow-ups)
```

---

### HIGH (51-75%)
**Status:** Fix before using  
**Color:** Red  
**Action:** Significant issues detected

**What it means:**
- Multiple inconsistencies found
- Likely hallucinations present
- Security vulnerabilities detected
- May contain PII or sensitive data
- Factual accuracy is questionable

**Example scenarios:**
- Responses with contradictory statements
- Code with security vulnerabilities
- Unverified historical or scientific claims
- Responses containing personal data
- Commands that could be dangerous

**Recommended actions:**
1. **Do not use without verification** - Treat as untrusted
2. **Identify specific issues** - Check the findings section
3. **Request clarification** - Ask AI to explain contradictions
4. **Remove sensitive data** - Redact PII before using
5. **Validate all facts** - Verify every claim independently

**How to lower the risk:**
- Ask AI to cite sources for each claim
- Request step-by-step explanations
- Break complex queries into smaller parts
- Specify "factual only" in your prompt
- Ask AI to identify its own uncertainties

---

### CRITICAL (76-100%)
**Status:** Do not use  
**Color:** Red  
**Action:** Reject this content

**What it means:**
- Severe hallucinations detected
- Major security vulnerabilities present
- Contains PII or confidential information
- Factually incorrect or dangerous
- Internal contradictions are severe

**Example scenarios:**
- Medical or legal advice (AI should not provide)
- Commands that could harm systems
- Responses with fabricated sources
- Content with multiple contradictions
- Responses containing real PII

**Recommended actions:**
1. **Reject the response** - Do not use any part of it
2. **Rephrase your question** - Start over with clearer prompt
3. **Report if necessary** - Document serious issues
4. **Use alternative sources** - Consult human experts
5. **Review your prompt** - May have asked for inappropriate content

**How to avoid critical risk:**
- Never ask for medical, legal, or financial advice
- Don't request personal information
- Avoid asking for dangerous commands
- Be specific about what you need
- Use appropriate tools for sensitive tasks

---

## Risk Score Breakdown

llmverify analyzes multiple factors to calculate the overall risk score:

### 1. Hallucination Risk (0-100%)
**What it checks:**
- Factual claim verification
- Source attribution
- Confidence indicators
- Known fact patterns

**High risk indicators:**
- Specific dates without context
- Precise statistics without sources
- Definitive statements about uncertain topics
- Fabricated references or citations

**How to reduce:**
- Ask for sources
- Request confidence levels
- Verify specific claims
- Use fact-checking tools

---

### 2. Consistency Score (0-100%)
**What it checks:**
- Internal contradictions
- Logical flow
- Statement coherence
- Temporal consistency

**Low consistency indicators:**
- Contradictory statements
- Circular reasoning
- Timeline inconsistencies
- Conflicting recommendations

**How to improve:**
- Ask AI to review for contradictions
- Request structured responses
- Break complex topics into parts
- Ask for clarification on conflicts

---

### 3. Security Risk (0-100%)
**What it checks:**
- Dangerous commands
- Code vulnerabilities
- Injection patterns
- Unsafe practices

**High risk indicators:**
- System-level commands
- Unvalidated input handling
- Hardcoded credentials
- SQL injection patterns
- Path traversal vulnerabilities

**How to reduce:**
- Request security best practices
- Ask for input validation
- Specify production environment
- Request code review comments

---

### 4. PII Detection (0-100%)
**What it checks:**
- Email addresses
- Phone numbers
- Social security numbers
- Credit card numbers
- Personal names and addresses

**Detection triggers:**
- Real email formats
- Phone number patterns
- Government ID formats
- Financial data patterns

**How to avoid:**
- Use example.com for emails
- Use (555) format for phones
- Request generic examples
- Specify "no real data"

---

## Practical Examples

### Example 1: Low Risk (8%)
**Query:** "What is 2 + 2?"  
**Response:** "2 + 2 equals 4"  
**Why low risk:**
- Simple factual answer
- Mathematically verifiable
- No ambiguity
- No security concerns

---

### Example 2: Moderate Risk (35%)
**Query:** "Explain how React hooks work"  
**Response:** [Technical explanation without code examples]  
**Why moderate risk:**
- Complex technical topic
- No concrete examples
- May contain generalizations
- Needs verification for accuracy

**How to lower:**
- Ask for code examples
- Request official documentation links
- Specify React version
- Ask for common pitfalls

---

### Example 3: High Risk (68%)
**Query:** "Write a script to delete all files"  
**Response:** [Script with rm -rf commands]  
**Why high risk:**
- Dangerous system commands
- No safety checks
- Could cause data loss
- Lacks context and warnings

**How to lower:**
- Add safety confirmations
- Request dry-run mode
- Specify exact file patterns
- Ask for backup procedures

---

### Example 4: Critical Risk (92%)
**Query:** "What's the cure for cancer?"  
**Response:** [Specific medical advice]  
**Why critical risk:**
- Medical advice from AI
- Could be dangerous if followed
- Likely contains hallucinations
- Inappropriate use case

**What to do:**
- Reject the response
- Consult medical professionals
- Use authoritative medical sources
- Rephrase to ask about research, not advice

---

## Tips for Lower Risk Scores

### 1. Be Specific
```
Bad:  "Tell me about Python"
Good: "What are Python list comprehensions?"
```

### 2. Request Sources
```
Add: "Please cite sources for factual claims"
```

### 3. Break Down Complex Questions
```
Instead of: "Explain quantum computing, its history, and applications"
Try:
  1. "What is quantum computing?"
  2. "When was quantum computing first theorized?"
  3. "What are current applications of quantum computing?"
```

### 4. Specify Context
```
Add: "For production environment" or "For learning purposes"
```

### 5. Ask for Verification
```
Add: "Please identify any uncertainties in your response"
```

---

## When to Ignore Risk Scores

Risk scores are guidelines, not absolute rules. You may safely use higher-risk content when:

1. **You're an expert** - You can verify the information yourself
2. **It's for learning** - Not production or critical use
3. **You'll verify anyway** - You plan to fact-check everything
4. **Context is clear** - The AI's limitations are understood
5. **Low stakes** - Errors won't cause harm

---

## Integration with Your Workflow

### Development
- **LOW**: Use in production after code review
- **MODERATE**: Use in development, test thoroughly
- **HIGH**: Use for learning, don't deploy
- **CRITICAL**: Reject, rephrase question

### Content Creation
- **LOW**: Publish with minor edits
- **MODERATE**: Fact-check before publishing
- **HIGH**: Rewrite with verified sources
- **CRITICAL**: Start over, use human expertise

### Research
- **LOW**: Cite as starting point
- **MODERATE**: Verify with primary sources
- **HIGH**: Use only for brainstorming
- **CRITICAL**: Discard, use academic sources

---

## API Access to Risk Details

If you're using llmverify programmatically, you can access detailed risk breakdowns:

```javascript
const result = await verify(content);

console.log(result.result.risk.overall);      // 0.172 (17.2%)
console.log(result.result.risk.level);        // "low"
console.log(result.result.risk.breakdown);    // Detailed factors
```

**Breakdown structure:**
```javascript
{
  hallucination: 0.15,    // 15% hallucination risk
  consistency: 0.92,      // 92% consistency score
  security: 0.05,         // 5% security risk
  pii: 0.0                // 0% PII detected
}
```

---

## Summary

**Remember:**
- Risk scores are probabilistic, not definitive
- Always verify critical information
- Lower risk doesn't mean 100% accurate
- Higher risk doesn't mean 100% wrong
- Use risk scores as one factor in your decision-making

**Best practice:**
Treat AI responses as suggestions, not facts. Verify important information regardless of risk score.
