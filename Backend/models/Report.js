const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['pdf', 'image'],
    required: true
  },
  reportType: {
    type: String,
    required: true
  },
  notes: {
    type: String
  },
  // OCR Extracted Text
  extractedText: {
    type: String
  },
  // AI Analysis Results
  summary: {
    type: String
  },
  keyFindings: [{
    type: String
  }],
  abnormalities: [{
    type: String
  }],
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'low'
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  recommendations: [{
    type: String
  }],
  // Processing Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processingError: {
    type: String
  },
  // Doctor Review
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  doctorNotes: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster queries
reportSchema.index({ patient: 1, createdAt: -1 });
reportSchema.index({ riskLevel: 1 });

module.exports = mongoose.model('Report', reportSchema);