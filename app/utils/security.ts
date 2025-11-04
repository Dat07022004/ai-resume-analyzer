/**
 * Sanitize user input to prevent injection attacks and malformed data
 * @param input - The user input string to sanitize
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns Sanitized string with length limit, control characters removed, and special chars escaped
 */
export const sanitizeInput = (input: string, maxLength: number = 1000): string => {
    if (!input) return '';
    
    // Limit length / Giới hạn độ dài
    let sanitized = input.slice(0, maxLength);
    
    // Remove control characters that could be harmful / Loại bỏ các ký tự đặc biệt có thể gây hại
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Escape characters that could break prompt structure / Escape các ký tự có thể break prompt structure
    sanitized = sanitized.replace(/["'`]/g, (match) => `\\${match}`);
    
    return sanitized.trim();
};

/**
 * Detect Prompt Injection patterns in user input
 * Checks for common attack patterns that attempt to override AI instructions
 * @param input - The user input string to check
 * @returns true if suspicious patterns are detected, false otherwise
 */
export const detectPromptInjection = (input: string): boolean => {
    const dangerousPatterns = [
        /ignore\s+(all\s+)?previous\s+instructions?/i,
        /disregard\s+(all\s+)?previous/i,
        /forget\s+(all\s+)?previous/i,
        /override\s+instructions?/i,
        /new\s+instructions?/i,
        /\[INST\]/i,
        /\[\/INST\]/i,
        /<\|system\|>/i,
        /you\s+are\s+now/i,
        /act\s+as/i,
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(input));
};

/**
 * Validate that AI feedback has the expected structure
 * Ensures all required fields are present and have correct types before saving
 * @param data - The feedback object to validate
 * @returns true if feedback structure is valid, false otherwise
 * 
 * Expected structure:
 * - overallScore: number
 * - ATS: { score: number, tips: array }
 * - toneAndStyle, content, structure, skills: objects with similar structure
 */
export const isValidFeedback = (data: any): boolean => {
    return (
        data &&
        typeof data.overallScore === 'number' &&
        data.ATS &&
        typeof data.ATS.score === 'number' &&
        Array.isArray(data.ATS.tips) &&
        data.toneAndStyle &&
        data.content &&
        data.structure &&
        data.skills
    );
};
