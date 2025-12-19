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
        try {
          const module = await import('pdf-parse');
          this.pdfParse = module.default || module;
        } catch (e2) {
          throw new Error('PDF parsing library not available');
        }
      }
    }
    return this.pdfParse;
  }

  // Extract text from image using Tesseract
  async extractFromImage(imagePath) {
    try {
      const result = await Tesseract.recognize(imagePath, 'eng', {
        logger: () => {} // Silent logger
      });

      return result.data.text;
    } catch (error) {
      throw new Error(`OCR failed: ${error.message}`);
    }
  }

  // Extract text from PDF
  async extractFromPDF(pdfPath) {
    try {
      const pdfParse = await this.loadPdfParse();
      
      const dataBuffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(dataBuffer);

      return data.text;
    } catch (error) {
      // Fallback: Return empty text if PDF parsing fails
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