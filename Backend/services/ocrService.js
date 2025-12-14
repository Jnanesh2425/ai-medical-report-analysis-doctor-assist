const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

class OCRService {
  constructor() {
    this.pdfParse = null;
  }

  // Lazy load pdf-parse
  async loadPdfParse() {
    if (!this.pdfParse) {
      try {
        this.pdfParse = require('pdf-parse');
      } catch (e) {
        console.log('pdf-parse require failed, trying dynamic import...');
        try {
          const module = await import('pdf-parse');
          this.pdfParse = module.default || module;
        } catch (e2) {
          console.error('Failed to load pdf-parse:', e2.message);
          throw new Error('PDF parsing library not available');
        }
      }
    }
    return this.pdfParse;
  }

  // Extract text from image using Tesseract
  async extractFromImage(imagePath) {
    try {
      console.log('🔍 Starting OCR for image:', imagePath);
      
      const result = await Tesseract.recognize(imagePath, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      console.log('✅ OCR completed successfully');
      return result.data.text;
    } catch (error) {
      console.error('❌ OCR Error:', error.message);
      throw new Error(`OCR failed: ${error.message}`);
    }
  }

  // Extract text from PDF
  async extractFromPDF(pdfPath) {
    try {
      console.log('📄 Starting PDF text extraction:', pdfPath);
      
      const pdfParse = await this.loadPdfParse();
      
      const dataBuffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(dataBuffer);

      console.log('✅ PDF text extraction completed');
      return data.text;
    } catch (error) {
      console.error('❌ PDF Extraction Error:', error.message);
      // Fallback: Return empty text if PDF parsing fails
      console.log('⚠️ Using fallback - returning file info');
      return `PDF file uploaded: ${path.basename(pdfPath)}. Manual text extraction may be needed.`;
    }
  }

  // Main extraction method - determines file type and extracts text
  async extractText(filePath, fileType) {
    try {
      if (fileType === 'pdf') {
        return await this.extractFromPDF(filePath);
      } else {
        return await this.extractFromImage(filePath);
      }
    } catch (error) {
      console.error('❌ Text extraction failed:', error.message);
      throw error;
    }
  }

  // Clean and preprocess extracted text
  cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
      .replace(/\n+/g, '\n')          // Replace multiple newlines with single newline
      .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable characters
      .trim();
  }
}

module.exports = new OCRService();