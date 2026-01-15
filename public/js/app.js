/**
 * F&I Description Enhancement - Frontend Application
 * Updated for Cloudflare Worker proxy support
 */

// Configuration
const CONFIG = {
    // Paste your deployed Cloudflare Worker URL here to use it for AI enhancement
    // Example: 'https://fi-description-enhancement.your-subdomain.workers.dev'
    workerUrl: 'https://fi-description-enhancer.adwivedi9994.workers.dev'
};

// DOM Elements
const elements = {
    // Mode buttons
    modeText: document.getElementById('mode-text'),
    modePdf: document.getElementById('mode-pdf'),
    textMode: document.getElementById('text-mode'),
    pdfMode: document.getElementById('pdf-mode'),

    // Text inputs
    shortInput: document.getElementById('short-input'),
    longInput: document.getElementById('long-input'),
    shortCount: document.getElementById('short-count'),
    longCount: document.getElementById('long-count'),
    enhanceShortBtn: document.getElementById('enhance-short-btn'),
    enhanceLongBtn: document.getElementById('enhance-long-btn'),

    // PDF upload
    uploadZone: document.getElementById('upload-zone'),
    pdfInput: document.getElementById('pdf-input'),
    fileInfo: document.getElementById('file-info'),
    fileName: document.getElementById('file-name'),
    fileSize: document.getElementById('file-size'),
    removeFile: document.getElementById('remove-file'),
    extractBtn: document.getElementById('extract-btn'),

    // States
    loadingSection: document.getElementById('loading-section'),
    loadingText: document.getElementById('loading-text'),
    resultsSection: document.getElementById('results-section'),

    // Warnings (for PDF mode)
    warningsBanner: document.getElementById('warnings-banner'),
    confidenceWarning: document.getElementById('confidence-warning'),
    confidenceMessage: document.getElementById('confidence-message'),
    complianceWarning: document.getElementById('compliance-warning'),
    complianceList: document.getElementById('compliance-list'),

    // Inline Preview Sections (for text mode)
    shortPreviewSection: document.getElementById('short-preview-section'),
    longPreviewSection: document.getElementById('long-preview-section'),

    // Inline Previews (for text mode - unique IDs)
    inlineShortPreview: document.getElementById('inline-short-preview'),
    inlineLongPreview: document.getElementById('inline-long-preview'),
    inlineShortEditMode: document.getElementById('inline-short-edit-mode'),
    inlineLongEditMode: document.getElementById('inline-long-edit-mode'),
    inlineShortEdit: document.getElementById('inline-short-edit'),
    inlineLongEdit: document.getElementById('inline-long-edit'),
    inlineShortEditBtn: document.getElementById('inline-short-edit-btn'),
    inlineShortSaveBtn: document.getElementById('inline-short-save-btn'),
    inlineShortCancelBtn: document.getElementById('inline-short-cancel-btn'),
    inlineLongEditBtn: document.getElementById('inline-long-edit-btn'),
    inlineLongSaveBtn: document.getElementById('inline-long-save-btn'),
    inlineLongCancelBtn: document.getElementById('inline-long-cancel-btn'),
    inlineApplyShortBtn: document.getElementById('inline-apply-short-btn'),
    inlineApplyLongBtn: document.getElementById('inline-apply-long-btn'),

    // Results Section Previews (for PDF mode)
    shortPreview: document.getElementById('short-preview'),
    longPreview: document.getElementById('long-preview'),
    shortEditMode: document.getElementById('short-edit-mode'),
    longEditMode: document.getElementById('long-edit-mode'),
    shortEdit: document.getElementById('short-edit'),
    longEdit: document.getElementById('long-edit'),

    // Results Section Edit buttons
    shortEditBtn: document.getElementById('short-edit-btn'),
    shortSaveBtn: document.getElementById('short-save-btn'),
    shortCancelBtn: document.getElementById('short-cancel-btn'),
    longEditBtn: document.getElementById('long-edit-btn'),
    longSaveBtn: document.getElementById('long-save-btn'),
    longCancelBtn: document.getElementById('long-cancel-btn'),

    // Results Section Action buttons
    resetBtn: document.getElementById('reset-btn'),
    applyBtn: document.getElementById('apply-btn'),
    pdfApplyShortBtn: document.getElementById('pdf-apply-short-btn'),
    pdfApplyLongBtn: document.getElementById('pdf-apply-long-btn'),

    // Toasts
    successToast: document.getElementById('success-toast'),
    toastMessage: document.getElementById('toast-message'),
    errorToast: document.getElementById('error-toast'),
    errorMessage: document.getElementById('error-message'),
};

// State
let currentMode = 'text';
let selectedFile = null;
let currentResults = {
    shortDescription: '',
    longDescription: ''
};

// Utility functions
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showToast(message, isError = false) {
    const toast = isError ? elements.errorToast : elements.successToast;
    const messageEl = isError ? elements.errorMessage : elements.toastMessage;

    messageEl.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function setLoading(isLoading, message = 'Processing...') {
    elements.loadingText.textContent = message;
    if (isLoading) {
        elements.loadingSection.classList.remove('hidden');
    } else {
        elements.loadingSection.classList.add('hidden');
    }
}

function updateEnhanceButtonStates() {
    const hasShortContent = elements.shortInput.value.trim().length > 0;
    const hasLongContent = elements.longInput.value.trim().length > 0;
    elements.enhanceShortBtn.disabled = !hasShortContent;
    elements.enhanceLongBtn.disabled = !hasLongContent;
}

function updateExtractButtonState() {
    elements.extractBtn.disabled = !selectedFile;
}

// Mode switching
function switchMode(mode) {
    currentMode = mode;

    // Update buttons
    elements.modeText.classList.toggle('active', mode === 'text');
    elements.modePdf.classList.toggle('active', mode === 'pdf');

    // Update panels
    elements.textMode.classList.toggle('hidden', mode !== 'text');
    elements.pdfMode.classList.toggle('hidden', mode !== 'pdf');

    // Hide inline previews and results when switching
    if (elements.shortPreviewSection) elements.shortPreviewSection.classList.add('hidden');
    if (elements.longPreviewSection) elements.longPreviewSection.classList.add('hidden');
    if (elements.resultsSection) elements.resultsSection.classList.add('hidden');
}

// Text input handlers
function handleTextInput(textarea, countElement) {
    const count = textarea.value.length;
    countElement.textContent = `${count} characters`;
    updateEnhanceButtonStates();
}

// File upload handlers
function handleFileSelect(file) {
    if (!file) return;

    if (file.type !== 'application/pdf') {
        showToast('Please select a PDF file', true);
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showToast('File size must be less than 10MB', true);
        return;
    }

    selectedFile = file;
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = formatFileSize(file.size);

    elements.uploadZone.classList.add('hidden');
    elements.fileInfo.classList.remove('hidden');
    updateExtractButtonState();
}

function removeSelectedFile() {
    selectedFile = null;
    elements.pdfInput.value = '';
    elements.uploadZone.classList.remove('hidden');
    elements.fileInfo.classList.add('hidden');
    updateExtractButtonState();
}

// API calls - Individual enhancement
async function enhanceShortDescription() {
    const shortDescription = elements.shortInput.value.trim();

    if (!shortDescription) {
        showToast('Please enter a short description', true);
        return;
    }

    setLoading(true, 'Enhancing short description with AI...');

    const apiUrl = CONFIG.workerUrl ? `${CONFIG.workerUrl}/enhance` : '/api/enhance';

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shortDescription, longDescription: null })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Enhancement failed');
        }

        const data = await response.json();
        displayShortResult(data);
    } catch (error) {
        console.error('Enhancement error:', error);
        showToast(error.message || 'Enhancement failed. Please try again.', true);
    } finally {
        setLoading(false);
    }
}

async function enhanceLongDescription() {
    const longDescription = elements.longInput.value.trim();

    if (!longDescription) {
        showToast('Please enter a long description', true);
        return;
    }

    setLoading(true, 'Enhancing long description with AI...');

    const apiUrl = CONFIG.workerUrl ? `${CONFIG.workerUrl}/enhance` : '/api/enhance';

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shortDescription: null, longDescription })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Enhancement failed');
        }

        const data = await response.json();
        displayLongResult(data);
    } catch (error) {
        console.error('Enhancement error:', error);
        showToast(error.message || 'Enhancement failed. Please try again.', true);
    } finally {
        setLoading(false);
    }
}

async function extractFromPDF() {
    if (!selectedFile) {
        showToast('Please select a PDF file', true);
        return;
    }

    setLoading(true, 'Extracting and analyzing PDF content...');

    try {
        const formData = new FormData();
        formData.append('pdf', selectedFile);

        const response = await fetch('/api/extract-pdf', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'PDF extraction failed');
        }

        const data = await response.json();
        displayPdfResults(data);
    } catch (error) {
        console.error('PDF extraction error:', error);
        showToast(error.message || 'PDF extraction failed. Please try again.', true);
    } finally {
        setLoading(false);
    }
}

// Display results - for short description only (inline, text mode)
function displayShortResult(data) {
    currentResults.shortDescription = data.shortDescription || '';

    // Display in inline preview (text mode)
    if (elements.inlineShortPreview) {
        elements.inlineShortPreview.textContent = data.shortDescription || '';
    }
    if (elements.inlineShortEdit) {
        elements.inlineShortEdit.value = data.shortDescription || '';
    }

    // Show inline preview section
    elements.shortPreviewSection.classList.remove('hidden');

    // Reset edit mode
    hideInlineEditMode('short');
}

// Display results - for long description only (inline, text mode)
function displayLongResult(data) {
    currentResults.longDescription = data.longDescription || '';

    // Display in inline preview (as HTML)
    if (elements.inlineLongPreview) {
        elements.inlineLongPreview.innerHTML = data.longDescription || '';
    }
    if (elements.inlineLongEdit) {
        elements.inlineLongEdit.value = data.longDescription || '';
    }

    // Show inline preview section
    elements.longPreviewSection.classList.remove('hidden');

    // Reset edit mode
    hideInlineEditMode('long');
}

// Display PDF results (uses separate results section)
function displayPdfResults(data) {
    currentResults = {
        shortDescription: data.shortDescription || '',
        longDescription: data.longDescription || ''
    };

    // Get the results section elements (these are different from inline preview elements)
    const resultsShortPreview = elements.resultsSection.querySelector('#short-preview');
    const resultsLongPreview = elements.resultsSection.querySelector('#long-preview');
    const resultsShortEdit = elements.resultsSection.querySelector('#short-edit');
    const resultsLongEdit = elements.resultsSection.querySelector('#long-edit');

    // Populate the results section
    if (resultsShortPreview) {
        resultsShortPreview.textContent = data.shortDescription || '';
    }
    if (resultsShortEdit) {
        resultsShortEdit.value = data.shortDescription || '';
    }
    if (resultsLongPreview) {
        resultsLongPreview.innerHTML = data.longDescription || '';
    }
    if (resultsLongEdit) {
        resultsLongEdit.value = data.longDescription || '';
    }

    // Show the results section
    elements.resultsSection.classList.remove('hidden');

    // Show warnings if any
    displayWarnings(data);

    // Reset edit modes in results section
    const shortEditMode = elements.resultsSection.querySelector('#short-edit-mode');
    const longEditMode = elements.resultsSection.querySelector('#long-edit-mode');
    if (shortEditMode) shortEditMode.classList.add('hidden');
    if (longEditMode) longEditMode.classList.add('hidden');
    if (resultsShortPreview) resultsShortPreview.classList.remove('hidden');
    if (resultsLongPreview) resultsLongPreview.classList.remove('hidden');
}

// Display warnings helper
function displayWarnings(data) {
    let hasWarnings = false;

    // Confidence warning (PDF mode only)
    if (data.lowConfidence && elements.confidenceWarning) {
        elements.confidenceWarning.classList.remove('hidden');
        const confidencePercent = Math.round(data.confidence * 100);
        elements.confidenceMessage.textContent =
            `AI confidence is ${confidencePercent}%. Please verify accuracy before publishing.`;
        hasWarnings = true;
    } else if (elements.confidenceWarning) {
        elements.confidenceWarning.classList.add('hidden');
    }

    // Compliance warnings
    if (data.complianceWarnings && data.complianceWarnings.length > 0 && elements.complianceWarning) {
        elements.complianceWarning.classList.remove('hidden');
        elements.complianceList.innerHTML = data.complianceWarnings
            .map(w => `<li>${w}</li>`)
            .join('');
        hasWarnings = true;
    } else if (elements.complianceWarning) {
        elements.complianceWarning.classList.add('hidden');
    }

    if (elements.warningsBanner) {
        elements.warningsBanner.classList.toggle('hidden', !hasWarnings);
    }
}

// Edit mode handlers for results section (PDF mode)
function showEditMode(type) {
    if (type === 'short') {
        elements.shortPreview.classList.add('hidden');
        elements.shortEditMode.classList.remove('hidden');
        elements.shortEditBtn.classList.add('hidden');
        elements.shortSaveBtn.classList.remove('hidden');
        elements.shortCancelBtn.classList.remove('hidden');
    } else {
        elements.longPreview.classList.add('hidden');
        elements.longEditMode.classList.remove('hidden');
        elements.longEditBtn.classList.add('hidden');
        elements.longSaveBtn.classList.remove('hidden');
        elements.longCancelBtn.classList.remove('hidden');
    }
}

function hideEditMode(type) {
    if (type === 'short') {
        elements.shortPreview.classList.remove('hidden');
        elements.shortEditMode.classList.add('hidden');
        elements.shortEditBtn.classList.remove('hidden');
        elements.shortSaveBtn.classList.add('hidden');
        elements.shortCancelBtn.classList.add('hidden');
    } else {
        elements.longPreview.classList.remove('hidden');
        elements.longEditMode.classList.add('hidden');
        elements.longEditBtn.classList.remove('hidden');
        elements.longSaveBtn.classList.add('hidden');
        elements.longCancelBtn.classList.add('hidden');
    }
}

// Edit mode handlers for inline previews (text mode)
function showInlineEditMode(type) {
    if (type === 'short') {
        elements.inlineShortPreview.classList.add('hidden');
        elements.inlineShortEditMode.classList.remove('hidden');
        elements.inlineShortEditBtn.classList.add('hidden');
        elements.inlineShortSaveBtn.classList.remove('hidden');
        elements.inlineShortCancelBtn.classList.remove('hidden');
    } else {
        elements.inlineLongPreview.classList.add('hidden');
        elements.inlineLongEditMode.classList.remove('hidden');
        elements.inlineLongEditBtn.classList.add('hidden');
        elements.inlineLongSaveBtn.classList.remove('hidden');
        elements.inlineLongCancelBtn.classList.remove('hidden');
    }
}

function hideInlineEditMode(type) {
    if (type === 'short') {
        elements.inlineShortPreview.classList.remove('hidden');
        elements.inlineShortEditMode.classList.add('hidden');
        elements.inlineShortEditBtn.classList.remove('hidden');
        elements.inlineShortSaveBtn.classList.add('hidden');
        elements.inlineShortCancelBtn.classList.add('hidden');
    } else {
        elements.inlineLongPreview.classList.remove('hidden');
        elements.inlineLongEditMode.classList.add('hidden');
        elements.inlineLongEditBtn.classList.remove('hidden');
        elements.inlineLongSaveBtn.classList.add('hidden');
        elements.inlineLongCancelBtn.classList.add('hidden');
    }
}

function saveInlineEdit(type) {
    if (type === 'short') {
        currentResults.shortDescription = elements.inlineShortEdit.value;
        elements.inlineShortPreview.textContent = elements.inlineShortEdit.value;
    } else {
        currentResults.longDescription = elements.inlineLongEdit.value;
        elements.inlineLongPreview.innerHTML = elements.inlineLongEdit.value;
    }
    hideInlineEditMode(type);
}

function cancelInlineEdit(type) {
    if (type === 'short') {
        elements.inlineShortEdit.value = currentResults.shortDescription;
    } else {
        elements.inlineLongEdit.value = currentResults.longDescription;
    }
    hideInlineEditMode(type);
}

function saveEdit(type) {
    if (type === 'short') {
        currentResults.shortDescription = elements.shortEdit.value;
        elements.shortPreview.textContent = elements.shortEdit.value;
    } else {
        currentResults.longDescription = elements.longEdit.value;
        elements.longPreview.innerHTML = elements.longEdit.value;
    }
    hideEditMode(type);
}

function cancelEdit(type) {
    if (type === 'short') {
        elements.shortEdit.value = currentResults.shortDescription;
    } else {
        elements.longEdit.value = currentResults.longDescription;
    }
    hideEditMode(type);
}

// Apply individual description
function applyShortDescription() {
    if (!currentResults.shortDescription) {
        showToast('No short description to apply', true);
        return;
    }

    console.log('Applied short description:', currentResults.shortDescription);
    navigator.clipboard?.writeText(currentResults.shortDescription).catch(() => { });
    showToast('Short description copied to clipboard!');
}

function applyLongDescription() {
    if (!currentResults.longDescription) {
        showToast('No long description to apply', true);
        return;
    }

    console.log('Applied long description:', currentResults.longDescription);
    navigator.clipboard?.writeText(currentResults.longDescription).catch(() => { });
    showToast('Long description copied to clipboard!');
}

// Apply both descriptions (for PDF mode)
function applyDescriptions() {
    if (!currentResults.shortDescription && !currentResults.longDescription) {
        showToast('No descriptions to apply', true);
        return;
    }

    const combined = `Short Description:\n${currentResults.shortDescription}\n\nLong Description:\n${currentResults.longDescription}`;
    console.log('Applied descriptions:', combined);
    navigator.clipboard?.writeText(combined).catch(() => { });
    showToast('Descriptions copied to clipboard!');
}

// Reset
function resetAll() {
    // Clear inputs
    elements.shortInput.value = '';
    elements.longInput.value = '';
    elements.shortCount.textContent = '0 characters';
    elements.longCount.textContent = '0 characters';

    // Clear file
    removeSelectedFile();

    // Hide inline previews
    if (elements.shortPreviewSection) elements.shortPreviewSection.classList.add('hidden');
    if (elements.longPreviewSection) elements.longPreviewSection.classList.add('hidden');
    if (elements.resultsSection) elements.resultsSection.classList.add('hidden');
    if (elements.warningsBanner) elements.warningsBanner.classList.add('hidden');

    // Reset state
    currentResults = {
        shortDescription: '',
        longDescription: ''
    };
    updateEnhanceButtonStates();
}

// Event Listeners
function initEventListeners() {
    // Mode switching
    elements.modeText.addEventListener('click', () => switchMode('text'));
    elements.modePdf.addEventListener('click', () => switchMode('pdf'));

    // Text inputs
    elements.shortInput.addEventListener('input', () => {
        handleTextInput(elements.shortInput, elements.shortCount);
    });
    elements.longInput.addEventListener('input', () => {
        handleTextInput(elements.longInput, elements.longCount);
    });

    // Individual enhance buttons
    elements.enhanceShortBtn.addEventListener('click', enhanceShortDescription);
    elements.enhanceLongBtn.addEventListener('click', enhanceLongDescription);

    // File upload
    elements.pdfInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files[0]);
    });

    // Drag and drop
    elements.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.add('dragover');
    });

    elements.uploadZone.addEventListener('dragleave', () => {
        elements.uploadZone.classList.remove('dragover');
    });

    elements.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.remove('dragover');
        handleFileSelect(e.dataTransfer.files[0]);
    });

    elements.removeFile.addEventListener('click', removeSelectedFile);
    elements.extractBtn.addEventListener('click', extractFromPDF);

    // Edit modes for results section (PDF mode)
    elements.shortEditBtn.addEventListener('click', () => showEditMode('short'));
    elements.shortSaveBtn.addEventListener('click', () => saveEdit('short'));
    elements.shortCancelBtn.addEventListener('click', () => cancelEdit('short'));

    elements.longEditBtn.addEventListener('click', () => showEditMode('long'));
    elements.longSaveBtn.addEventListener('click', () => saveEdit('long'));
    elements.longCancelBtn.addEventListener('click', () => cancelEdit('long'));

    // Edit modes for inline previews (text mode)
    if (elements.inlineShortEditBtn) {
        elements.inlineShortEditBtn.addEventListener('click', () => showInlineEditMode('short'));
    }
    if (elements.inlineShortSaveBtn) {
        elements.inlineShortSaveBtn.addEventListener('click', () => saveInlineEdit('short'));
    }
    if (elements.inlineShortCancelBtn) {
        elements.inlineShortCancelBtn.addEventListener('click', () => cancelInlineEdit('short'));
    }
    if (elements.inlineLongEditBtn) {
        elements.inlineLongEditBtn.addEventListener('click', () => showInlineEditMode('long'));
    }
    if (elements.inlineLongSaveBtn) {
        elements.inlineLongSaveBtn.addEventListener('click', () => saveInlineEdit('long'));
    }
    if (elements.inlineLongCancelBtn) {
        elements.inlineLongCancelBtn.addEventListener('click', () => cancelInlineEdit('long'));
    }

    // Apply buttons for inline previews (text mode)
    if (elements.inlineApplyShortBtn) {
        elements.inlineApplyShortBtn.addEventListener('click', applyShortDescription);
    }
    if (elements.inlineApplyLongBtn) {
        elements.inlineApplyLongBtn.addEventListener('click', applyLongDescription);
    }

    // Reset and Apply buttons for results section (PDF mode)
    if (elements.resetBtn) {
        elements.resetBtn.addEventListener('click', resetAll);
    }
    if (elements.applyBtn) {
        elements.applyBtn.addEventListener('click', applyDescriptions);
    }
    if (elements.pdfApplyShortBtn) {
        elements.pdfApplyShortBtn.addEventListener('click', applyShortDescription);
    }
    if (elements.pdfApplyLongBtn) {
        elements.pdfApplyLongBtn.addEventListener('click', applyLongDescription);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    updateEnhanceButtonStates();
    updateExtractButtonState();
});
