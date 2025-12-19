const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @desc    Register patient
// @route   POST /api/auth/register/patient
// @access  Public
exports.registerPatient = async (req, res) => {
  try {
    const { name, email, password, phone, dateOfBirth, doctorCode } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Find doctor - by code if provided, otherwise find any available doctor
    let doctor = null;
    if (doctorCode) {
      doctor = await User.findOne({ doctorCode: doctorCode.toUpperCase(), userType: 'doctor' });
      if (!doctor) {
        return res.status(400).json({
          success: false,
          message: 'Invalid doctor code. Please check with your doctor.'
        });
      }
    } else {
      // Find a doctor to assign (simple round-robin)
      doctor = await User.findOne({ userType: 'doctor' }).sort({ patients: 1 });
    }

    // Create patient with assigned doctor
    const user = await User.create({
      name,
      email,
      password,
      phone,
      dateOfBirth,
      userType: 'patient',
      assignedDoctor: doctor?._id
    });

    // Add patient to doctor's list if doctor exists
    if (doctor) {
      doctor.patients.push(user._id);
      await doctor.save();
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        phone: user.phone,
        assignedDoctor: {
          _id: doctor._id,
          name: doctor.name,
          specialization: doctor.specialization
        }
      },
      token
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// @desc    Register doctor
// @route   POST /api/auth/register/doctor
// @access  Public
exports.registerDoctor = async (req, res) => {
  try {
    const { name, email, password, specialization, licenseNumber } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Generate unique doctor code (DR + random 6 digits)
    const doctorCode = 'DR' + Math.random().toString().slice(2, 8);

    // Create doctor
    const user = await User.create({
      name,
      email,
      password,
      specialization,
      licenseNumber,
      doctorCode,
      userType: 'doctor'
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        specialization: user.specialization,
        doctorCode: user.doctorCode
      },
      token
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password, userType } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email, userType }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        specialization: user.specialization,
        doctorCode: user.doctorCode,
        assignedDoctor: user.assignedDoctor
      },
      token
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('assignedDoctor', 'name email specialization')
      .populate('patients', 'name email');

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user',
      error: error.message
    });
  }
};

// @desc    Get all patients for a doctor
// @route   GET /api/auth/my-patients
// @access  Private (Doctor)
exports.getMyPatients = async (req, res) => {
  try {
    if (req.user.userType !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can access this endpoint'
      });
    }

    // Find all patients assigned to this doctor
    const patients = await User.find({ 
      userType: 'patient', 
      assignedDoctor: req.user._id 
    }).select('name email phone dateOfBirth createdAt');

    res.status(200).json({
      success: true,
      count: patients.length,
      patients
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get patients',
      error: error.message
    });
  }
};

// @desc    Assign unassigned patients to doctor
// @route   POST /api/auth/assign-patients
// @access  Private (Doctor)
exports.assignUnassignedPatients = async (req, res) => {
  try {
    if (req.user.userType !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can access this endpoint'
      });
    }

    // Find all patients without an assigned doctor
    const unassignedPatients = await User.find({ 
      userType: 'patient', 
      assignedDoctor: { $exists: false }
    });

    // Also find patients where assignedDoctor is null
    const nullDoctorPatients = await User.find({ 
      userType: 'patient', 
      assignedDoctor: null
    });

    const allUnassigned = [...unassignedPatients, ...nullDoctorPatients];

    // Assign all to this doctor
    for (const patient of allUnassigned) {
      patient.assignedDoctor = req.user._id;
      await patient.save();
    }

    // Update doctor's patients array
    const doctor = await User.findById(req.user._id);
    const newPatientIds = allUnassigned.map(p => p._id);
    doctor.patients = [...new Set([...(doctor.patients || []).map(id => id.toString()), ...newPatientIds.map(id => id.toString())])];
    await doctor.save();

    res.status(200).json({
      success: true,
      message: `Assigned ${allUnassigned.length} patients to you`,
      assignedCount: allUnassigned.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to assign patients',
      error: error.message
    });
  }
};

// @desc    Generate doctor code for existing doctor (if missing)
// @route   POST /api/auth/generate-doctor-code
// @access  Private (Doctor)
exports.generateDoctorCode = async (req, res) => {
  try {
    if (req.user.userType !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can access this endpoint'
      });
    }

    const doctor = await User.findById(req.user._id);
    
    // If doctor already has a code, return it
    if (doctor.doctorCode) {
      return res.status(200).json({
        success: true,
        message: 'Doctor code already exists',
        doctorCode: doctor.doctorCode
      });
    }

    // Generate new doctor code
    const doctorCode = 'DR' + Math.random().toString().slice(2, 8);
    doctor.doctorCode = doctorCode;
    await doctor.save();

    res.status(200).json({
      success: true,
      message: 'Doctor code generated successfully',
      doctorCode: doctorCode
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate doctor code',
      error: error.message
    });
  }
};