/**
 * Integration Tests - API Endpoints
 * Tests for /api/enhance and /api/extract-pdf endpoints
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Test server URL
const BASE_URL = 'http://localhost:3001';

// Helper to make HTTP requests
function makeRequest(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data ? JSON.parse(data) : null
                    });
                } catch (e) {
                    resolve({ status: res.statusCode, headers: res.headers, body: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(body);
        }
        req.end();
    });
}

function jsonRequest(path, method, data) {
    const body = JSON.stringify(data);
    const url = new URL(path, BASE_URL);

    return makeRequest({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        }
    }, body);
}

describe('API Endpoints', () => {

    describe('GET /api/health', () => {
        it('should return health status', async () => {
            const url = new URL('/api/health', BASE_URL);
            const response = await makeRequest({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'GET'
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.status, 'ok');
            assert.ok(response.body.timestamp);
        });
    });

    describe('POST /api/enhance', () => {
        it('should enhance a short description', async () => {
            const response = await jsonRequest('/api/enhance', 'POST', {
                shortDescription: 'Covers tire damage. Good for off road.',
                longDescription: null
            });

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.shortDescription);
            assert.ok(response.body.longDescription);
            assert.ok(Array.isArray(response.body.complianceWarnings));
            assert.strictEqual(typeof response.body.hasComplianceIssues, 'boolean');
        });

        it('should enhance a long description', async () => {
            const response = await jsonRequest('/api/enhance', 'POST', {
                shortDescription: null,
                longDescription: 'This warranty covers engine and transmission problems.'
            });

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.shortDescription);
            assert.ok(response.body.longDescription);
        });

        it('should enhance both descriptions', async () => {
            const response = await jsonRequest('/api/enhance', 'POST', {
                shortDescription: 'Basic tire coverage.',
                longDescription: 'Covers tire damage from road hazards.'
            });

            assert.strictEqual(response.status, 200);
            assert.ok(response.body.shortDescription);
            assert.ok(response.body.longDescription);
        });

        it('should return error for empty input', async () => {
            const response = await jsonRequest('/api/enhance', 'POST', {
                shortDescription: '',
                longDescription: ''
            });

            assert.strictEqual(response.status, 400);
            assert.strictEqual(response.body.code, 'EMPTY_INPUT');
        });

        it('should return error for null input', async () => {
            const response = await jsonRequest('/api/enhance', 'POST', {
                shortDescription: null,
                longDescription: null
            });

            assert.strictEqual(response.status, 400);
            assert.strictEqual(response.body.code, 'EMPTY_INPUT');
        });

        it('should include disclaimer in long description', async () => {
            const response = await jsonRequest('/api/enhance', 'POST', {
                shortDescription: 'Good coverage.',
                longDescription: null
            });

            assert.strictEqual(response.status, 200);
            // Check that disclaimer is present
            assert.ok(
                response.body.longDescription.includes('limitation') ||
                response.body.longDescription.includes('exclusion') ||
                response.body.longDescription.includes('contract'),
                'Long description should include disclaimer'
            );
        });

        it('should detect compliance issues', async () => {
            const response = await jsonRequest('/api/enhance', 'POST', {
                shortDescription: 'Guaranteed to save you money! Act now!',
                longDescription: null
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.hasComplianceIssues, true);
            assert.ok(response.body.complianceWarnings.length > 0);
        });

        it('should sanitize HTML output', async () => {
            const response = await jsonRequest('/api/enhance', 'POST', {
                shortDescription: null,
                longDescription: '<script>alert("xss")</script><p>Safe content</p>'
            });

            assert.strictEqual(response.status, 200);
            assert.ok(!response.body.longDescription.includes('<script'));
            assert.ok(!response.body.longDescription.includes('alert'));
        });
    });

    describe('POST /api/extract-pdf', () => {
        it('should return error when no file uploaded', async () => {
            const url = new URL('/api/extract-pdf', BASE_URL);

            const response = await makeRequest({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            }, '{}');

            assert.strictEqual(response.status, 400);
            assert.ok(response.body.error);
        });

        // Note: Full PDF upload tests would require multipart form data
        // which is complex to construct manually. These are covered in e2e tests.
    });
});

// Note: These tests require the server to be running on port 3001
// Run with: PORT=3001 node server.js & npm run test:integration
