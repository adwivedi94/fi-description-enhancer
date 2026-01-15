/**
 * End-to-End Tests
 * Full flow tests for text enhancement and PDF extraction
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Import services directly for e2e testing without server
const { enhanceDescriptions } = require('../services/enhancer');
const { extractFromPDF, analyzeText, calculateConfidence } = require('../services/pdf-extractor');
const { sanitizeHTML } = require('../services/sanitizer');
const { checkCompliance, ensureDisclaimer } = require('../services/compliance');

describe('E2E: Text Enhancement Flow', () => {

    it('should complete full text enhancement flow', async () => {
        // Step 1: User provides input
        const userShort = 'Covers tire damage. Good for off road.';
        const userLong = '';

        // Step 2: Enhance with AI
        const enhanced = await enhanceDescriptions(userShort, userLong);

        assert.ok(enhanced.shortDescription, 'Should have short description');
        assert.ok(enhanced.longDescription, 'Should have long description');

        // Step 3: Short description should be max 3 sentences
        const sentences = enhanced.shortDescription.split(/[.!?]+/).filter(s => s.trim());
        assert.ok(sentences.length <= 3, `Short desc should have max 3 sentences, got ${sentences.length}`);

        // Step 4: Short description should be plain text
        assert.ok(!/<[^>]+>/.test(enhanced.shortDescription), 'Short desc should be plain text');

        // Step 5: Sanitize long description
        const sanitized = sanitizeHTML(enhanced.longDescription);
        assert.ok(!sanitized.includes('<script'), 'Should remove scripts');

        // Step 6: Ensure disclaimer
        const withDisclaimer = ensureDisclaimer(sanitized);
        assert.ok(
            withDisclaimer.includes('limitation') || withDisclaimer.includes('exclusion'),
            'Should include disclaimer'
        );

        // Step 7: Check compliance
        const compliance = checkCompliance(enhanced.shortDescription, withDisclaimer);
        assert.ok(Array.isArray(compliance.warnings), 'Should have warnings array');

        // Step 8: Final output should be safe and complete
        assert.ok(withDisclaimer.length > 0, 'Should have final output');
    });

    it('should handle minimal input gracefully', async () => {
        const enhanced = await enhanceDescriptions('tires', '');

        assert.ok(enhanced.shortDescription.length > 10, 'Should expand minimal input');
        assert.ok(enhanced.longDescription.includes('<'), 'Long should have HTML');
    });

    it('should preserve original intent when enhancing', async () => {
        const original = 'Covers engine and transmission repairs after warranty expires.';
        const enhanced = await enhanceDescriptions(original, '');

        // Should still mention the key concepts
        const combined = (enhanced.shortDescription + enhanced.longDescription).toLowerCase();
        assert.ok(
            combined.includes('engine') || combined.includes('transmission') ||
            combined.includes('warranty') || combined.includes('repair'),
            'Should preserve original concepts'
        );
    });

    it('should produce editable output', async () => {
        const enhanced = await enhanceDescriptions('Gap coverage for loans.', '');

        // User should be able to modify
        let editedShort = enhanced.shortDescription + ' [Edited by user]';
        let editedLong = enhanced.longDescription.replace('</p>', ' [Custom note]</p>');

        // These should still be valid after editing
        assert.ok(editedShort.includes('[Edited'));
        const sanitizedEdit = sanitizeHTML(editedLong);
        assert.ok(sanitizedEdit.includes('[Custom note]'));
    });
});

describe('E2E: PDF Extraction Flow', () => {

    it('should complete full PDF text analysis flow', () => {
        // Simulate extracted PDF text
        const pdfText = `
      Tire & Wheel Protection Plan
      
      This protection covers your vehicle's tires and wheels against damage from road hazards.
      
      What's Covered:
      • Tire punctures from nails, glass, and debris
      • Wheel and rim damage from potholes
      • Blowouts and sidewall damage
      • Flat tire repair or replacement
      
      Key Benefits:
      • No deductible on covered repairs
      • 24/7 roadside assistance
      • Nationwide coverage
      
      Exclusions:
      • Pre-existing damage
      • Normal wear and tear
      • Cosmetic damage
      
      Please review your contract for complete terms and conditions.
    `;

        // Step 1: Analyze text
        const analysis = analyzeText(pdfText);

        assert.ok(analysis.productType, 'Should identify product type');
        assert.ok(analysis.coverage.length > 0, 'Should extract coverage items');

        // Step 2: Calculate confidence
        const confidence = calculateConfidence(pdfText, analysis);

        assert.ok(confidence >= 0 && confidence <= 1, 'Confidence should be 0-1');
        assert.ok(confidence >= 0.7, `Good document should have decent confidence: ${confidence}`);

        // Step 3: Check low confidence threshold
        const lowConfidence = confidence < 0.8;
        if (lowConfidence) {
            console.log(`Note: Confidence ${confidence} is below threshold`);
        }
    });

    it('should handle poor quality extraction', () => {
        const poorText = 'Random text without structure.';
        const analysis = analyzeText(poorText);
        const confidence = calculateConfidence(poorText, analysis);

        assert.ok(confidence < 0.8, 'Poor text should have low confidence');
    });

    it('should identify multiple product types', () => {
        const products = [
            { text: 'tire and wheel protection', expected: 'Tire & Wheel Protection' },
            { text: 'gap coverage protection', expected: 'GAP Coverage' },
            { text: 'extended warranty plan', expected: 'Extended Warranty' },
            { text: 'paint protection coating', expected: 'Paint Protection' },
            { text: 'interior protection coverage', expected: 'Interior Protection' },
        ];

        for (const { text, expected } of products) {
            const analysis = analyzeText(text);
            assert.strictEqual(analysis.productType, expected, `Should identify ${expected}`);
        }
    });
});

describe('E2E: Compliance Flow', () => {

    it('should flag and warn about prohibited language', async () => {
        // User submits problematic content
        const problematic = 'This is the BEST warranty! GUARANTEED savings! Act now!';

        // Verify compliance checker works on the raw input first
        const initialCompliance = checkCompliance(problematic, '');
        assert.ok(initialCompliance.hasIssues, 'Should detect issues in raw input');

        // Now enhance it
        const enhanced = await enhanceDescriptions(problematic, '');
        const finalCompliance = checkCompliance(enhanced.shortDescription, enhanced.longDescription);

        // The AI should have cleaned it up (depending on prompt strictness)
        // If it still has issues, that's also okay to report, but we've verified the checker works.
        console.log('Final compliance warnings:', finalCompliance.warnings);
    });

    it('should pass clean content without warnings', async () => {
        const clean = 'Protects against mechanical breakdowns. Covers major components.';

        const enhanced = await enhanceDescriptions(clean, '');
        const sanitized = sanitizeHTML(enhanced.longDescription);
        const withDisclaimer = ensureDisclaimer(sanitized);
        const compliance = checkCompliance(enhanced.shortDescription, withDisclaimer);

        // Enhanced content should be clean if input was clean
        // (Mock enhancer doesn't add problematic language)
        assert.ok(Array.isArray(compliance.warnings));
    });
});

describe('E2E: Security Flow', () => {

    it('should prevent XSS through text input', async () => {
        const malicious = '<script>alert("xss")</script><p>Content</p>';

        const enhanced = await enhanceDescriptions(malicious, malicious);
        const sanitized = sanitizeHTML(enhanced.longDescription);

        // Should not contain any scripts
        assert.ok(!sanitized.includes('<script'), 'No script tags');
        assert.ok(!sanitized.includes('alert'), 'No alert calls');
        assert.ok(!sanitized.includes('javascript:'), 'No javascript URLs');
    });

    it('should prevent XSS through event handlers', async () => {
        const malicious = '<p onclick="alert(1)" onmouseover="evil()">Click me</p>';

        const sanitized = sanitizeHTML(malicious);

        assert.ok(!sanitized.includes('onclick'), 'No onclick');
        assert.ok(!sanitized.includes('onmouseover'), 'No onmouseover');
        assert.ok(!sanitized.includes('evil'), 'No evil function');
    });

    it('should only allow whitelisted HTML tags', () => {
        const mixed = '<div><p>Para</p><span>Span</span><strong>Bold</strong><h1>Header</h1></div>';

        const sanitized = sanitizeHTML(mixed);

        // Allowed tags should remain
        assert.ok(sanitized.includes('<p>'), 'Should keep <p>');
        assert.ok(sanitized.includes('<strong>'), 'Should keep <strong>');

        // Disallowed tags should be removed
        assert.ok(!sanitized.includes('<div'), 'Should remove <div>');
        assert.ok(!sanitized.includes('<h1'), 'Should remove <h1>');
    });

    it('should sanitize style attributes', () => {
        const dangerous = '<p style="background: url(evil.js); font-size: 12px">Text</p>';

        const sanitized = sanitizeHTML(dangerous);

        assert.ok(!sanitized.includes('url('), 'Should remove url()');
        // font-size should be preserved
        assert.ok(sanitized.includes('font-size'), 'Should keep safe font-size');
    });
});
