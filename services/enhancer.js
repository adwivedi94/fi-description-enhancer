/**
 * AI Enhancement Service - OpenAI Integration
 * 
 * Uses GPT-4 to enhance F&I product descriptions with:
 * - Better grammar and clarity
 * - Professional, persuasive language
 * - Proper structure and formatting
 * - Compliance-safe wording
 */

require('dotenv').config();
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// System prompt for F&I description enhancement
const SYSTEM_PROMPT = `You are an expert F&I (Finance & Insurance) product description writer for automotive dealerships.

Your task is to enhance product descriptions to be professional, persuasive, and compliance-safe.

PERSUASION PRINCIPLES (apply these techniques):

1. BENEFIT-FIRST LANGUAGE
   - Lead with what the customer gains, not the product features
   - Instead of "This plan covers repairs" → "Enjoy worry-free ownership with covered repairs"
   - Focus on emotional benefits: peace of mind, confidence, convenience

2. SPECIFICITY & CREDIBILITY
   - Use concrete numbers and details when available
   - Instead of "great coverage" → "coverage up to $800 for key replacement"
   - Specific claims are more believable than vague promises

3. FUTURE-PACING
   - Help customers visualize positive outcomes
   - "Imagine driving with confidence knowing unexpected repairs won't impact your budget"
   - Use phrases like "you'll enjoy", "you can expect", "picture yourself"

4. LOSS AVERSION (ethical framing)
   - Frame as avoiding hassle, not fear-mongering
   - Instead of "You'll lose money!" → "Avoid unexpected out-of-pocket expenses"
   - Focus on protection and prevention, not worst-case scenarios

5. ACTIVE VOICE & ACTION WORDS
   - Use strong, direct verbs
   - Instead of "Repairs are covered by this plan" → "This plan covers repairs"
   - Power words: protect, enjoy, receive, gain, ensure, maintain

IMPORTANT RULES:
- NEVER use prohibited words: "guarantee", "guaranteed", "never", "always", "mandatory", "required by law", "best", "ultimate", "act now", "limited time"
- NEVER use fear-based language or high-pressure tactics
- NEVER use multiple exclamation points
- Always be factual and accurate

For SHORT descriptions:
- Maximum 3 sentences, under 200 characters
- Plain text only (no HTML)
- Concise, impactful, benefit-focused

For LONG descriptions:
- Use HTML formatting: <p>, <strong>, <em>, <ul>, <li>, <br>
- Include clear section headers (Overview, Key Benefits, Coverage Highlights)
- Use bullet points for features/benefits
- Be comprehensive but scannable`;


/**
 * Enhance descriptions using OpenAI GPT-4
 * @param {string} shortDescription - Existing short description
 * @param {string} longDescription - Existing long description
 * @returns {Promise<{shortDescription: string, longDescription: string}>}
 */
/**
 * Enhance descriptions using Proxy or Local OpenAI
 */
async function enhanceDescriptions(shortDescription, longDescription) {
    const hasShort = shortDescription && shortDescription.trim();
    const hasLong = longDescription && longDescription.trim();
    const workerUrl = process.env.CLOUDFLARE_WORKER_URL;

    // Preference: Use Cloudflare Worker if configured
    if (workerUrl) {
        try {
            const response = await fetch(`${workerUrl.replace(/\/$/, '')}/enhance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shortDescription: shortDescription || '',
                    longDescription: longDescription || ''
                })
            });

            if (!response.ok) throw new Error(`Worker status: ${response.status}`);
            const result = await response.json();

            // If we only wanted one enhanced but got both from worker, that's fine
            return {
                shortDescription: result.shortDescription || '',
                longDescription: result.longDescription || ''
            };
        } catch (error) {
            console.error('Worker enhancement failed, trying local fallback if key exists:', error.message);
            if (!process.env.OPENAI_API_KEY) throw error;
        }
    }

    // Local OpenAI Fallback
    let enhancedShort = '';
    let enhancedLong = '';

    if (hasShort && hasLong) {
        // Both provided - enhance both
        [enhancedShort, enhancedLong] = await Promise.all([
            enhanceShortDescription(shortDescription),
            enhanceLongDescription(longDescription)
        ]);
    } else if (hasShort) {
        // Only short provided - enhance it AND generate a long one from it
        enhancedShort = await enhanceShortDescription(shortDescription);
        enhancedLong = await enhanceLongDescription(shortDescription);
    } else if (hasLong) {
        // Only long provided - enhance it AND generate a short one from it
        enhancedLong = await enhanceLongDescription(longDescription);
        enhancedShort = await enhanceShortDescription(longDescription);
    }

    return {
        shortDescription: enhancedShort,
        longDescription: enhancedLong
    };
}

/**
 * Enhance a short description
 */
async function enhanceShortDescription(text) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Enhance this F&I product SHORT description. 

CRITICAL REQUIREMENTS:
- MAXIMUM 200 characters total (this is strict - count them!)
- 1-2 sentences only
- Plain text only (no HTML)
- Professional and compelling

Original: "${text}"

Respond with ONLY the enhanced description, nothing else. Must be under 200 characters.`
                }
            ],
            max_tokens: 100,
            temperature: 0.7
        });

        let result = response.choices[0].message.content.trim();

        // Enforce 200 character limit
        if (result.length > 200) {
            result = result.substring(0, 197) + '...';
        }

        return result;
    } catch (error) {
        console.error('OpenAI API error (short):', error.message);
        // Fallback to original if API fails
        return text.substring(0, 200);
    }
}

/**
 * Enhance a long description
 */
async function enhanceLongDescription(text) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Enhance this F&I product LONG description. Use HTML formatting with <p>, <strong>, <em>, <ul>, <li> tags. Make it professional, well-structured, and comprehensive.

Include:
- A clear overview paragraph
- Key benefits as bullet points
- Coverage highlights

Original: "${text}"

Respond with ONLY the enhanced HTML description, nothing else. Do not wrap in code blocks.`
                }
            ],
            max_tokens: 800,
            temperature: 0.7
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('OpenAI API error (long):', error.message);
        // Fallback to original if API fails
        return text;
    }
}

/**
 * Generate a long description from a short one
 */
async function generateLongFromShort(shortText) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Based on this short F&I product description, create a comprehensive LONG description. Use HTML formatting with <p>, <strong>, <em>, <ul>, <li> tags.

Include:
- A clear overview paragraph explaining the product
- Key benefits as bullet points
- What the coverage includes
- Why it's valuable for the customer

Short description: "${shortText}"

Respond with ONLY the HTML description, nothing else. Do not wrap in code blocks.`
                }
            ],
            max_tokens: 800,
            temperature: 0.7
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('OpenAI API error (generate long):', error.message);
        return `<p>${shortText}</p>`;
    }
}

/**
 * Generate a short description from a long one
 */
async function generateShortFromLong(longText) {
    try {
        // Strip HTML for context
        const plainText = longText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Summarize this F&I product description into a SHORT description.

CRITICAL REQUIREMENTS:
- MAXIMUM 200 characters total (this is strict!)
- 1-2 sentences only
- Plain text only (no HTML)
- Concise and impactful

Full description: "${plainText}"

Respond with ONLY the short description, nothing else. Must be under 200 characters.`
                }
            ],
            max_tokens: 100,
            temperature: 0.7
        });

        let result = response.choices[0].message.content.trim();

        // Enforce 200 character limit
        if (result.length > 200) {
            result = result.substring(0, 197) + '...';
        }

        return result;
    } catch (error) {
        console.error('OpenAI API error (generate short):', error.message);
        const plainText = longText.replace(/<[^>]*>/g, ' ').trim();
        return plainText.substring(0, 197) + '...';
    }
}

module.exports = {
    enhanceDescriptions,
    enhanceShortDescription,
    enhanceLongDescription,
    generateLongFromShort,
    generateShortFromLong
};
