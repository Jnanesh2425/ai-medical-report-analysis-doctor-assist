// src/alerts/__tests__/alertEngine.test.js - Jest tests for alertEngine
// Tests: Emergency rule trigger, LLM classification, Fusion logic, Cooldown, Groq failure fallback

const { evaluateAndEmitAlert } = require('../alertEngine');
const alertStore = require('../alertStore');
const { callGroq } = require('../../lib/groqClient');

// Mock dependencies
jest.mock('../alertStore');
jest.mock('../../lib/groqClient');

describe('alertEngine', () => {
  let mockIo;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock Socket.IO instance
    mockIo = {
      emit: jest.fn()
    };
    
    // Mock alertStore
    alertStore.pushAlert = jest.fn((alert) => alert);
    alertStore.getRecentForPatient = jest.fn(() => []);
    alertStore.clear = jest.fn(() => 0);
  });
  
  describe('Emergency rule trigger (high fever)', () => {
    it('should trigger Emergency alert for tempC >= 38.5', async () => {
      const patient = { id: 'P001', name: 'Test Patient' };
      const ruleResult = { rule_score: 5, rule_label: 'Medium', breakdown: [] };
      const vitals = { tempC: 39.0, hr: 80, spo2: 95 };
      
      const alert = await evaluateAndEmitAlert({
        io: mockIo,
        patient,
        ruleResult,
        vitals,
        message: '',
        timestamp: new Date().toISOString()
      });
      
      expect(alert).toBeTruthy();
      expect(alert.level).toBe('Emergency');
      expect(alert.source).toBe('rules');
      expect(alert.reason).toContain('fever');
      expect(alert.patient.id).toBe('P001');
      expect(alertStore.pushAlert).toHaveBeenCalled();
      expect(mockIo.emit).toHaveBeenCalledWith('alert:new', expect.objectContaining({ level: 'Emergency' }));
    });
    
    it('should trigger Emergency alert for SpO2 < 90', async () => {
      const patient = { id: 'P002', name: 'Test Patient 2' };
      const ruleResult = { rule_score: 3, rule_label: 'Low', breakdown: [] };
      const vitals = { tempC: 37.0, hr: 80, spo2: 88 };
      
      const alert = await evaluateAndEmitAlert({
        io: mockIo,
        patient,
        ruleResult,
        vitals,
        message: '',
        timestamp: new Date().toISOString()
      });
      
      expect(alert).toBeTruthy();
      expect(alert.level).toBe('Emergency');
      expect(alert.reason).toContain('oxygen saturation');
      expect(alert.reason).toContain('<90%');
    });
    
    it('should trigger Emergency alert for active bleeding in message', async () => {
      const patient = { id: 'P003', name: 'Test Patient 3' };
      const ruleResult = { rule_score: 2, rule_label: 'Low', breakdown: [] };
      const message = 'I have uncontrolled bleeding from my wound';
      
      const alert = await evaluateAndEmitAlert({
        io: mockIo,
        patient,
        ruleResult,
        message,
        timestamp: new Date().toISOString()
      });
      
      expect(alert).toBeTruthy();
      expect(alert.level).toBe('Emergency');
      expect(alert.reason).toContain('bleeding');
    });
  });
  
  describe('LLM message classification', () => {
    it('should classify Emergency message correctly', async () => {
      const patient = { id: 'P004', name: 'Test Patient 4' };
      const message = "I'm coughing up blood";
      
      // Mock Groq response
      callGroq.mockResolvedValue({
        text: '{"label":"Emergency","reason":"Hemoptysis indicates potential internal bleeding"}'
      });
      
      const alert = await evaluateAndEmitAlert({
        io: mockIo,
        patient,
        ruleResult: null,
        message,
        timestamp: new Date().toISOString()
      });
      
      expect(alert).toBeTruthy();
      expect(alert.level).toBe('Emergency');
      expect(alert.source).toBe('llm');
      expect(callGroq).toHaveBeenCalled();
      expect(alertStore.pushAlert).toHaveBeenCalled();
    });
    
    it('should classify Priority message correctly', async () => {
      const patient = { id: 'P005', name: 'Test Patient 5' };
      const message = 'My surgical wound is red and draining yellow fluid, temp 38.8°C';
      
      // Mock Groq response
      callGroq.mockResolvedValue({
        text: '{"label":"Priority","reason":"Signs of surgical site infection with fever"}'
      });
      
      const alert = await evaluateAndEmitAlert({
        io: mockIo,
        patient,
        ruleResult: { rule_score: 0, rule_label: 'Low', breakdown: [] },
        message,
        timestamp: new Date().toISOString()
      });
      
      expect(alert).toBeTruthy();
      expect(alert.level).toBe('Normal'); // Low rule score, so Priority becomes Normal
      expect(alert.source).toBe('llm');
    });
  });
  
  describe('Fusion logic (Priority)', () => {
    it('should create Priority alert when LLM Priority + rule_score >= 8', async () => {
      const patient = { id: 'P006', name: 'Test Patient 6' };
      const ruleResult = { rule_score: 10, rule_label: 'High', breakdown: ['Fever', 'High WBC'] };
      const message = 'wound is draining';
      
      // Mock Groq response
      callGroq.mockResolvedValue({
        text: '{"label":"Priority","reason":"infection signs"}'
      });
      
      const alert = await evaluateAndEmitAlert({
        io: mockIo,
        patient,
        ruleResult,
        message,
        timestamp: new Date().toISOString()
      });
      
      expect(alert).toBeTruthy();
      expect(alert.level).toBe('Priority');
      expect(alert.source).toBe('fusion');
      expect(alert.reason).toContain('Elevated risk score');
    });
  });
  
  describe('Cooldown prevents duplicates', () => {
    it('should return existing alert if within cooldown period', async () => {
      const patient = { id: 'P007', name: 'Test Patient 7' };
      const ruleResult = { rule_score: 12, rule_label: 'High', breakdown: [] };
      const vitals = { tempC: 39.5 };
      
      // First call - should create alert
      const firstAlert = await evaluateAndEmitAlert({
        io: mockIo,
        patient,
        ruleResult,
        vitals,
        timestamp: new Date().toISOString()
      });
      
      expect(firstAlert).toBeTruthy();
      expect(alertStore.pushAlert).toHaveBeenCalledTimes(1);
      
      // Mock getRecentForPatient to return the first alert (simulating cooldown)
      const recentTime = new Date().toISOString();
      alertStore.getRecentForPatient.mockReturnValue([{
        id: firstAlert.id,
        level: 'Emergency',
        timestamp: recentTime,
        patient: { id: patient.id }
      }]);
      
      // Second call immediately after - should return existing
      const secondAlert = await evaluateAndEmitAlert({
        io: mockIo,
        patient,
        ruleResult,
        vitals,
        timestamp: new Date().toISOString()
      });
      
      // Should return existing alert or null (cooldown active)
      expect(alertStore.pushAlert).toHaveBeenCalledTimes(1); // Not called again
    });
  });
  
  describe('Groq failure fallback', () => {
    it('should fallback to rule-based alert when Groq fails', async () => {
      const patient = { id: 'P008', name: 'Test Patient 8' };
      const ruleResult = { rule_score: 11, rule_label: 'High', breakdown: ['Multiple risk factors'] };
      const message = 'some message';
      
      // Mock Groq to throw error
      callGroq.mockRejectedValue(new Error('Groq API error'));
      
      // Should not throw, should return rule-based alert
      const alert = await evaluateAndEmitAlert({
        io: mockIo,
        patient,
        ruleResult,
        message,
        timestamp: new Date().toISOString()
      });
      
      // Should still return an alert (rule-based fallback)
      expect(alert).toBeTruthy();
      expect(alert.level).toBe('Priority'); // rule_score >= 10
      expect(alert.source).toBe('rules');
      expect(callGroq).toHaveBeenCalled();
    });
    
    it('should handle invalid JSON response from Groq', async () => {
      const patient = { id: 'P009', name: 'Test Patient 9' };
      const message = 'test message';
      
      // Mock Groq to return invalid JSON
      callGroq.mockResolvedValue({
        text: 'This is not valid JSON'
      });
      
      const alert = await evaluateAndEmitAlert({
        io: mockIo,
        patient,
        ruleResult: { rule_score: 0, rule_label: 'Low', breakdown: [] },
        message,
        timestamp: new Date().toISOString()
      });
      
      // Should still return an alert (fallback to Normal)
      expect(alert).toBeTruthy();
      expect(alert.level).toBe('Normal');
    });
  });
  
  describe('Rule-based scoring only', () => {
    it('should create Priority alert for rule_score >= 10', async () => {
      const patient = { id: 'P010', name: 'Test Patient 10' };
      const ruleResult = { rule_score: 12, rule_label: 'High', breakdown: ['High risk'] };
      
      const alert = await evaluateAndEmitAlert({
        io: mockIo,
        patient,
        ruleResult,
        message: '',
        timestamp: new Date().toISOString()
      });
      
      expect(alert).toBeTruthy();
      expect(alert.level).toBe('Priority');
      expect(alert.source).toBe('rules');
      expect(alert.reason).toContain('High risk score');
    });
    
    it('should create Normal alert for rule_score 4-9', async () => {
      const patient = { id: 'P011', name: 'Test Patient 11' };
      const ruleResult = { rule_score: 6, rule_label: 'Medium', breakdown: ['Moderate risk'] };
      
      const alert = await evaluateAndEmitAlert({
        io: mockIo,
        patient,
        ruleResult,
        message: '',
        timestamp: new Date().toISOString()
      });
      
      expect(alert).toBeTruthy();
      expect(alert.level).toBe('Normal');
      expect(alert.source).toBe('rules');
    });
  });
});



