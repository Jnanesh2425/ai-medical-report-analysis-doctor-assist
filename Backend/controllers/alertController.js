const Alert = require('../models/Alert');

// @desc    Get alerts for doctor
// @route   GET /api/alerts
// @access  Private (Doctor)
exports.getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({ doctor: req.user._id })
      .populate('patient', 'name email')
      .populate('report', 'fileName reportType riskLevel')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alerts',
      error: error.message
    });
  }
};

// @desc    Acknowledge alert
// @route   PUT /api/alerts/:id/acknowledge
// @access  Private (Doctor)
exports.acknowledgeAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: req.user._id
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Alert acknowledged',
      alert
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert',
      error: error.message
    });
  }
};

// @desc    Get unread alerts count
// @route   GET /api/alerts/unread-count
// @access  Private (Doctor)
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Alert.countDocuments({
      doctor: req.user._id,
      acknowledged: false
    });

    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch count',
      error: error.message
    });
  }
};