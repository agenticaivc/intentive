# Drew Barrymore Protocol - AI Agent Implementation Guidance

## 🎬 MANDATORY DAILY BRIEFING PROTOCOL

### Self-Awareness Reminders
- You are Claude 4 Sonnet autonomous coding agent
- You have a history of interface method assumption errors
- You MUST verify every method call with 'Go to Definition'
- You have anti-patterns documented: Feature Rush Syndrome, Interface Drift

### 🚨 MANDATORY PROTOCOLS (ARCHITECTURAL REQUIREMENTS)

#### 1. INTERFACE VERIFICATION PROTOCOL (MANDATORY)
- Before calling ANY method on an existing class, you MUST verify it exists
- Use code reading tools to check the actual class definition
- NEVER assume method names (sendEmailAlert vs sendEmailNotification)
- Check INTERFACE_REFERENCE.md for common errors to avoid

**Example Verification Process:**
```bash
# Before calling alertEngine.sendEmailAlert (WRONG!)
# First verify what methods actually exist:
grep -n "send.*Email|send.*Slack|sendAlert|createManualAlert" src/utils/alert-engine.ts
# Then use the ACTUAL method names found
```

#### 2. INCREMENTAL VALIDATION PROTOCOL (MANDATORY)
- After modifying each file, run: `npx tsc --noEmit --skipLibCheck`
- Fix any NEW TypeScript errors immediately before proceeding
- NEVER accumulate multiple files with errors

#### 3. TYPE SAFETY PROTOCOL (MANDATORY)
- NO `any` types unless absolutely necessary with justification
- NO `Partial<T>` where full `T` is required
- NO missing required properties in object construction

#### 4. FEATURE RUSH PREVENTION (MANDATORY)
- If implementing exciting features, PAUSE and double-check protocols
- Verify you're not making assumptions about existing code
- Break large changes into small, validated increments

### Common Interface Errors to Avoid
- `sendEmailAlert` → WRONG! Use: `sendEmailNotification`
- `sendSlackAlert` → WRONG! Use: `sendSlackNotification`
- `sendAlert` → WRONG! Use: `createManualAlert`

### Branch Naming Convention
- Format: `issue{N}-claude-YYYYMMDD_HHMMSS`
- Example: `issue123-claude-20240315_143022`

### Validation Checkpoints
After each logical change:
1. Run `npx tsc --noEmit --skipLibCheck`
2. Fix any NEW errors before proceeding
3. Document any interface methods you call

### Success Metrics
- ✅ Daily Briefing Protocol: COMPLETED
- ✅ Interface Verification Protocol: PASSED/FAILED
- ✅ Incremental Validation Protocol: PASSED/FAILED
- ✅ Type Safety Protocol: PASSED/FAILED

## Usage
Reference this file by typing `@drew` in conversations to activate protocol awareness. 