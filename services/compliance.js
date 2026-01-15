/**
 * Compliance Service
 * 
 * Implements compliance validation per PRD Section 6:
 * - Prohibited keyword detection
 * - Disclaimer verification and auto-append
 * - Compliance warning generation
 */

// Prohibited keywords that may require legal review (PRD Section 6.3)
const PROHIBITED_KEYWORDS = [
    { keyword: 'guarantee', pattern: /\bguarantee[ds]?\b/i },
    { keyword: 'never', pattern: /\bnever\b/i },
    { keyword: 'always', pattern: /\balways\b/i },
    { keyword: 'required by law', pattern: /\brequired by law\b/i },
    { keyword: 'mandatory', pattern: /\bmandatory\b/i },
    { keyword: 'best', pattern: /\bbest\b/i },
    { keyword: 'ultimate', pattern: /\bultimate\b/i },
    { keyword: 'act now', pattern: /\bact now\b/i },
    { keyword: 'limited time', pattern: /\blimited time\b/i },
    { keyword: 'don\'t miss', pattern: /\bdon'?t miss\b/i },
];

// Additional warning patterns for manipulative language (PRD Section 5.4)
const MANIPULATIVE_PATTERNS = [
    { pattern: /!{2,}/, message: 'Multiple exclamation points may appear unprofessional' },
    { pattern: /\bwill save you thousands\b/i, message: 'Unverified savings claims' },
    { pattern: /\bbankrupt\b/i, message: 'Fear-based language detected' },
    { pattern: /\bdevastating\b/i, message: 'Fear-based language detected' },
    { pattern: /\byou need this\b/i, message: 'Pressure tactics detected' },
    { pattern: /\beveryone who says no regrets\b/i, message: 'Pressure tactics detected' },
];

// Standard disclaimer template (PRD Section 6.2)
const STANDARD_DISCLAIMER = 'This coverage has limitations and exclusions. Please review the full contract terms for complete details on covered components, service requirements, and exclusions.';

// Disclaimer markers to detect existing disclaimers
const DISCLAIMER_INDICATORS = [
    /limitations and exclusions/i,
    /please review.*contract/i,
    /see contract for.*details/i,
    /terms and conditions apply/i,
    /coverage.*limitations/i,
    /exclusions apply/i,
];

/**
 * Check text for prohibited keywords and manipulative language
 * @param {string} shortDescription - Short description text
 * @param {string} longDescription - Long description HTML
 * @returns {{hasIssues: boolean, warnings: string[]}}
 */
function checkCompliance(shortDescription, longDescription) {
    const warnings = [];
    const combinedText = `${shortDescription || ''} ${longDescription || ''}`;

    // Strip HTML tags for text analysis
    const plainText = combinedText.replace(/<[^>]*>/g, ' ');

    // Check for prohibited keywords
    for (const { keyword, pattern } of PROHIBITED_KEYWORDS) {
        if (pattern.test(plainText)) {
            warnings.push(`Contains "${keyword}" - this language may require legal review`);
        }
    }

    // Check for manipulative patterns
    for (const { pattern, message } of MANIPULATIVE_PATTERNS) {
        if (pattern.test(plainText)) {
            if (!warnings.includes(message)) {
                warnings.push(message);
            }
        }
    }

    return {
        hasIssues: warnings.length > 0,
        warnings
    };
}

/**
 * Check if text contains a disclaimer
 * @param {string} text - Text to check
 * @returns {boolean}
 */
function hasDisclaimer(text) {
    if (!text) return false;

    const plainText = text.replace(/<[^>]*>/g, ' ').toLowerCase();

    return DISCLAIMER_INDICATORS.some(pattern => pattern.test(plainText));
}

/**
 * Ensure long description has a disclaimer, add if missing
 * @param {string} longDescription - Long description HTML
 * @returns {string} - Long description with disclaimer
 */
function ensureDisclaimer(longDescription) {
    if (!longDescription) {
        return `<p><em style="font-size: smaller">${STANDARD_DISCLAIMER}</em></p>`;
    }

    // Check if disclaimer already exists
    if (hasDisclaimer(longDescription)) {
        return longDescription;
    }

    // Append standard disclaimer with proper formatting (PRD Section 6.2)
    // Smaller font, italicized, at the end
    const disclaimerHTML = `<p><em style="font-size: smaller">${STANDARD_DISCLAIMER}</em></p>`;

    return `${longDescription}\n\n${disclaimerHTML}`;
}

/**
 * Get the standard disclaimer HTML
 * @returns {string}
 */
function getStandardDisclaimer() {
    return `<p><em style="font-size: smaller">${STANDARD_DISCLAIMER}</em></p>`;
}

/**
 * Validate content before publishing
 * @param {string} shortDescription 
 * @param {string} longDescription 
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
function validateForPublishing(shortDescription, longDescription) {
    const errors = [];
    const warnings = [];

    // Check short description requirements (PRD Section 5.2)
    if (shortDescription) {
        const sentences = shortDescription.split(/[.!?]+/).filter(s => s.trim());
        if (sentences.length > 3) {
            warnings.push('Short description exceeds 3 sentences');
        }

        // Should be plain text
        if (/<[^>]+>/.test(shortDescription)) {
            errors.push('Short description should be plain text only');
        }
    }

    // Check long description requirements
    if (longDescription) {
        if (!hasDisclaimer(longDescription)) {
            warnings.push('Long description should include a disclaimer');
        }
    }

    // Check compliance
    const compliance = checkCompliance(shortDescription, longDescription);
    warnings.push(...compliance.warnings);

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

module.exports = {
    checkCompliance,
    hasDisclaimer,
    ensureDisclaimer,
    getStandardDisclaimer,
    validateForPublishing,
    STANDARD_DISCLAIMER,
    PROHIBITED_KEYWORDS
};
