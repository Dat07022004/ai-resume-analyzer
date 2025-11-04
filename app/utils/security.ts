// Sanitize user input
export const sanitizeInput = (input: string, maxLength: number = 1000): string => {
    if (!input) return '';
    
    // Giới hạn độ dài
    let sanitized = input.slice(0, maxLength);
    
    // Loại bỏ các ký tự đặc biệt có thể gây hại
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Escape các ký tự có thể break prompt structure
    sanitized = sanitized.replace(/["'`]/g, (match) => `\\${match}`);
    
    return sanitized.trim();
};

// Phát hiện Prompt Injection patterns
export const detectPromptInjection = (input: string): boolean => {
    const dangerousPatterns = [
        /ignore\s+(all\s+)?previous\s+instructions?/i,
        /disregard\s+(all\s+)?previous/i,
        /forget\s+(all\s+)?previous/i,
        /system\s*:/i,
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

// Validate Feedback structure
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
