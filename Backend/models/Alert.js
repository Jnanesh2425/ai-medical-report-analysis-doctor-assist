const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientName: {
    type: String,
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  report: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report'
  },
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report'
  },
  message: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  alertType: {
    type: String,
    enum: ['abnormality', 'high_risk', 'new_report', 'urgent'],
    default: 'new_report'
  },
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedAt: {
    type: Date
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster queries
alertSchema.index({ doctor: 1, acknowledged: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);