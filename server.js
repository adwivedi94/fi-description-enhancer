const express = require('express');
const path = require('path');
const multer = require('multer');

// Import services
const { enhanceDescriptions } = require('./services/enhancer');
const { extractFromPDF } = require('./services/pdf-extractor');
const { sanitizeHTML } = require('./services/sanitizer');
const { checkCompliance, ensureDisclaimer } = require('./services/compliance');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for PDF uploads (10MB limit)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Enhancement endpoint
app.post('/api/enhance', async (req, res) => {
  const startTime = Date.now();
  try {
    const { shortDescription, longDescription } = req.body;

    // Validate input - at least one description must be provided
    if (!shortDescription && !longDescription) {
      return res.status(400).json({
        error: 'At least one description (short or long) must be provided',
        code: 'EMPTY_INPUT'
      });
    }

    console.log(`[ENHANCE] Starting enhancement...`);

    // Enhance descriptions using AI
    const enhanced = await enhanceDescriptions(shortDescription, longDescription);
    console.log(`[ENHANCE] AI call completed in ${Date.now() - startTime}ms`);

    // Sanitize the long description HTML
    const sanitizedLong = sanitizeHTML(enhanced.longDescription);

    // Ensure disclaimer is present in long description
    const longWithDisclaimer = ensureDisclaimer(sanitizedLong);

    // Check for compliance issues (check both input and output to be thorough)
    const inputCompliance = checkCompliance(shortDescription, longDescription);
    const outputCompliance = checkCompliance(enhanced.shortDescription, longWithDisclaimer);

    // Merge results
    const complianceResult = {
      hasIssues: inputCompliance.hasIssues || outputCompliance.hasIssues,
      warnings: [...new Set([...inputCompliance.warnings, ...outputCompliance.warnings])]
    };

    console.log(`[ENHANCE] Total request time: ${Date.now() - startTime}ms`);

    res.json({
      shortDescription: enhanced.shortDescription,
      longDescription: longWithDisclaimer,
      complianceWarnings: complianceResult.warnings,
      hasComplianceIssues: complianceResult.hasIssues
    });
  } catch (error) {
    console.error('Enhancement error:', error);
    res.status(500).json({
      error: 'Enhancement service temporarily unavailable. Please try again.',
      code: 'SERVICE_ERROR'
    });
  }
});

// PDF extraction endpoint
app.post('/api/extract-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No PDF file uploaded',
        code: 'NO_FILE'
      });
    }

    // Extract and generate descriptions from PDF
    const extracted = await extractFromPDF(req.file.buffer);

    // Handle extraction failure
    if (!extracted.success) {
      return res.status(400).json({
        error: extracted.error || 'No text could be extracted from this PDF.',
        code: 'EXTRACTION_FAILED'
      });
    }

    // Sanitize the long description HTML
    const sanitizedLong = sanitizeHTML(extracted.longDescription);

    // Ensure disclaimer is present
    const longWithDisclaimer = ensureDisclaimer(sanitizedLong);

    // Check for compliance issues
    const complianceResult = checkCompliance(extracted.shortDescription, longWithDisclaimer);

    res.json({
      shortDescription: extracted.shortDescription,
      longDescription: longWithDisclaimer,
      confidence: extracted.confidence,
      lowConfidence: extracted.confidence < 0.8,
      complianceWarnings: complianceResult.warnings,
      hasComplianceIssues: complianceResult.hasIssues,
      extractedSections: extracted.sections
    });
  } catch (error) {
    console.error('PDF extraction error:', error);

    if (error.message === 'Only PDF files are allowed') {
      return res.status(400).json({
        error: 'Only PDF files are allowed',
        code: 'INVALID_FILE_TYPE'
      });
    }

    res.status(500).json({
      error: 'Failed to process PDF. Please try a different file.',
      code: 'PROCESSING_ERROR'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum size is 10MB.',
        code: 'FILE_TOO_LARGE'
      });
    }
  }

  res.status(500).json({
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`F&I Description Enhancement server running at http://localhost:${PORT}`);
});

module.exports = app;
