/**
 * Unit Tests - Confidence Scoring
 * Tests for PDF extraction confidence calculation
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { calculateConfidence, analyzeText } = require('../services/pdf-extractor');

describe('calculateConfidence', () => {

    describe('Text Length Factor', () => {
        it('should give higher confidence for longer text', () => {
            const shortText = 'Short text about coverage.';
            const longText = 'A '.repeat(600) + 'This is a comprehensive document about tire and wheel protection coverage that includes many details about what is covered and what is not.';

            const shortAnalysis = analyzeText(shortText);
            const longAnalysis = analyzeText(longText);

            const shortConfidence = calculateConfidence(shortText, shortAnalysis);
            const longConfidence = calculateConfidence(longText, longAnalysis);

            assert.ok(longConfidence > shortConfidence,
                `Long text confidence (${longConfidence}) should be > short (${shortConfidence})`);
        });

        it('should penalize very short text', () => {
            const veryShort = 'Coverage.';
            const analysis = analyzeText(veryShort);
            const confidence = calculateConfidence(veryShort, analysis);
            assert.ok(confidence < 0.6, `Very short text should have low confidence: ${confidence}`);
        });
    });

    describe('Product Identification', () => {
        it('should increase confidence when product name is found', () => {
            const textWithName = 'Tire & Wheel Protection Plan covers damage from road hazards.';
            const textWithoutName = 'This covers damage from road hazards.';

            const analysisWithName = analyzeText(textWithName);
            const analysisWithoutName = analyzeText(textWithoutName);

            analysisWithName.productName = 'Tire & Wheel Protection Plan';

            const confWithName = calculateConfidence(textWithName, analysisWithName);
            const confWithoutName = calculateConfidence(textWithoutName, analysisWithoutName);

            assert.ok(confWithName > confWithoutName);
        });

        it('should increase confidence when product type is identified', () => {
            const analysis = { coverage: [], benefits: [], limitations: [], disclaimers: [] };
            const analysisWithType = { ...analysis, productType: 'GAP Coverage' };

            const text = 'Some coverage text here.';
            const conf1 = calculateConfidence(text, analysis);
            const conf2 = calculateConfidence(text, analysisWithType);

            assert.ok(conf2 > conf1);
        });
    });

    describe('Section Extraction', () => {
        it('should increase confidence when coverage items are found', () => {
            const analysis1 = { coverage: [], benefits: [], limitations: [], disclaimers: [] };
            const analysis2 = {
                coverage: ['Tire punctures', 'Wheel damage', 'Blowouts'],
                benefits: [],
                limitations: [],
                disclaimers: []
            };

            const text = 'Sample text for testing.';
            const conf1 = calculateConfidence(text, analysis1);
            const conf2 = calculateConfidence(text, analysis2);

            assert.ok(conf2 > conf1, 'Coverage items should increase confidence');
        });

        it('should increase confidence when benefits are found', () => {
            const analysis1 = { coverage: [], benefits: [], limitations: [], disclaimers: [] };
            const analysis2 = { coverage: [], benefits: ['Peace of mind'], limitations: [], disclaimers: [] };

            const text = 'Sample text.';
            const conf1 = calculateConfidence(text, analysis1);
            const conf2 = calculateConfidence(text, analysis2);

            assert.ok(conf2 > conf1);
        });

        it('should increase confidence when limitations are found', () => {
            const analysis1 = { coverage: [], benefits: [], limitations: [], disclaimers: [] };
            const analysis2 = {
                coverage: [], benefits: [],
                limitations: ['Pre-existing conditions not covered'],
                disclaimers: []
            };

            const text = 'Sample text.';
            const conf1 = calculateConfidence(text, analysis1);
            const conf2 = calculateConfidence(text, analysis2);

            assert.ok(conf2 > conf1);
        });

        it('should increase confidence when disclaimers are found', () => {
            const analysis1 = { coverage: [], benefits: [], limitations: [], disclaimers: [] };
            const analysis2 = {
                coverage: [], benefits: [], limitations: [],
                disclaimers: ['See contract for full details']
            };

            const text = 'Sample text.';
            const conf1 = calculateConfidence(text, analysis1);
            const conf2 = calculateConfidence(text, analysis2);

            assert.ok(conf2 > conf1);
        });
    });

    describe('Text Quality', () => {
        it('should penalize garbled/OCR error text', () => {
            const cleanText = 'This is a clean, well-formatted document about vehicle protection.';
            const garbageText = 'Th!$ !$ @ g@rbl3d t3xt w!th m@ny $p3c!@l ch@r@ct3rs @nd OCR 3rr0r$';

            const cleanAnalysis = analyzeText(cleanText);
            const garbageAnalysis = analyzeText(garbageText);

            const cleanConf = calculateConfidence(cleanText, cleanAnalysis);
            const garbageConf = calculateConfidence(garbageText, garbageAnalysis);

            assert.ok(cleanConf > garbageConf,
                `Clean text (${cleanConf}) should score higher than garbage (${garbageConf})`);
        });
    });

    describe('Confidence Bounds', () => {
        it('should never return confidence > 1', () => {
            const perfectAnalysis = {
                productName: 'Test Protection Plan',
                productType: 'Extended Warranty',
                coverage: ['A', 'B', 'C', 'D', 'E'],
                benefits: ['X', 'Y'],
                limitations: ['Z'],
                disclaimers: ['See contract']
            };

            const longText = 'A '.repeat(3000);
            const conf = calculateConfidence(longText, perfectAnalysis);
            assert.ok(conf <= 1, `Confidence should not exceed 1: ${conf}`);
        });

        it('should never return confidence < 0', () => {
            const emptyAnalysis = {
                coverage: [],
                benefits: [],
                limitations: [],
                disclaimers: []
            };

            const terribleText = '@#$%^&*()!@#$%';
            const conf = calculateConfidence(terribleText, emptyAnalysis);
            assert.ok(conf >= 0, `Confidence should not be negative: ${conf}`);
        });
    });

    describe('Threshold Behavior', () => {
        it('should be below 0.8 for poor quality extraction', () => {
            const poorText = 'Random short text.';
            const poorAnalysis = { coverage: [], benefits: [], limitations: [], disclaimers: [] };
            const conf = calculateConfidence(poorText, poorAnalysis);
            assert.ok(conf < 0.8, `Poor extraction should have low confidence: ${conf}`);
        });

        it('should be at or above 0.8 for good quality extraction', () => {
            const goodText = `
        Tire & Wheel Protection Plan
        
        This comprehensive coverage protects against road hazards.
        
        Coverage includes:
        - Tire punctures from nails and debris
        - Wheel damage from potholes
        - Blowouts and sidewall damage
        
        Benefits:
        - 24/7 roadside assistance
        - No deductible on covered repairs
        
        Limitations and exclusions apply. See contract for details.
      `.repeat(3);

            const goodAnalysis = analyzeText(goodText);
            goodAnalysis.productName = 'Tire & Wheel Protection Plan';
            goodAnalysis.productType = 'Tire & Wheel Protection';
            goodAnalysis.coverage = ['Tire punctures', 'Wheel damage', 'Blowouts'];
            goodAnalysis.benefits = ['24/7 roadside assistance', 'No deductible'];
            goodAnalysis.disclaimers = ['See contract for details'];

            const conf = calculateConfidence(goodText, goodAnalysis);
            assert.ok(conf >= 0.8, `Good extraction should have high confidence: ${conf}`);
        });
    });
});

describe('analyzeText', () => {
    it('should identify product types from keywords', () => {
        const tireText = 'This tire and wheel protection covers road hazards.';
        const result = analyzeText(tireText);
        assert.strictEqual(result.productType, 'Tire & Wheel Protection');
    });

    it('should identify GAP coverage', () => {
        const gapText = 'GAP coverage protects you when your car is totaled.';
        const result = analyzeText(gapText);
        assert.strictEqual(result.productType, 'GAP Coverage');
    });

    it('should extract bullet-point items as coverage', () => {
        const text = '• Tire punctures\n• Wheel damage\n• Blowouts';
        const result = analyzeText(text);
        assert.ok(result.coverage.length >= 2);
    });

    it('should limit coverage items to 10', () => {
        const text = Array(20).fill('• Coverage item number').map((s, i) => `${s} ${i + 1}`).join('\n');
        const result = analyzeText(text);
        assert.ok(result.coverage.length <= 10);
    });
});
