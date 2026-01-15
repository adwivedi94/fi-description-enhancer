/**
 * Cloudflare Worker: F&I Description Enhancer Proxy
 * 
 * This worker acts as a secure proxy to the OpenAI API.
 * It stores the API key as a secret and handles the enhancement logic,
 * allowing your frontend to be deployed safely.
 */

export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        if (request.method !== "POST") {
            return new Response("Method Not Allowed", {
                status: 405,
                headers: { "Access-Control-Allow-Origin": "*" }
            });
        }

        const url = new URL(request.url);

        // We handle /enhance and /generate endpoints
        if (url.pathname === "/enhance") {
            try {
                const body = await request.json();
                return await handleEnhancement(body, env);
            } catch (err) {
                return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }
        }

        if (url.pathname === "/generate") {
            try {
                const body = await request.json();
                return await handleGeneration(body, env);
            } catch (err) {
                return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }
        }

        return new Response("Not Found", {
            status: 404,
            headers: { "Access-Control-Allow-Origin": "*" }
        });
    },
};

/**
 * Handle generation request (for PDF text)
 */
async function handleGeneration(data, env) {
    const { rawText, productType } = data;

    if (!env.OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }

    const type = productType || 'F&I protection product';

    try {
        const messages = [
            {
                role: "system",
                content: `You are an expert F&I (Finance & Insurance) product description writer. You extract key information from product documents and create professional, compelling descriptions.
                
                RULES:
                - NEVER use: "guarantee", "never", "always", "mandatory", "best", "ultimate"
                - SHORT description: Max 200 characters, plain text.
                - LONG description: HTML formatted (<p>, <strong>, <ul>, <li>).`
            },
            {
                role: "user",
                content: `Based on this ${type} document, create TWO descriptions (SHORT and LONG).
                
                DOCUMENT TEXT:
                ${rawText}
                
                Return JSON format: { "shortDescription": "...", "longDescription": "..." }`
            }
        ];

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: messages,
                response_format: { type: "json_object" },
                temperature: 0.7
            })
        });

        const aiData = await response.json();
        const result = JSON.parse(aiData.choices[0].message.content);

        return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: "AI generation failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
}

/**
 * Handle enhancement request
 */
async function handleEnhancement(data, env) {
    const { shortDescription, longDescription } = data;

    if (!env.OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured on worker" }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }

    // System Prompt matching our local enhancer.js
    const SYSTEM_PROMPT = `You are an expert F&I (Finance & Insurance) product description writer for automotive dealerships.
Your task is to enhance product descriptions to be professional, persuasive, and compliance-safe.

PERSUASION PRINCIPLES:
1. BENEFIT-FIRST LANGUAGE: Lead with what the customer gains.
2. SPECIFICITY & CREDIBILITY: Use concrete numbers/details.
3. FUTURE-PACING: Help visualize positive outcomes.
4. LOSS AVERSION: Frame as avoiding hassle/out-of-pocket expenses.
5. ACTIVE VOICE: Use strong, direct verbs.

RULES:
- NEVER use: "guarantee", "never", "always", "mandatory", "best", "ultimate"
- Max 3 sentences for SHORT descriptions.
- Use HTML for LONG descriptions: <p>, <strong>, <em>, <ul>, <li>.`;

    // Determine what to enhance
    const requests = [];
    if (shortDescription) {
        requests.push({
            id: 'short',
            role: 'user',
            content: `Enhance this SHORT description (max 3 sentences, plain text): ${shortDescription}`
        });
    }
    if (longDescription) {
        requests.push({
            id: 'long',
            role: 'user',
            content: `Enhance this LONG description (HTML formatted, include headers): ${longDescription}`
        });
    }

    // To keep it simple and fast, we'll process them together or sequentially
    // For this worker, we'll just do one combined prompt or match the specific request

    try {
        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            {
                role: "user",
                content: `Enhance these descriptions:
        ${shortDescription ? `SHORT: ${shortDescription}` : ''}
        ${longDescription ? `LONG: ${longDescription}` : ''}
        
        Return JSON format: { "shortDescription": "...", "longDescription": "..." }`
            }
        ];

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: messages,
                response_format: { type: "json_object" },
                temperature: 0.7
            })
        });

        const aiData = await response.json();
        const result = JSON.parse(aiData.choices[0].message.content);

        return new Response(JSON.stringify(result), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: "AI request failed" }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }
}
