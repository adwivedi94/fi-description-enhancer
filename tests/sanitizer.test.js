/**
 * Unit Tests - HTML Sanitizer
 * Tests for XSS prevention and HTML whitelist enforcement
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { sanitizeHTML, validateHTML, ALLOWED_TAGS } = require('../services/sanitizer');

describe('sanitizeHTML', () => {

    describe('Allowed Tags', () => {
        it('should allow <p> tags', () => {
            const input = '<p>This is a paragraph.</p>';
            const result = sanitizeHTML(input);
            assert.strictEqual(result, '<p>This is a paragraph.</p>');
        });

        it('should allow <strong> tags', () => {
            const input = '<strong>Bold text</strong>';
            const result = sanitizeHTML(input);
            assert.strictEqual(result, '<strong>Bold text</strong>');
        });

        it('should allow <em> tags', () => {
            const input = '<em>Italic text</em>';
            const result = sanitizeHTML(input);
            assert.strictEqual(result, '<em>Italic text</em>');
        });

        it('should allow <ul> and <li> tags', () => {
            const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
            const result = sanitizeHTML(input);
            assert.strictEqual(result, '<ul><li>Item 1</li><li>Item 2</li></ul>');
        });

        it('should allow <br> tags', () => {
            const input = 'Line 1<br>Line 2';
            const result = sanitizeHTML(input);
            assert.strictEqual(result, 'Line 1<br>Line 2');
        });

        it('should allow style attribute with font-size', () => {
            const input = '<p style="font-size: smaller">Disclaimer text</p>';
            const result = sanitizeHTML(input);
            assert.ok(result.includes('font-size: smaller'));
        });
    });

    describe('Disallowed Tags', () => {
        it('should remove <script> tags', () => {
            const input = '<p>Safe</p><script>alert("xss")</script>';
            const result = sanitizeHTML(input);
            assert.ok(!result.includes('<script'));
            assert.ok(!result.includes('alert'));
        });

        it('should remove <iframe> tags', () => {
            const input = '<iframe src="evil.com"></iframe><p>Content</p>';
            const result = sanitizeHTML(input);
            assert.ok(!result.includes('<iframe'));
        });

        it('should remove <div> tags', () => {
            const input = '<div>Content in div</div>';
            const result = sanitizeHTML(input);
            assert.ok(!result.includes('<div'));
            assert.ok(!result.includes('</div>'));
        });

        it('should remove <style> tags', () => {
            const input = '<style>body{color:red}</style><p>Text</p>';
            const result = sanitizeHTML(input);
            assert.ok(!result.includes('<style'));
        });

        it('should remove <link> tags', () => {
            const input = '<link rel="stylesheet" href="evil.css"><p>Text</p>';
            const result = sanitizeHTML(input);
            assert.ok(!result.includes('<link'));
        });
    });

    describe('XSS Prevention', () => {
        it('should remove javascript: URLs', () => {
            const input = '<a href="javascript:alert(1)">Click</a>';
            const result = sanitizeHTML(input);
            assert.ok(!result.includes('javascript:'));
        });

        it('should remove onclick handlers', () => {
            const input = '<p onclick="alert(1)">Click me</p>';
            const result = sanitizeHTML(input);
            assert.ok(!result.includes('onclick'));
        });

        it('should remove onerror handlers', () => {
            const input = '<img onerror="alert(1)" src="x">';
            const result = sanitizeHTML(input);
            assert.ok(!result.includes('onerror'));
        });

        it('should remove onmouseover handlers', () => {
            const input = '<p onmouseover="alert(1)">Hover</p>';
            const result = sanitizeHTML(input);
            assert.ok(!result.includes('onmouseover'));
        });

        it('should handle mixed case javascript:', () => {
            const input = '<a href="JaVaScRiPt:alert(1)">Bad</a>';
            const result = sanitizeHTML(input);
            assert.ok(!result.toLowerCase().includes('javascript:'));
        });

        it('should remove vbscript: URLs', () => {
            const input = '<a href="vbscript:msgbox(1)">Bad</a>';
            const result = sanitizeHTML(input);
            assert.ok(!result.includes('vbscript:'));
        });

        it('should remove data: URLs', () => {
            const input = '<a href="data:text/html,<script>alert(1)</script>">Bad</a>';
            const result = sanitizeHTML(input);
            assert.ok(!result.includes('data:'));
        });
    });

    describe('Style Sanitization', () => {
        it('should allow font-size in style', () => {
            const input = '<span style="font-size: 12px">Text</span>';
            const result = sanitizeHTML(input);
            assert.ok(result.includes('font-size: 12px'));
        });

        it('should allow font-style in style', () => {
            const input = '<span style="font-style: italic">Text</span>';
            const result = sanitizeHTML(input);
            assert.ok(result.includes('font-style: italic'));
        });

        it('should remove expression() in style', () => {
            const input = '<p style="width: expression(alert(1))">Bad</p>';
            const result = sanitizeHTML(input);
            assert.ok(!result.includes('expression'));
        });

        it('should remove url() in style', () => {
            const input = '<p style="background: url(evil.js)">Bad</p>';
            const result = sanitizeHTML(input);
            assert.ok(!result.includes('url('));
        });
    });

    describe('Edge Cases', () => {
        it('should handle null input', () => {
            const result = sanitizeHTML(null);
            assert.strictEqual(result, '');
        });

        it('should handle undefined input', () => {
            const result = sanitizeHTML(undefined);
            assert.strictEqual(result, '');
        });

        it('should handle empty string', () => {
            const result = sanitizeHTML('');
            assert.strictEqual(result, '');
        });

        it('should handle plain text', () => {
            const input = 'Just plain text with no HTML';
            const result = sanitizeHTML(input);
            assert.strictEqual(result, input);
        });

        it('should handle nested allowed tags', () => {
            const input = '<p><strong>Bold <em>and italic</em></strong></p>';
            const result = sanitizeHTML(input);
            assert.ok(result.includes('<p>'));
            assert.ok(result.includes('<strong>'));
            assert.ok(result.includes('<em>'));
        });
    });
});

describe('validateHTML', () => {
    it('should validate clean HTML as valid', () => {
        const result = validateHTML('<p>Clean text</p>');
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.issues.length, 0);
    });

    it('should detect disallowed tags', () => {
        const result = validateHTML('<div>Not allowed</div>');
        assert.strictEqual(result.valid, false);
        assert.ok(result.issues.some(i => i.includes('div')));
    });

    it('should detect script tags', () => {
        const result = validateHTML('<script>alert(1)</script>');
        assert.strictEqual(result.valid, false);
        assert.ok(result.issues.some(i => i.includes('script')));
    });

    it('should detect event handlers', () => {
        const result = validateHTML('<p onclick="bad()">Text</p>');
        assert.strictEqual(result.valid, false);
        assert.ok(result.issues.some(i => i.includes('event handler')));
    });
});
