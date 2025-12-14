const express = require('express');
const router = express.Router();
const {
  uploadReport,
  getMyReports,
  getAllReports,
  getReportById,
  addDoctorNotes
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/upload', protect, authorize('patient'), upload.single('file'), uploadReport);
router.get('/my-reports', protect, authorize('patient'), getMyReports);
router.get('/all', protect, authorize('doctor'), getAllReports);
router.get('/:id', protect, getReportById);
router.put('/:id/notes', protect, authorize('doctor'), addDoctorNotes);

module.exports = router;