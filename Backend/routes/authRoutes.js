const express = require('express');
const router = express.Router();
const {
  registerPatient,
  registerDoctor,
  login,
  getMe,
  getMyPatients,
  assignUnassignedPatients
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register/patient', registerPatient);
router.post('/register/doctor', registerDoctor);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/my-patients', protect, getMyPatients);
router.post('/assign-patients', protect, assignUnassignedPatients);

module.exports = router;