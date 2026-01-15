/**
 * PDF Extraction Service
 * 
 * Extracts text from PDF files and uses OpenAI to generate 
 * professional F&I product descriptions
 */

require('dotenv').config();
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');

// Initialize OpenAI client lazily to avoid errors on environments (like Render) 
// that use the Cloudflare Worker proxy instead of a local API key.
const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

/**
 * Extract text and generate descriptions from a PDF
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<Object>} - Extraction result
 */
async function extractFromPDF(pdfBuffer) {
    try {
        // Parse PDF
        const data = await pdfParse(pdfBuffer);

        if (!data.text || data.text.trim().length < 50) {
            return {
                success: false,
                error: 'No text could be extracted from this PDF. The file may be image-based or corrupted.'
            };
        }

        // Analyze the extracted text for metadata
        const analysis = analyzeText(data.text);

        // Calculate confidence score
        const confidence = calculateConfidence(data.text, analysis);

        // Generate descriptions using OpenAI
        const { shortDescription, longDescription } = await generateDescriptionsWithAI(data.text, analysis);

        return {
            success: true,
            shortDescription,
            longDescription,
            confidence,
            sections: analysis,
            rawTextLength: data.text.length,
            pageCount: data.numpages
        };
    } catch (error) {
        console.error('PDF parsing error:', error);
        return {
            success: false,
            error: 'Failed to process PDF. Please try a different file.'
        };
    }
}

/**
 * Generate descriptions using Cloudflare Worker Proxy from PDF text
 */
async function generateDescriptionsWithAI(rawText, analysis) {
    // Truncate text if too long (to fit in context)
    const maxChars = 8000;
    const truncatedText = rawText.length > maxChars
        ? rawText.substring(0, maxChars) + '...[truncated]'
        : rawText;

    const productType = analysis.productType || 'F&I protection product';
    const workerUrl = process.env.CLOUDFLARE_WORKER_URL;

    // Fast fallback if worker URL is not configured
    if (!workerUrl) {
        console.warn('CLOUDFLARE_WORKER_URL not configured, using basic fallback');
        return {
            shortDescription: generateFallbackShort(analysis),
            longDescription: generateFallbackLong(analysis)
        };
    }

    try {
        const response = await fetch(`${workerUrl.replace(/\/$/, '')}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rawText: truncatedText,
                productType: productType
            })
        });

        if (!response.ok) {
            throw new Error(`Worker status: ${response.status}`);
        }

        const result = await response.json();

        return {
            shortDescription: result.shortDescription || '',
            longDescription: result.longDescription || ''
        };
    } catch (error) {
        console.error('Cloudflare Worker error (PDF generation):', error.message);
        // Fallback to basic extraction
        return {
            shortDescription: generateFallbackShort(analysis),
            longDescription: generateFallbackLong(analysis)
        };
    }
}

/**
 * Fallback short description generator
 */
function generateFallbackShort(analysis) {
    const productType = analysis.productType || 'This protection';
    return `${productType} covers repairs and services to protect your vehicle investment.`.substring(0, 200);
}

/**
 * Fallback long description generator
 */
function generateFallbackLong(analysis) {
    const parts = [];
    const productType = analysis.productType || 'This protection';

    parts.push(`<p>${productType} provides valuable coverage for your vehicle, helping you avoid unexpected repair costs.</p>`);

    if (analysis.coverage.length > 0) {
        parts.push('<p><strong>Coverage Includes:</strong></p>');
        parts.push('<ul>');
        for (const item of analysis.coverage.slice(0, 5)) {
            parts.push(`<li>${capitalizeFirst(item)}</li>`);
        }
        parts.push('</ul>');
    }

    return parts.join('\n');
}

/**
 * Analyze extracted text to identify key sections
 * @param {string} text - Raw extracted text
 * @returns {Object} - Identified sections
 */
function analyzeText(text) {
    const sections = {
        coverage: [],
        benefits: [],
        limitations: [],
        disclaimers: [],
        productName: null,
        productType: null
    };

    // Normalize text
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    // Try to identify product name (usually in first few lines)
    const productNamePatterns = [
        /^(.+(?:protection|coverage|warranty|plan|guard|shield|care))/im,
        /product\s*name:?\s*(.+)/i,
        /^([A-Z][A-Za-z\s&]+(?:Plan|Coverage|Protection))/m
    ];

    for (const pattern of productNamePatterns) {
        const match = normalizedText.match(pattern);
        if (match) {
            sections.productName = match[1].trim().substring(0, 100);
            break;
        }
    }

    // Identify product type
    const productTypes = {
        'tire': 'Tire & Wheel Protection',
        'wheel': 'Tire & Wheel Protection',
        'gap': 'GAP Coverage',
        'guaranteed asset': 'GAP Coverage',
        'warranty': 'Extended Warranty',
        'service contract': 'Vehicle Service Contract',
        'maintenance': 'Prepaid Maintenance',
        'paint': 'Paint Protection',
        'interior': 'Interior Protection',
        'theft': 'Theft Protection',
        'key': 'Key Replacement',
        'dent': 'Dent Repair',
        'windshield': 'Windshield Protection',
        'wear': 'Wear & Tear Coverage'
    };

    const lowerText = normalizedText.toLowerCase();
    for (const [keyword, type] of Object.entries(productTypes)) {
        if (lowerText.includes(keyword)) {
            sections.productType = type;
            break;
        }
    }

    // Extract coverage items
    const coveragePatterns = [
        /(?:covers?|covered|includes?|including|protection for)[:\s]+([^.]+)/gi,
        /(?:we will|we'll|coverage includes)[:\s]+([^.]+)/gi,
    ];

    for (const pattern of coveragePatterns) {
        let match;
        while ((match = pattern.exec(normalizedText)) !== null) {
            const item = match[1].trim();
            if (item.length > 10 && item.length < 200) {
                sections.coverage.push(cleanItem(item));
            }
        }
    }

    // Extract benefits, limitations, disclaimers (for confidence scoring)
    const extractions = [
        { key: 'benefits', patterns: [/benefit:?\s*([^.]+)/gi, /features?[:\s]+([^.]+)/gi] },
        { key: 'limitations', patterns: [/limitations?[:\s]+([^.]+)/gi, /exclusions?[:\s]+([^.]+)/gi] },
        { key: 'disclaimers', patterns: [/disclaimer[:\s]+([^.]+)/gi, /terms and conditions[:\s]+([^.]+)/gi, /please review your contract/gi] }
    ];

    for (const { key, patterns } of extractions) {
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(normalizedText)) !== null) {
                const item = match[1] ? match[1].trim() : match[0].trim();
                if (item && item.length > 5) {
                    sections[key].push(cleanItem(item));
                }
            }
        }
    }

    // Extract bullet-point style items as coverage
    for (const line of lines) {
        if (/^[•\-\*]\s/.test(line)) {
            const item = line.replace(/^[•\-\*]\s*/, '').trim();
            if (item.length > 10 && !sections.coverage.includes(item)) {
                sections.coverage.push(cleanItem(item));
            }
        }
    }

    // Deduplicate and limit
    sections.coverage = [...new Set(sections.coverage)].slice(0, 10);
    sections.benefits = [...new Set(sections.benefits)].slice(0, 5);
    sections.limitations = [...new Set(sections.limitations)].slice(0, 5);
    sections.disclaimers = [...new Set(sections.disclaimers)].slice(0, 3);

    return sections;
}

/**
 * Clean an extracted item
 */
function cleanItem(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/^[,.\s]+/, '')
        .replace(/[,.\s]+$/, '')
        .trim();
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Calculate confidence score based on extraction quality
 * @param {string} rawText - Raw extracted text
 * @param {Object} analysis - Analysis results
 * @returns {number} - Confidence score 0-1
 */
function calculateConfidence(rawText, analysis) {
    let score = 0.5; // Base score

    // Text length factor
    if (rawText.length > 1000) score += 0.1;
    if (rawText.length > 5000) score += 0.1;

    // Product identification
    if (analysis.productName) score += 0.1;
    if (analysis.productType) score += 0.05;

    // Coverage items found
    if (analysis.coverage.length >= 3) score += 0.1;
    if (analysis.coverage.length >= 5) score += 0.05;

    // Sections found (benefits, limitations, disclaimers)
    if (analysis.benefits && analysis.benefits.length > 0) score += 0.05;
    if (analysis.limitations && analysis.limitations.length > 0) score += 0.05;
    if (analysis.disclaimers && analysis.disclaimers.length > 0) score += 0.05;

    // Text quality indicators
    const hasProperSentences = /[A-Z][^.]+\./g.test(rawText);
    if (hasProperSentences) score += 0.05;

    // Penalty for very short or garbled text
    if (rawText.length < 500) score -= 0.1;

    // Check for common OCR issues
    const garbageRatio = (rawText.match(/[^\w\s.,;:'"!?()-]/g) || []).length / rawText.length;
    if (garbageRatio > 0.1) score -= 0.15;

    // Clamp to 0-1 range
    return Math.max(0, Math.min(1, score));
}

module.exports = {
    extractFromPDF,
    analyzeText,
    calculateConfidence
};
