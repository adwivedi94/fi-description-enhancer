/**
 * HTML Sanitizer Service
 * 
 * Sanitizes HTML content to only allow safe tags per PRD Section 8.4:
 * - Allowed tags: <p>, <strong>, <em>, <ul>, <li>, <br>
 * - Allowed attributes: style (for disclaimer font-size)
 * - Removes: scripts, event handlers, javascript: URLs, all other tags
 */

// Whitelist of allowed tags
const ALLOWED_TAGS = new Set(['p', 'strong', 'em', 'ul', 'li', 'br', 'span']);

// Allowed style properties (for disclaimer smaller font)
const ALLOWED_STYLE_PROPERTIES = new Set(['font-size', 'font-style']);

// Patterns to detect dangerous content
const DANGEROUS_PATTERNS = [
    /javascript:/gi,
    /vbscript:/gi,
    /data:/gi,
    /on\w+\s*=/gi,  // Event handlers like onclick=, onerror=
    /<script[\s\S]*?<\/script>/gi,
    /<script[\s\S]*?>/gi,
    /<\/script>/gi,
    /<iframe[\s\S]*?>/gi,
    /<object[\s\S]*?>/gi,
    /<embed[\s\S]*?>/gi,
    /<link[\s\S]*?>/gi,
    /<meta[\s\S]*?>/gi,
    /<style[\s\S]*?<\/style>/gi,
    /<style[\s\S]*?>/gi,
];

/**
 * Sanitize a style attribute value
 * Only allows font-size and font-style properties
 */
function sanitizeStyle(styleValue) {
    if (!styleValue) return '';

    const sanitizedParts = [];
    const parts = styleValue.split(';');

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) continue;

        const property = trimmed.substring(0, colonIndex).trim().toLowerCase();
        const value = trimmed.substring(colonIndex + 1).trim();

        // Only allow whitelisted properties
        if (ALLOWED_STYLE_PROPERTIES.has(property)) {
            // Validate value doesn't contain dangerous content
            if (!value.includes('expression') &&
                !value.includes('javascript') &&
                !value.includes('url(')) {
                sanitizedParts.push(`${property}: ${value}`);
            }
        }
    }

    return sanitizedParts.join('; ');
}

/**
 * Parse and sanitize HTML attributes
 * Only allows style attribute with sanitized values
 */
function sanitizeAttributes(attributeString) {
    if (!attributeString) return '';

    // Extract style attribute if present
    const styleMatch = attributeString.match(/style\s*=\s*["']([^"']*)["']/i);

    if (styleMatch) {
        const sanitizedStyle = sanitizeStyle(styleMatch[1]);
        if (sanitizedStyle) {
            return ` style="${sanitizedStyle}"`;
        }
    }

    return '';
}

/**
 * Main sanitization function
 * @param {string} html - The HTML string to sanitize
 * @returns {string} - Sanitized HTML string
 */
function sanitizeHTML(html) {
    if (!html || typeof html !== 'string') {
        return '';
    }

    let sanitized = html;

    // First pass: Remove obviously dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
        sanitized = sanitized.replace(pattern, '');
    }

    // Second pass: Process tags - keep only allowed tags
    // Match all HTML tags
    sanitized = sanitized.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\s*([^>]*)>/gi, (match, tagName, attributes) => {
        const lowerTag = tagName.toLowerCase();

        // Check if tag is in whitelist
        if (!ALLOWED_TAGS.has(lowerTag)) {
            // Remove disallowed tags but keep their content (for non-void tags)
            return '';
        }

        // Check if it's a closing tag
        if (match.startsWith('</')) {
            return `</${lowerTag}>`;
        }

        // For void tags like <br>, no attributes needed
        if (lowerTag === 'br') {
            return '<br>';
        }

        // Sanitize attributes for allowed tags
        const sanitizedAttrs = sanitizeAttributes(attributes);

        return `<${lowerTag}${sanitizedAttrs}>`;
    });

    // Third pass: Remove any remaining dangerous content that might have slipped through
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+=/gi, '');

    // Clean up any empty tags that might be left
    sanitized = sanitized.replace(/<(\w+)[^>]*>\s*<\/\1>/gi, (match, tag) => {
        // Keep empty paragraphs for spacing, remove others
        if (tag.toLowerCase() === 'p') return match;
        return '';
    });

    return sanitized.trim();
}

/**
 * Validate that HTML only contains allowed content
 * @param {string} html - The HTML to validate
 * @returns {{valid: boolean, issues: string[]}} - Validation result
 */
function validateHTML(html) {
    const issues = [];

    if (!html || typeof html !== 'string') {
        return { valid: true, issues: [] };
    }

    // Check for disallowed tags
    const tagMatches = html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)/gi);
    for (const match of tagMatches) {
        const tag = match[1].toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) {
            issues.push(`Disallowed tag: <${tag}>`);
        }
    }

    // Check for dangerous patterns
    if (/javascript:/i.test(html)) {
        issues.push('Contains javascript: URL');
    }
    if (/on\w+\s*=/i.test(html)) {
        issues.push('Contains event handler');
    }
    if (/<script/i.test(html)) {
        issues.push('Contains script tag');
    }

    return {
        valid: issues.length === 0,
        issues
    };
}

module.exports = {
    sanitizeHTML,
    validateHTML,
    sanitizeStyle,
    ALLOWED_TAGS
};
