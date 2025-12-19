const express = require('express');
const router = express.Router();
const {
  registerPatient,
  registerDoctor,
  login,
  getMe,
  getMyPatients,
  assignUnassignedPatients,
  generateDoctorCode
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register/patient', registerPatient);
router.post('/register/doctor', registerDoctor);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/my-patients', protect, getMyPatients);
router.post('/assign-patients', protect, assignUnassignedPatients);
router.post('/generate-doctor-code', protect, generateDoctorCode);

module.exports = router;