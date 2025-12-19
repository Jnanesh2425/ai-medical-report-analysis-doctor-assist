const Report = require('../models/Report');
const Alert = require('../models/Alert');
const User = require('../models/User');
const ocrService = require('../services/ocrService');
const aiService = require('../services/aiService');
const path = require('path');

// @desc    Upload and analyze report
// @route   POST /api/reports/upload
// @access  Private (Patient)
exports.uploadReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file'
      });
    }

    const { reportType, notes } = req.body;
    const file = req.file;

    // Determine file type
    const fileType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';

    // Create report record
    const report = await Report.create({
      patient: req.user._id,
      fileName: file.filename,
      originalName: file.originalname,
      filePath: file.path,
      fileType,
      reportType: reportType || 'General',
      notes,
      status: 'processing'
    });

    // Send immediate response
    res.status(201).json({
      success: true,
      message: 'Report uploaded successfully. Processing...',
      report: {
        _id: report._id,
        fileName: report.originalName,
        reportType: report.reportType,
        status: report.status,
        createdAt: report.createdAt
      }
    });

    // Process in background
    processReport(report._id, file.path, fileType, reportType, req.user);

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload report',
      error: error.message
    });
  }
};

// Background processing function
async function processReport(reportId, filePath, fileType, reportType, user) {
  try {
    // Step 1: Extract text using OCR
    let extractedText = await ocrService.extractText(filePath, fileType);
    extractedText = ocrService.cleanText(extractedText);

    // Step 2: Analyze with AI
    const analysis = await aiService.analyzeReport(extractedText, reportType);

    // Step 3: Update report with results
    const updatedReport = await Report.findByIdAndUpdate(
      reportId,
      {
        extractedText,
        summary: analysis.summary,
        keyFindings: analysis.keyFindings,
        abnormalities: analysis.abnormalities,
        riskLevel: analysis.riskLevel,
        riskScore: analysis.riskScore,
        recommendations: analysis.recommendations,
        status: 'completed'
      },
      { new: true }
    ).populate('patient', 'name email assignedDoctor');

    // Step 4: Create alert if high risk
    if (analysis.riskLevel === 'high' || analysis.abnormalities.length > 0) {
      await createAlert(updatedReport, user);
    }

    // Emit socket event for real-time update
    if (global.io) {
      global.io.emit('reportProcessed', {
        reportId,
        status: 'completed',
        riskLevel: analysis.riskLevel
      });
    }

  } catch (error) {
    console.error(`❌ Processing failed for report ${reportId}:`, error);
    
    await Report.findByIdAndUpdate(reportId, {
      status: 'failed',
      processingError: error.message
    });
  }
}

// Create alert for doctor
async function createAlert(report, user) {
  try {
    const patient = await User.findById(user._id).populate('assignedDoctor');
    
    if (!patient?.assignedDoctor) {
      return;
    }

    const alert = await Alert.create({
      patient: user._id,
      patientName: user.name,
      doctor: patient.assignedDoctor._id,
      report: report._id,
      reportId: report._id,
      message: `${report.riskLevel === 'high' ? '🚨 HIGH RISK: ' : '⚠️ '} New ${report.reportType} report from ${user.name}. ${report.abnormalities.length} abnormalities detected.`,
      severity: report.riskLevel,
      alertType: report.riskLevel === 'high' ? 'high_risk' : 'abnormality'
    });

    // Emit socket event
    if (global.io) {
      global.io.to(`doctor_${patient.assignedDoctor._id}`).emit('newAlert', alert);
    }
  } catch (error) {
    console.error('Alert creation failed:', error);
  }
}

// @desc    Get patient's reports
// @route   GET /api/reports/my-reports
// @access  Private (Patient)
exports.getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({ patient: req.user._id })
      .sort({ createdAt: -1 })
      .select('-extractedText');

    res.status(200).json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message
    });
  }
};

// @desc    Get all reports (Doctor)
// @route   GET /api/reports/all
// @access  Private (Doctor)
exports.getAllReports = async (req, res) => {
  try {
    // Find all patients assigned to this doctor
    const patients = await User.find({ 
      userType: 'patient', 
      assignedDoctor: req.user._id 
    }).select('_id');
    
    const patientIds = patients.map(p => p._id);
    
    // Also check doctor's patients array for backwards compatibility
    const doctor = await User.findById(req.user._id);
    const allPatientIds = [...new Set([
      ...patientIds.map(id => id.toString()),
      ...(doctor.patients || []).map(id => id.toString())
    ])];
    
    const reports = await Report.find({
      patient: { $in: allPatientIds }
    })
      .populate('patient', 'name email phone')
      .sort({ createdAt: -1 })
      .select('-extractedText');

    res.status(200).json({
      success: true,
      count: reports.length,
      reports,
      totalPatients: allPatientIds.length
    });
  } catch (error) {
    console.error('Get all reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message
    });
  }
};

// @desc    Get single report
// @route   GET /api/reports/:id
// @access  Private
exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('patient', 'name email phone')
      .populate('reviewedBy', 'name');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check authorization
    if (req.user.userType === 'patient' && report.patient._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this report'
      });
    }

    res.status(200).json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report',
      error: error.message
    });
  }
};

// @desc    Add doctor notes to report
// @route   PUT /api/reports/:id/notes
// @access  Private (Doctor)
exports.addDoctorNotes = async (req, res) => {
  try {
    const { doctorNotes } = req.body;

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        doctorNotes,
        reviewedBy: req.user._id,
        reviewedAt: new Date()
      },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notes added successfully',
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add notes',
      error: error.message
    });
  }
};

// @desc    Get reports for a specific patient (Doctor)
// @route   GET /api/reports/patient/:patientId
// @access  Private (Doctor)
exports.getPatientReports = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Verify the patient is assigned to this doctor
    const patient = await User.findOne({
      _id: patientId,
      userType: 'patient',
      assignedDoctor: req.user._id
    });

    if (!patient && req.user.userType === 'doctor') {
      // Also check if patient is in doctor's patients array
      const doctor = await User.findById(req.user._id);
      if (!doctor.patients?.includes(patientId)) {
        return res.status(403).json({
          success: false,
          message: 'This patient is not assigned to you'
        });
      }
    }

    const reports = await Report.find({ patient: patientId })
      .sort({ createdAt: -1 })
      .select('-extractedText');

    res.status(200).json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient reports',
      error: error.message
    });
  }
};