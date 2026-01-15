# F&I Product Description Enhancement

AI-Powered F&I Product Description Enhancement for dealer portals. This feature automatically generates and enhances F&I product descriptions from text input or PDF uploads.

## Features

- **Text Enhancement Mode**: Enhance existing product descriptions with AI
- **PDF Extraction Mode**: Generate descriptions from uploaded product PDFs
- **Compliance Validation**: Automatic detection of prohibited language
- **HTML Sanitization**: XSS prevention with whitelist-based sanitization
- **Confidence Scoring**: Flag low-confidence PDF extractions for review

## 🚀 Deployment (Demo Link)

The best way to share this demo is by deploying the full application to **Render** or **Railway**.

### Deploy to Render

1.  **Connect GitHub**: Log in to [Render.com](https://render.com) and connect your GitHub account.
2.  **Create Web Service**: Click **New +** > **Web Service** and select this repository.
3.  **Basic Settings**:
    - **Runtime**: `Node`
    - **Build Command**: `npm install`
    - **Start Command**: `npm start`
4.  **Environment Variables**:
    - Click **Advanced** > **Add Environment Variable**.
    - Add `OPENAI_API_KEY`: `(Your OpenAI API Key)`.
5.  **Deploy**: Click **Deploy Web Service**.

Render will provide a public URL (e.g., `https://fi-description-enhancer.onrender.com`) that you can share. All features (including PDF Upload) will work on this link.

---

## 🔒 Security & Cloudflare Proxy

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm run dev

# Open in browser
open http://localhost:3000
```

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run E2E tests only
npm run test:e2e

# Run integration tests (requires server on port 3001)
PORT=3001 node server.js &
npm run test:integration
```

## Project Structure

```
├── server.js                 # Express server with API endpoints
├── public/
│   ├── index.html           # Main UI
│   ├── css/styles.css       # Design system
│   └── js/app.js            # Frontend application
├── services/
│   ├── sanitizer.js         # HTML sanitization (XSS prevention)
│   ├── compliance.js        # Prohibited keyword detection
│   ├── enhancer.js          # AI text enhancement (mock)
│   └── pdf-extractor.js     # PDF parsing and analysis
└── tests/
    ├── sanitizer.test.js    # Sanitizer unit tests
    ├── compliance.test.js   # Compliance unit tests
    ├── confidence.test.js   # Confidence scoring tests
    ├── api.test.js          # API integration tests
    └── e2e.test.js          # End-to-end flow tests
```

## API Endpoints

### POST /api/enhance

Enhance existing product descriptions.

**Request:**
```json
{
  "shortDescription": "Covers tire damage. Good for off road.",
  "longDescription": ""
}
```

**Response:**
```json
{
  "shortDescription": "Protects your investment from unexpected tire and wheel damage...",
  "longDescription": "<p>Tire and wheel damage from road hazards...</p>",
  "complianceWarnings": [],
  "hasComplianceIssues": false
}
```

### POST /api/extract-pdf

Extract and generate descriptions from a PDF file.

**Request:** `multipart/form-data` with `pdf` file

**Response:**
```json
{
  "shortDescription": "...",
  "longDescription": "...",
  "confidence": 0.85,
  "lowConfidence": false,
  "complianceWarnings": [],
  "extractedSections": {
    "coverage": [...],
    "benefits": [...],
    "limitations": [...],
    "disclaimers": [...]
  }
}
```

## Key Design Decisions

### 1. Mock AI Implementation
The AI enhancement uses intelligent template-based responses rather than a real LLM. This allows:
- Fully functional demo without API keys
- Predictable, testable behavior
- Easy swap to real LLM later (just change `services/enhancer.js`)

### 2. HTML Whitelist Sanitization
Only these tags are allowed in long descriptions:
- `<p>`, `<strong>`, `<em>`, `<ul>`, `<li>`, `<br>`
- `style` attribute (only `font-size` and `font-style` properties)

All other HTML is stripped to prevent XSS attacks.

### 3. Compliance Keyword Detection
Prohibited keywords per PRD Section 6.3:
- `guarantee`, `never`, `always`
- `required by law`, `mandatory`
- `best`, `ultimate`
- `act now`, `limited time`

### 4. Automatic Disclaimers
Long descriptions automatically include a disclaimer per PRD Section 6.2:
> "This coverage has limitations and exclusions. Please review the full contract terms for complete details on covered components, service requirements, and exclusions."

### 5. Confidence Thresholds
PDF extraction confidence is calculated based on:
- Text length and quality
- Product name/type identification
- Number of extracted sections (coverage, benefits, etc.)
- OCR quality indicators

Threshold: `< 80%` triggers a warning banner.

## Compliance with PRD

| PRD Section | Implementation |
|-------------|----------------|
| 3.1 Enhancement Mode | `POST /api/enhance` endpoint |
| 3.2 PDF Extraction | `POST /api/extract-pdf` endpoint |
| 5.2 Short Description | Max 3 sentences, plain text only |
| 5.3 Long Description | HTML formatted with sections |
| 6.1 Prohibited Content | Keyword detection in `compliance.js` |
| 6.2 Required Disclaimers | Auto-appended in `ensureDisclaimer()` |
| 6.3 Compliance Validation | Automated checks + warnings |
| 8.4 Output Format | HTML sanitization with whitelist |

## Swapping to Real LLM

To use a real AI provider, modify `services/enhancer.js`:

```javascript
// Example: OpenAI integration
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function enhanceDescriptions(short, long) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are an F&I description writer...' },
      { role: 'user', content: `Enhance: ${short} ${long}` }
    ]
  });
  // Parse and return response
}
```

## License

ISC
