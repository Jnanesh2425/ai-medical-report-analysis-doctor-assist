const axios = require('axios');

class AIService {
  constructor() {
    // Google Gemini API
    this.geminiApiKey = process.env.GEMINI_API_KEY;
  }

  // ============== Google Gemini Flash API ==============
  async analyzeWithGemini(extractedText, reportType) {
    try {
      const prompt = this.buildAnalysisPrompt(extractedText, reportType);

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const aiResponse = response.data.candidates[0].content.parts[0].text;
      return this.parseAnalysisResponse(aiResponse);
    } catch (error) {
      console.error('Gemini API Error:', error.response?.data || error.message);
      throw new Error('Gemini analysis failed');
    }
  }

  // Build the analysis prompt
  buildAnalysisPrompt(extractedText, reportType) {
    return `
Analyze the following ${reportType} medical report and provide a structured analysis.

MEDICAL REPORT TEXT:
${extractedText}

Please provide your analysis in the following JSON format:
{
  "summary": "A clear, concise summary of the report in 2-3 sentences",
  "keyFindings": ["Finding 1", "Finding 2", "Finding 3"],
  "abnormalities": ["Abnormality 1", "Abnormality 2"],
  "riskLevel": "low/medium/high",
  "riskScore": 0-100,
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}

Guidelines:
- riskLevel should be "high" if there are critical abnormalities or urgent findings
- riskLevel should be "medium" if there are moderate concerns
- riskLevel should be "low" if results are mostly normal
- riskScore should reflect the overall health concern (0 = no concern, 100 = critical)
- Be specific about abnormalities, mentioning exact values if available
- Recommendations should be actionable

Respond ONLY with the JSON object, no additional text.
`;
  }

  // Parse the AI response
  parseAnalysisResponse(response) {
    try {
      // Handle if response is already an object
      if (typeof response === 'object' && response !== null) {
        return {
          summary: response.summary || 'Analysis completed',
          keyFindings: response.keyFindings || [],
          abnormalities: response.abnormalities || [],
          riskLevel: response.riskLevel || 'low',
          riskScore: response.riskScore || 0,
          recommendations: response.recommendations || []
        };
      }

      // Try to extract JSON from string response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'Analysis completed',
          keyFindings: parsed.keyFindings || [],
          abnormalities: parsed.abnormalities || [],
          riskLevel: parsed.riskLevel || 'low',
          riskScore: parsed.riskScore || 0,
          recommendations: parsed.recommendations || []
        };
      }
      throw new Error('Could not parse AI response');
    } catch (error) {
      // Return default values if parsing fails
      return {
        summary: 'Report analyzed. Please review the extracted text for details.',
        keyFindings: ['Report processed successfully'],
        abnormalities: [],
        riskLevel: 'low',
        riskScore: 20,
        recommendations: ['Consult with your healthcare provider for detailed analysis']
      };
    }
  }

  // ============== MAIN ANALYSIS METHOD ==============
  async analyzeReport(extractedText, reportType) {
    // If no text extracted, return basic analysis
    if (!extractedText || extractedText.trim().length < 50) {
      return {
        summary: 'Unable to extract sufficient text from the report. Please ensure the document is clear and readable.',
        keyFindings: ['Text extraction was limited'],
        abnormalities: [],
        riskLevel: 'low',
        riskScore: 10,
        recommendations: ['Upload a clearer document or manually enter report details']
      };
    }

    // Try Google Gemini API
    if (this.geminiApiKey && this.geminiApiKey !== 'your_gemini_api_key_here') {
      try {
        return await this.analyzeWithGemini(extractedText, reportType);
      } catch (error) {
        // Fall through to mock analysis
      }
    }

    // Fallback to mock analysis
    return this.mockAnalysis(extractedText, reportType);
  }

  // Mock analysis for development/testing - Extracts real data from report
  mockAnalysis(extractedText, reportType) {
    const text = extractedText.toLowerCase();
    const originalText = extractedText;
    
    // Keywords for analysis
    const abnormalKeywords = ['high', 'low', 'abnormal', 'elevated', 'decreased', 'positive', 'negative', 'irregular'];
    const criticalKeywords = ['critical', 'urgent', 'immediate', 'severe', 'emergency', 'danger'];
    
    let riskScore = 20;
    let riskLevel = 'low';
    const abnormalities = [];
    const keyFindings = [];

    // Extract common medical values using regex patterns
    const patterns = [
      { name: 'Hemoglobin', pattern: /hemoglobin[:\s]*(\d+\.?\d*)\s*(g\/dl|gm\/dl)?/i },
      { name: 'Blood Pressure', pattern: /(?:bp|blood pressure)[:\s]*(\d+\/\d+)\s*(mmhg)?/i },
      { name: 'Glucose/Sugar', pattern: /(?:glucose|sugar|fbs|rbs)[:\s]*(\d+\.?\d*)\s*(mg\/dl)?/i },
      { name: 'Cholesterol', pattern: /cholesterol[:\s]*(\d+\.?\d*)\s*(mg\/dl)?/i },
      { name: 'Creatinine', pattern: /creatinine[:\s]*(\d+\.?\d*)\s*(mg\/dl)?/i },
      { name: 'WBC Count', pattern: /(?:wbc|white blood cells?)[:\s]*(\d+\.?\d*)/i },
      { name: 'RBC Count', pattern: /(?:rbc|red blood cells?)[:\s]*(\d+\.?\d*)/i },
      { name: 'Platelet Count', pattern: /platelet[s]?[:\s]*(\d+\.?\d*)/i },
      { name: 'Temperature', pattern: /(?:temp|temperature)[:\s]*(\d+\.?\d*)\s*(°?[fc])?/i },
      { name: 'Heart Rate', pattern: /(?:heart rate|pulse|hr)[:\s]*(\d+)\s*(bpm)?/i },
      { name: 'SpO2/Oxygen', pattern: /(?:spo2|oxygen saturation|o2)[:\s]*(\d+\.?\d*)\s*%?/i },
      { name: 'BMI', pattern: /bmi[:\s]*(\d+\.?\d*)/i },
      { name: 'Urea', pattern: /urea[:\s]*(\d+\.?\d*)/i },
      { name: 'Bilirubin', pattern: /bilirubin[:\s]*(\d+\.?\d*)/i },
      { name: 'Albumin', pattern: /albumin[:\s]*(\d+\.?\d*)/i },
      { name: 'TSH', pattern: /tsh[:\s]*(\d+\.?\d*)/i },
      { name: 'HbA1c', pattern: /hba1c[:\s]*(\d+\.?\d*)\s*%?/i },
    ];

    // Extract values from text
    patterns.forEach(({ name, pattern }) => {
      const match = originalText.match(pattern);
      if (match) {
        keyFindings.push(`${name}: ${match[1]}${match[2] ? ' ' + match[2] : ''}`);
      }
    });

    // Extract lines with numbers (potential test results)
    const lines = originalText.split('\n');
    lines.forEach(line => {
      // Match lines that look like test results (name: value or name value unit)
      const resultPattern = /^([A-Za-z\s]+)[:\-\s]+(\d+\.?\d*)\s*([A-Za-z\/%]+)?$/;
      const match = line.trim().match(resultPattern);
      if (match && match[1].length > 2 && match[1].length < 30) {
        const finding = `${match[1].trim()}: ${match[2]}${match[3] ? ' ' + match[3] : ''}`;
        if (!keyFindings.includes(finding) && keyFindings.length < 15) {
          keyFindings.push(finding);
        }
      }
    });

    // Check for abnormal values in text
    abnormalKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        riskScore += 10;
        // Try to find context around the keyword
        const regex = new RegExp(`[^.]*${keyword}[^.]*`, 'gi');
        const matches = originalText.match(regex);
        if (matches && matches.length > 0) {
          const finding = matches[0].trim().substring(0, 100);
          if (!abnormalities.includes(finding)) {
            abnormalities.push(finding);
          }
        }
      }
    });

    // Check for critical values
    criticalKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        riskScore += 25;
        const regex = new RegExp(`[^.]*${keyword}[^.]*`, 'gi');
        const matches = originalText.match(regex);
        if (matches && matches.length > 0) {
          abnormalities.push(`⚠️ ${matches[0].trim().substring(0, 100)}`);
        }
      }
    });

    // Extract patient info if available
    const patientNameMatch = originalText.match(/(?:patient|name)[:\s]*([A-Za-z\s]+)/i);
    const dateMatch = originalText.match(/(?:date|collected)[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
    
    if (patientNameMatch) {
      keyFindings.unshift(`Patient: ${patientNameMatch[1].trim()}`);
    }
    if (dateMatch) {
      keyFindings.unshift(`Report Date: ${dateMatch[1]}`);
    }

    // Determine risk level
    if (riskScore >= 70) {
      riskLevel = 'high';
    } else if (riskScore >= 40) {
      riskLevel = 'medium';
    }

    // Cap risk score at 100
    riskScore = Math.min(riskScore, 100);

    // Generate summary
    const summaryParts = [];
    if (reportType) summaryParts.push(`${reportType} report analyzed.`);
    if (keyFindings.length > 0) summaryParts.push(`Found ${keyFindings.length} key values.`);
    if (abnormalities.length > 0) {
      summaryParts.push(`${abnormalities.length} potential abnormalities detected that may require attention.`);
    } else {
      summaryParts.push('No critical abnormalities detected.');
    }

    return {
      summary: summaryParts.join(' '),
      keyFindings: keyFindings.length > 0 ? keyFindings : ['Report text extracted', 'No specific numeric values detected - please review manually'],
      abnormalities: abnormalities.length > 0 ? abnormalities : [],
      riskLevel: riskLevel,
      riskScore: riskScore,
      recommendations: [
        'Review these findings with your healthcare provider',
        'Keep track of any changes in your values over time',
        riskLevel === 'high' ? '⚠️ Consider urgent consultation due to detected abnormalities' : 'Maintain regular health checkups',
        'Bring this report to your next doctor visit'
      ]
    };
  }

  // ============== CHATBOT QUERY HANDLER ==============
  async chatbotQuery(question, reportContext = null) {
    const prompt = this.buildChatbotPrompt(question, reportContext);

    // Try Gemini API
    if (this.geminiApiKey && this.geminiApiKey !== 'your_gemini_api_key_here') {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`,
          {
            contents: [{ 
              parts: [{ text: prompt }] 
            }],
            generationConfig: { 
              temperature: 0.7, 
              maxOutputTokens: 500 
            }
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.data.candidates && response.data.candidates[0]?.content?.parts[0]?.text) {
          return response.data.candidates[0].content.parts[0].text;
        }
        throw new Error('Invalid Gemini response');
      } catch (error) {
        // Fall through to mock response
      }
    }

    // Fallback to mock response
    return this.getMockChatResponse(question, reportContext);
  }

  buildChatbotPrompt(question, reportContext) {
    if (reportContext) {
      return `Based on this medical report:
Summary: "${reportContext.summary}"
Key findings: ${reportContext.keyFindings?.join(', ') || 'None'}
Abnormalities: ${reportContext.abnormalities?.join(', ') || 'None'}
Risk Level: ${reportContext.riskLevel || 'Unknown'}

Patient question: ${question}

Provide a helpful, clear response. Remember to advise consulting a healthcare provider for medical decisions.`;
    }
    
    return `Patient health question: ${question}

Provide a helpful, general health information response. Always recommend consulting a healthcare provider for specific medical advice.`;
  }

  getMockChatResponse(question, reportContext) {
    const q = question.toLowerCase().trim();

    // Greetings
    if (q.match(/^(hi|hello|hey|good morning|good afternoon|good evening|howdy)[\s!.?]*$/i)) {
      return "Hello! 👋 I'm your AI Medical Assistant. How can I help you today? You can ask me about:\n\n• Your uploaded medical reports\n• General health questions\n• Post-operative care tips\n• Medication information\n• When to see a doctor\n\nHow may I assist you?";
    }

    if (q.match(/^(how are you|how do you do|what's up|whats up)[\s!.?]*$/i)) {
      return "I'm doing great, thank you for asking! 😊 I'm here to help you with your health-related questions. What would you like to know?";
    }

    if (q.match(/^(thank|thanks|thank you|thx)[\s!.?]*$/i)) {
      return "You're welcome! 😊 If you have any more questions about your health or reports, feel free to ask. Take care!";
    }

    if (q.match(/^(bye|goodbye|see you|take care)[\s!.?]*$/i)) {
      return "Goodbye! 👋 Take care of your health. Remember to follow your doctor's advice and don't hesitate to reach out if you have more questions. Stay healthy!";
    }

    // About the bot
    if (q.includes('who are you') || q.includes('what are you') || q.includes('your name')) {
      return "I'm an AI Medical Assistant designed to help you understand your medical reports and answer health-related questions. I can:\n\n✅ Analyze your uploaded medical reports\n✅ Explain medical terms\n✅ Provide general health information\n✅ Guide you on post-operative care\n\n⚠️ Note: I provide general information only. Always consult your doctor for medical decisions.";
    }

    // What can you do
    if (q.includes('what can you do') || q.includes('help me') || q.includes('how can you help')) {
      return "I can help you with:\n\n📋 **Report Analysis** - Upload your medical reports and I'll help explain the findings\n\n💊 **Medication Info** - General information about common medications\n\n🏥 **Post-Surgery Care** - Tips for recovery after surgery\n\n⚠️ **Warning Signs** - When you should see a doctor\n\n❓ **Health Questions** - General health and wellness information\n\nWhat would you like to know?";
    }

    // Common health questions
    if (q.includes('headache') || q.includes('head pain')) {
      return "**Headaches** can have many causes:\n\n**Common causes:**\n• Stress or tension\n• Dehydration\n• Lack of sleep\n• Eye strain\n• Skipping meals\n\n**When to see a doctor:**\n• Severe or sudden headache\n• Headache with fever, stiff neck\n• Headache after head injury\n• Recurring headaches\n\n**Quick relief tips:**\n• Rest in a dark, quiet room\n• Stay hydrated\n• Apply cold compress\n• Take over-the-counter pain relief if needed\n\n⚠️ If headaches persist, please consult your doctor.";
    }

    if (q.includes('fever') || q.includes('temperature')) {
      return "**Fever Information:**\n\n**Normal temperature:** 97°F - 99°F (36.1°C - 37.2°C)\n**Fever:** 100.4°F (38°C) or higher\n\n**When to see a doctor:**\n• Fever above 103°F (39.4°C)\n• Fever lasting more than 3 days\n• Fever with severe headache or rash\n• Difficulty breathing\n\n**Home care:**\n• Rest and stay hydrated\n• Take acetaminophen or ibuprofen\n• Use light clothing and blankets\n• Lukewarm bath may help\n\n⚠️ Seek immediate care for high fever with confusion or seizures.";
    }

    if (q.includes('blood pressure') || q.includes('bp')) {
      return "**Blood Pressure Guide:**\n\n📊 **Categories:**\n• Normal: Less than 120/80 mmHg\n• Elevated: 120-129 / less than 80\n• High (Stage 1): 130-139 / 80-89\n• High (Stage 2): 140+ / 90+\n• Crisis: Higher than 180/120\n\n**Tips to maintain healthy BP:**\n• Reduce salt intake\n• Exercise regularly\n• Maintain healthy weight\n• Limit alcohol\n• Manage stress\n• Take medications as prescribed\n\n⚠️ If your BP is very high, consult your doctor immediately.";
    }

    if (q.includes('diabetes') || q.includes('sugar') || q.includes('glucose')) {
      return "**Blood Sugar Information:**\n\n📊 **Normal Ranges:**\n• Fasting: 70-100 mg/dL\n• After meals (2hrs): Less than 140 mg/dL\n• HbA1c: Less than 5.7%\n\n**Diabetes indicators:**\n• Fasting: 126 mg/dL or higher\n• HbA1c: 6.5% or higher\n\n**Management tips:**\n• Monitor blood sugar regularly\n• Follow a balanced diet\n• Exercise regularly\n• Take medications as prescribed\n• Regular check-ups\n\n⚠️ Please work with your doctor for personalized diabetes management.";
    }

    if (q.includes('cholesterol')) {
      return "**Cholesterol Guide:**\n\n📊 **Healthy Levels:**\n• Total: Less than 200 mg/dL\n• LDL (bad): Less than 100 mg/dL\n• HDL (good): 60 mg/dL or higher\n• Triglycerides: Less than 150 mg/dL\n\n**Tips to lower cholesterol:**\n• Eat heart-healthy foods\n• Reduce saturated fats\n• Exercise regularly\n• Quit smoking\n• Limit alcohol\n• Maintain healthy weight\n\n⚠️ High cholesterol often has no symptoms. Regular testing is important.";
    }

    if (q.includes('after surgery') || q.includes('post surgery') || q.includes('post-operative') || q.includes('recovery')) {
      return "**Post-Surgery Care Tips:**\n\n✅ **Do's:**\n• Follow your doctor's instructions\n• Take medications on time\n• Keep wounds clean and dry\n• Rest adequately\n• Eat nutritious food\n• Stay hydrated\n• Attend follow-up appointments\n\n❌ **Don'ts:**\n• Don't skip medications\n• Avoid strenuous activities\n• Don't ignore warning signs\n• Avoid smoking and alcohol\n\n⚠️ **Contact your doctor if:**\n• Fever above 101°F\n• Increased pain or swelling\n• Wound redness or discharge\n• Difficulty breathing";
    }

    if (q.includes('pain') || q.includes('hurt')) {
      return "**Pain Management Tips:**\n\n**General advice:**\n• Take prescribed pain medications on schedule\n• Use ice/heat therapy as recommended\n• Rest the affected area\n• Gentle movement when advised\n\n**When to seek help:**\n• Severe or worsening pain\n• Pain with fever\n• Pain preventing sleep\n• Pain not relieved by medication\n\n⚠️ Never exceed recommended medication doses. Contact your doctor if pain persists.";
    }

    if (q.includes('sleep') || q.includes('insomnia')) {
      return "**Sleep Tips:**\n\n😴 **For better sleep:**\n• Maintain regular sleep schedule\n• Create a dark, quiet environment\n• Avoid screens before bed\n• Limit caffeine after noon\n• Exercise (but not before bed)\n• Avoid heavy meals at night\n\n**When to see a doctor:**\n• Persistent insomnia\n• Loud snoring or gasping\n• Excessive daytime sleepiness\n\nAdults need 7-9 hours of sleep per night.";
    }

    if (q.includes('diet') || q.includes('food') || q.includes('eat') || q.includes('nutrition')) {
      return "**Healthy Eating Tips:**\n\n🥗 **Balanced diet includes:**\n• Plenty of fruits and vegetables\n• Whole grains\n• Lean proteins\n• Limited salt and sugar\n• Healthy fats\n• Adequate water (8 glasses/day)\n\n**After surgery:**\n• Start with light foods\n• Avoid spicy and oily foods\n• Eat small, frequent meals\n• Include protein for healing\n\n⚠️ Follow any specific dietary instructions from your doctor.";
    }

    if (q.includes('medicine') || q.includes('medication') || q.includes('drug')) {
      return "**Medication Safety Tips:**\n\n💊 **Important reminders:**\n• Take medications as prescribed\n• Don't skip doses\n• Complete the full course\n• Store properly\n• Check expiry dates\n\n**Before taking any medicine:**\n• Inform doctor of allergies\n• Mention other medications\n• Ask about side effects\n• Understand food interactions\n\n⚠️ Never stop prescribed medications without consulting your doctor.";
    }

    if (q.includes('emergency') || q.includes('urgent') || q.includes('when to call') || q.includes('warning sign')) {
      return "**⚠️ Seek Emergency Care If:**\n\n🚨 **Call emergency services for:**\n• Chest pain or difficulty breathing\n• Sudden severe headache\n• Signs of stroke (face drooping, arm weakness, speech difficulty)\n• Severe bleeding\n• Loss of consciousness\n• Severe allergic reaction\n• High fever with confusion\n\n📞 **Contact your doctor for:**\n• Fever lasting more than 3 days\n• Persistent vomiting\n• Wound infections\n• Unusual symptoms\n\nWhen in doubt, always seek medical help!";
    }

    // Report-specific responses
    if (reportContext) {
      if (q.includes('risk') || q.includes('danger') || q.includes('serious')) {
        const riskLevel = reportContext.riskLevel || 'unknown';
        if (riskLevel === 'high') {
          return `⚠️ Based on your report, your risk level is **HIGH**.\n\n**Findings:**\n${reportContext.abnormalities?.join('\n') || 'See report details'}\n\n**Recommendation:** Please consult your doctor as soon as possible to discuss these findings.`;
        } else if (riskLevel === 'medium') {
          return `Based on your report, your risk level is **MEDIUM**.\n\nSome values may need attention. Please discuss the findings with your doctor at your next visit.`;
        } else {
          return `Based on your report, your risk level is **LOW**. ✅\n\nYour results appear to be within normal ranges. Continue maintaining a healthy lifestyle and regular checkups.`;
        }
      }

      if (q.includes('result') || q.includes('finding') || q.includes('report')) {
        return `📋 **Your Report Summary:**\n\n${reportContext.summary || 'Report analyzed'}\n\n**Key Findings:**\n${reportContext.keyFindings?.map(f => '• ' + f).join('\n') || '• No specific findings'}\n\n${reportContext.abnormalities?.length > 0 ? '**Abnormalities:**\n' + reportContext.abnormalities.map(a => '⚠️ ' + a).join('\n') : '✅ No critical abnormalities detected'}\n\nPlease discuss these results with your doctor.`;
      }

      if (q.includes('abnormal') || q.includes('problem') || q.includes('wrong')) {
        if (reportContext.abnormalities?.length > 0) {
          return `⚠️ **Abnormalities Found:**\n\n${reportContext.abnormalities.map(a => '• ' + a).join('\n')}\n\nPlease consult your healthcare provider to discuss these findings and determine if any action is needed.`;
        } else {
          return "✅ Good news! No significant abnormalities were detected in your report. Continue with regular health checkups and maintain a healthy lifestyle.";
        }
      }
    }

    // Default response for unrecognized questions
    return `Thank you for your question about "${question.substring(0, 50)}${question.length > 50 ? '...' : ''}".\n\nI can help you with:\n• Understanding your medical reports\n• General health information\n• Post-surgery care tips\n• When to see a doctor\n\n${reportContext ? 'I see you have a report uploaded. You can ask me about your specific results!' : 'Try uploading a medical report for personalized analysis.'}\n\n⚠️ Remember: For specific medical advice, please consult your healthcare provider.`;
  }
}

module.exports = new AIService();