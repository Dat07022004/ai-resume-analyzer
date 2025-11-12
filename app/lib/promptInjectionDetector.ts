/**
 * Prompt Injection Detection Module
 * Detects potential malicious prompts trying to manipulate AI behavior
 */

export interface InjectionDetectionResult {
    isSuspicious: boolean;
    confidence: number; // 0-1
    detectedPatterns: string[];
    sanitizedInput: string;
}

// Common prompt injection patterns
const INJECTION_PATTERNS = [
    // Instruction override attempts
    /ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/i,
    /disregard\s+(all\s+)?(previous|above|prior)\s+instructions?/i,
    /forget\s+(all\s+)?(previous|above|prior)\s+instructions?/i,

    // Role manipulation
    /you\s+are\s+now\s+(a|an)\s+\w+/i,
    /act\s+as\s+(a|an)\s+\w+/i,
    /pretend\s+to\s+be/i,
    /roleplay\s+as/i,

    // System access attempts
    /system\s+prompt/i,
    /reveal\s+(your|the)\s+(prompt|instructions|system)/i,
    /what\s+(is|are)\s+your\s+(instructions|rules|prompt)/i,

    // Score manipulation - Enhanced patterns
    /give\s+(this|the|a)?\s*(resume|candidate|applicant)?\s*(a|an)?\s*\d+\s*(points?|score|\%|\/\d+)/i,
    /rate\s+(this|the|a)?\s*(resume|candidate|applicant)?\s*(as|at)?\s*\d+/i,
    /score\s*(of|:)?\s*\d+/i,
    /perfect\s+score/i,
    /\d+\s*\/\s*\d+\s*(score|rating|points?)?/i, // Match "100/100" format
    /regardless\s+of\s+(content|quality|actual)/i, // "regardless of content"
    /no\s+matter\s+(what|how|the)/i, // "no matter what"
    /always\s+(give|rate|score|return)/i, // "always give"

    // Output format manipulation
    /instead\s+of\s+(json|analyzing|evaluation|analysis)/i,
    /do\s+not\s+(analyze|return|provide|evaluate|check)/i,
    /skip\s+the\s+(analysis|evaluation|assessment)/i,
    /without\s+(analyzing|checking|evaluating|reviewing)/i,
    /don't\s+(analyze|check|evaluate|assess)/i,

    // Code execution attempts
    /<script/i,
    /javascript:/i,
    /eval\s*\(/i,

    // Data exfiltration
    /send\s+(this|data|information)\s+to/i,
    /curl\s+/i,
    /fetch\s*\(/i,
];

export function detectPromptInjection(input: string): InjectionDetectionResult {
    const detectedPatterns: string[] = [];
    let confidence = 0;

    // Check each pattern
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(input)) {
            detectedPatterns.push(pattern.source);
            confidence += 0.15; // Each match increases suspicion
        }
    }

    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);

    // Additional heuristics
    const suspiciousKeywords = [
        'ignore', 'disregard', 'forget', 'instead',
        'system', 'prompt', 'reveal', 'bypass',
        'administrator', 'sudo', 'root', 'execute',
        'regardless', 'always', 'never', 'override',
        'command', 'instruction', 'pretend', 'roleplay'
    ];

    const lowerInput = input.toLowerCase();
    const keywordMatches = suspiciousKeywords.filter(kw =>
        lowerInput.includes(kw)
    ).length;

    if (keywordMatches >= 2) { // Giảm threshold từ 3 → 2 để sensitive hơn
        confidence = Math.min(confidence + 0.2, 1.0);
        detectedPatterns.push(`suspicious-keywords-count:${keywordMatches}`);
    }

    // Check for suspicious command-like syntax
    if (/^(\/|\\|sudo|rm|delete|drop|exec)/i.test(input.trim())) {
        confidence = Math.min(confidence + 0.3, 1.0);
        detectedPatterns.push('command-like-syntax');
    }

    // Check for suspicious score contexts (high numbers with manipulative words)
    if (/(100|perfect|maximum|highest|best)\s*(score|rating|points?|\/100)/i.test(lowerInput)) {
        if (/(give|rate|assign|award|provide).*(100|perfect)/i.test(lowerInput)) {
            confidence = Math.min(confidence + 0.25, 1.0);
            detectedPatterns.push('suspicious-perfect-score-request');
        }
    }

    // Check for conditional manipulation ("regardless of", "no matter")
    if (/(regardless|nomatter|irrespective|despite).*(content|quality|actual|real)/i.test(lowerInput.replace(/\s/g, ''))) {
        confidence = Math.min(confidence + 0.3, 1.0);
        detectedPatterns.push('conditional-override-detected');
    }

    const isSuspicious = confidence > 0.25; // Threshold for suspicion (lowered for better detection)

    // Sanitize by removing detected patterns
    let sanitizedInput = input;
    if (isSuspicious) {
        for (const pattern of INJECTION_PATTERNS) {
            sanitizedInput = sanitizedInput.replace(pattern, '[REDACTED]');
        }
    }

    return {
        isSuspicious,
        confidence,
        detectedPatterns,
        sanitizedInput
    };
}

/**
 * Get human-readable warning message based on detection result
 */
export function getInjectionWarningMessage(result: InjectionDetectionResult): string {
    if (!result.isSuspicious) return '';

    const confidencePercent = Math.round(result.confidence * 100);

    if (confidencePercent >= 70) {
        return `⚠️ HIGH RISK: Detected potential prompt injection attack (${confidencePercent}% confidence). Input has been sanitized.`;
    } else if (confidencePercent >= 40) {
        return `⚠️ MEDIUM RISK: Suspicious patterns detected (${confidencePercent}% confidence). Please review your input.`;
    } else {
        return `⚠️ LOW RISK: Some unusual patterns detected (${confidencePercent}% confidence).`;
    }
}
