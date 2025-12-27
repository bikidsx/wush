import type { Vulnerability } from '../../types/index.js';

interface SecurityPattern {
  name: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  pattern: RegExp;
  description: string;
  fix: string;
}

export const securityPatterns: SecurityPattern[] = [
  // Hardcoded secrets
  {
    name: 'Hardcoded API Key',
    severity: 'HIGH',
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"`]([a-zA-Z0-9_\-]{20,})['"`]/gi,
    description: 'API key hardcoded in source code',
    fix: 'Use environment variables instead',
  },
  {
    name: 'Hardcoded Password',
    severity: 'HIGH',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"`]([^'"`]{4,})['"`]/gi,
    description: 'Password hardcoded in source code',
    fix: 'Use environment variables or secrets manager',
  },
  {
    name: 'Hardcoded Secret',
    severity: 'HIGH',
    pattern: /(?:secret|token|auth)\s*[:=]\s*['"`]([a-zA-Z0-9_\-]{16,})['"`]/gi,
    description: 'Secret or token hardcoded in source code',
    fix: 'Use environment variables or secrets manager',
  },
  {
    name: 'AWS Access Key',
    severity: 'HIGH',
    pattern: /AKIA[0-9A-Z]{16}/g,
    description: 'AWS access key found in code',
    fix: 'Use AWS credentials file or IAM roles',
  },
  {
    name: 'Private Key',
    severity: 'HIGH',
    pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
    description: 'Private key embedded in code',
    fix: 'Store private keys in secure key management',
  },

  // SQL Injection
  {
    name: 'SQL Injection Risk',
    severity: 'HIGH',
    pattern: /(?:query|execute|exec)\s*\(\s*[`'"].*\$\{.*\}.*[`'"]/gi,
    description: 'Potential SQL injection via string interpolation',
    fix: 'Use parameterized queries or prepared statements',
  },
  {
    name: 'SQL Injection Risk',
    severity: 'HIGH',
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE).*\+\s*(?:req\.|request\.|params\.|body\.)/gi,
    description: 'Potential SQL injection via string concatenation',
    fix: 'Use parameterized queries or ORM',
  },

  // XSS
  {
    name: 'XSS Risk',
    severity: 'HIGH',
    pattern: /innerHTML\s*=\s*(?!['"`])/g,
    description: 'Potential XSS via innerHTML assignment',
    fix: 'Use textContent or sanitize HTML input',
  },
  {
    name: 'XSS Risk',
    severity: 'MEDIUM',
    pattern: /document\.write\s*\(/g,
    description: 'document.write can lead to XSS',
    fix: 'Use DOM manipulation methods instead',
  },

  // Eval and dangerous functions
  {
    name: 'Dangerous eval()',
    severity: 'HIGH',
    pattern: /\beval\s*\(/g,
    description: 'eval() can execute arbitrary code',
    fix: 'Avoid eval(), use safer alternatives',
  },
  {
    name: 'Dangerous Function constructor',
    severity: 'HIGH',
    pattern: /new\s+Function\s*\(/g,
    description: 'Function constructor can execute arbitrary code',
    fix: 'Avoid dynamic function creation',
  },

  // Weak crypto
  {
    name: 'Weak Hash Algorithm',
    severity: 'MEDIUM',
    pattern: /createHash\s*\(\s*['"`](?:md5|sha1)['"`]\s*\)/gi,
    description: 'MD5/SHA1 are cryptographically weak',
    fix: 'Use SHA-256 or stronger algorithms',
  },
  {
    name: 'Math.random for security',
    severity: 'MEDIUM',
    pattern: /Math\.random\s*\(\s*\)/g,
    description: 'Math.random() is not cryptographically secure',
    fix: 'Use crypto.randomBytes() or crypto.getRandomValues()',
  },

  // Insecure configurations
  {
    name: 'Disabled SSL Verification',
    severity: 'HIGH',
    pattern: /rejectUnauthorized\s*:\s*false/g,
    description: 'SSL certificate verification disabled',
    fix: 'Enable SSL verification in production',
  },
  {
    name: 'CORS Allow All',
    severity: 'MEDIUM',
    pattern: /(?:Access-Control-Allow-Origin|cors)\s*[:=]\s*['"`]\*['"`]/gi,
    description: 'CORS allows all origins',
    fix: 'Restrict CORS to specific trusted origins',
  },

  // Path traversal
  {
    name: 'Path Traversal Risk',
    severity: 'HIGH',
    pattern: /(?:readFile|writeFile|unlink|rmdir)\s*\([^)]*(?:req\.|request\.|params\.|body\.)/gi,
    description: 'Potential path traversal vulnerability',
    fix: 'Validate and sanitize file paths',
  },

  // Command injection
  {
    name: 'Command Injection Risk',
    severity: 'HIGH',
    pattern: /(?:exec|spawn|execSync)\s*\([^)]*(?:\$\{|\+\s*(?:req\.|request\.|params\.|body\.))/gi,
    description: 'Potential command injection',
    fix: 'Sanitize inputs and avoid shell commands',
  },

  // Prototype pollution
  {
    name: 'Prototype Pollution Risk',
    severity: 'MEDIUM',
    pattern: /\[['"`]__proto__['"`]\]/g,
    description: 'Potential prototype pollution',
    fix: 'Validate object keys before assignment',
  },

  // Console logs in production
  {
    name: 'Console Log',
    severity: 'LOW',
    pattern: /console\.(log|debug|info)\s*\(/g,
    description: 'Console logs should be removed in production',
    fix: 'Use a proper logging library',
  },

  // TODO/FIXME security
  {
    name: 'Security TODO',
    severity: 'LOW',
    pattern: /(?:TODO|FIXME|HACK).*(?:security|auth|password|secret|token)/gi,
    description: 'Security-related TODO found',
    fix: 'Address security TODOs before deployment',
  },
];

export function scanWithPatterns(code: string, filename: string): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  const lines = code.split('\n');

  for (const pattern of securityPatterns) {
    let match;
    const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
    
    while ((match = regex.exec(code)) !== null) {
      // Find line number
      const beforeMatch = code.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;

      vulnerabilities.push({
        severity: pattern.severity,
        type: pattern.name,
        file: filename,
        line: lineNumber,
        description: pattern.description,
        code: lines[lineNumber - 1]?.trim(),
        fix: pattern.fix,
      });
    }
  }

  return vulnerabilities;
}
