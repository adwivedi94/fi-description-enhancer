/**
 * Unit Tests - Compliance Service
 * Tests for keyword detection, disclaimer verification, and compliance warnings
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
    checkCompliance,
    hasDisclaimer,
    ensureDisclaimer,
    validateForPublishing,
    STANDARD_DISCLAIMER
} = require('../services/compliance');

describe('checkCompliance', () => {

    describe('Prohibited Keywords', () => {
        it('should detect "guarantee"', () => {
            const result = checkCompliance('This product is guaranteed to work', '');
            assert.strictEqual(result.hasIssues, true);
            assert.ok(result.warnings.some(w => w.includes('guarantee')));
        });

        it('should detect "guaranteed"', () => {
            const result = checkCompliance('Guaranteed savings!', '');
            assert.strictEqual(result.hasIssues, true);
            assert.ok(result.warnings.some(w => w.includes('guarantee')));
        });

        it('should detect "never"', () => {
            const result = checkCompliance('Your car will never break down', '');
            assert.strictEqual(result.hasIssues, true);
            assert.ok(result.warnings.some(w => w.includes('never')));
        });

        it('should detect "always"', () => {
            const result = checkCompliance('We always pay your claims', '');
            assert.strictEqual(result.hasIssues, true);
            assert.ok(result.warnings.some(w => w.includes('always')));
        });

        it('should detect "required by law"', () => {
            const result = checkCompliance('This coverage is required by law', '');
            assert.strictEqual(result.hasIssues, true);
            assert.ok(result.warnings.some(w => w.includes('required by law')));
        });

        it('should detect "mandatory"', () => {
            const result = checkCompliance('This is mandatory coverage', '');
            assert.strictEqual(result.hasIssues, true);
            assert.ok(result.warnings.some(w => w.includes('mandatory')));
        });

        it('should detect "best"', () => {
            const result = checkCompliance('The best warranty available', '');
            assert.strictEqual(result.hasIssues, true);
            assert.ok(result.warnings.some(w => w.includes('best')));
        });

        it('should detect "ultimate"', () => {
            const result = checkCompliance('The ultimate protection plan', '');
            assert.strictEqual(result.hasIssues, true);
            assert.ok(result.warnings.some(w => w.includes('ultimate')));
        });

        it('should detect "act now"', () => {
            const result = checkCompliance('Act now before it is too late!', '');
            assert.strictEqual(result.hasIssues, true);
            assert.ok(result.warnings.some(w => w.includes('act now')));
        });

        it('should detect "limited time"', () => {
            const result = checkCompliance('Limited time offer!', '');
            assert.strictEqual(result.hasIssues, true);
            assert.ok(result.warnings.some(w => w.includes('limited time')));
        });
    });

    describe('Manipulative Language', () => {
        it('should detect multiple exclamation points', () => {
            const result = checkCompliance('Amazing deal!!!', '');
            assert.strictEqual(result.hasIssues, true);
            assert.ok(result.warnings.some(w => w.includes('exclamation')));
        });

        it('should detect fear-based language "bankrupt"', () => {
            const result = checkCompliance('', 'Don\'t go bankrupt from repairs');
            assert.strictEqual(result.hasIssues, true);
            assert.ok(result.warnings.some(w => w.includes('Fear-based')));
        });

        it('should detect fear-based language "devastating"', () => {
            const result = checkCompliance('Avoid devastating repair bills', '');
            assert.strictEqual(result.hasIssues, true);
        });
    });

    describe('Clean Content', () => {
        it('should pass clean short description', () => {
            const result = checkCompliance(
                'Protects against mechanical breakdowns after your warranty expires.',
                ''
            );
            assert.strictEqual(result.hasIssues, false);
            assert.strictEqual(result.warnings.length, 0);
        });

        it('should pass clean long description', () => {
            const result = checkCompliance(
                '',
                '<p>This coverage helps protect your budget from unexpected repair costs.</p>'
            );
            assert.strictEqual(result.hasIssues, false);
        });

        it('should handle keywords in HTML tags correctly', () => {
            const result = checkCompliance('', '<strong>Key Benefits:</strong>');
            assert.strictEqual(result.hasIssues, false);
        });
    });

    describe('Case Insensitivity', () => {
        it('should detect GUARANTEE in uppercase', () => {
            const result = checkCompliance('GUARANTEE your savings!', '');
            assert.strictEqual(result.hasIssues, true);
        });

        it('should detect Mandatory with mixed case', () => {
            const result = checkCompliance('Mandatory coverage required', '');
            assert.strictEqual(result.hasIssues, true);
        });
    });
});

describe('hasDisclaimer', () => {
    it('should detect "limitations and exclusions"', () => {
        const text = '<p>This has limitations and exclusions.</p>';
        assert.strictEqual(hasDisclaimer(text), true);
    });

    it('should detect "please review contract"', () => {
        const text = 'Please review the full contract terms.';
        assert.strictEqual(hasDisclaimer(text), true);
    });

    it('should detect "see contract for details"', () => {
        const text = 'See contract for full details.';
        assert.strictEqual(hasDisclaimer(text), true);
    });

    it('should detect "terms and conditions apply"', () => {
        const text = 'Terms and conditions apply.';
        assert.strictEqual(hasDisclaimer(text), true);
    });

    it('should detect "exclusions apply"', () => {
        const text = 'Some exclusions apply to this coverage.';
        assert.strictEqual(hasDisclaimer(text), true);
    });

    it('should return false for text without disclaimer', () => {
        const text = 'This is great coverage with many benefits.';
        assert.strictEqual(hasDisclaimer(text), false);
    });

    it('should handle null input', () => {
        assert.strictEqual(hasDisclaimer(null), false);
    });

    it('should handle empty string', () => {
        assert.strictEqual(hasDisclaimer(''), false);
    });
});

describe('ensureDisclaimer', () => {
    it('should add disclaimer to text without one', () => {
        const input = '<p>Great coverage for your vehicle.</p>';
        const result = ensureDisclaimer(input);
        assert.ok(result.includes(STANDARD_DISCLAIMER));
        assert.ok(result.includes(input));
    });

    it('should not duplicate existing disclaimer', () => {
        const input = '<p>Coverage info.</p><p><em>This coverage has limitations and exclusions.</em></p>';
        const result = ensureDisclaimer(input);
        // Count occurrences of "limitations"
        const count = (result.match(/limitations/gi) || []).length;
        assert.strictEqual(count, 1);
    });

    it('should format disclaimer with smaller font', () => {
        const input = '<p>Coverage details.</p>';
        const result = ensureDisclaimer(input);
        assert.ok(result.includes('font-size: smaller'));
        assert.ok(result.includes('<em'));
    });

    it('should handle empty input', () => {
        const result = ensureDisclaimer('');
        assert.ok(result.includes(STANDARD_DISCLAIMER));
    });

    it('should handle null input', () => {
        const result = ensureDisclaimer(null);
        assert.ok(result.includes(STANDARD_DISCLAIMER));
    });
});

describe('validateForPublishing', () => {
    it('should warn if short description exceeds 3 sentences', () => {
        const shortDesc = 'Sentence one. Sentence two. Sentence three. Sentence four.';
        const result = validateForPublishing(shortDesc, '');
        assert.ok(result.warnings.some(w => w.includes('3 sentences')));
    });

    it('should error if short description contains HTML', () => {
        const shortDesc = '<strong>Bold</strong> text';
        const result = validateForPublishing(shortDesc, '');
        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.some(e => e.includes('plain text')));
    });

    it('should warn if long description missing disclaimer', () => {
        const longDesc = '<p>Just some coverage info without disclaimer.</p>';
        const result = validateForPublishing('', longDesc);
        assert.ok(result.warnings.some(w => w.includes('disclaimer')));
    });

    it('should pass valid content', () => {
        const shortDesc = 'Good coverage. Protects your car. Ideal for you.';
        const longDesc = '<p>Details here.</p><p><em>This coverage has limitations and exclusions.</em></p>';
        const result = validateForPublishing(shortDesc, longDesc);
        assert.strictEqual(result.valid, true);
    });
});
