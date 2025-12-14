const axios = require('axios');

class AIService {
  constructor() {
    // Paid APIs (optional)
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    
    // FREE APIs
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;
    this.cohereApiKey = process.env.COHERE_API_KEY;
  }

  // ============== FREE: GROQ API (Recommended - Very Fast!) ==============
  async analyzeWithGroq(extractedText, reportType) {
    try {
      const prompt = this.buildAnalysisPrompt(extractedText, reportType);

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.1-70b-versatile', // Free & powerful
          messages: [
            {
              role: 'system',
              content: 'You are a medical report analyzer. Analyze reports and provide structured JSON responses only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.3
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.groqApiKey}`
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      console.log('✅ Groq analysis successful');
      return this.parseAnalysisResponse(aiResponse);
    } catch (error) {
      console.error('Groq API Error:', error.response?.data || error.message);
      throw new Error('Groq analysis failed');
    }
  }

  // ============== FREE: Google Gemini API ==============
  async analyzeWithGemini(extractedText, reportType) {
    try {
      const prompt = this.buildAnalysisPrompt(extractedText, reportType);

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`,
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
      console.log('✅ Gemini analysis successful');
      return this.parseAnalysisResponse(aiResponse);
    } catch (error) {
      console.error('Gemini API Error:', error.response?.data || error.message);
      throw new Error('Gemini analysis failed');
    }
  }

  // ============== FREE: HuggingFace Inference API ==============
  async analyzeWithHuggingFace(extractedText, reportType) {
    try {
      const prompt = this.buildAnalysisPrompt(extractedText, reportType);

      const response = await axios.post(
        'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1',
        {
          inputs: prompt,
          parameters: {
            max_new_tokens: 2000,
            temperature: 0.3,
            return_full_text: false
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.huggingfaceApiKey}`
          }
        }
      );

      const aiResponse = response.data[0]?.generated_text || response.data;
      console.log('✅ HuggingFace analysis successful');
      return this.parseAnalysisResponse(aiResponse);
    } catch (error) {
      console.error('HuggingFace API Error:', error.response?.data || error.message);
      throw new Error('HuggingFace analysis failed');
    }
  }

  // ============== FREE: Cohere API ==============
  async analyzeWithCohere(extractedText, reportType) {
    try {
      const prompt = this.buildAnalysisPrompt(extractedText, reportType);

      const response = await axios.post(
        'https://api.cohere.ai/v1/generate',
        {
          model: 'command',
          prompt: prompt,
          max_tokens: 2000,
          temperature: 0.3
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.cohereApiKey}`
          }
        }
      );

      const aiResponse = response.data.generations[0].text;
      console.log('✅ Cohere analysis successful');
      return this.parseAnalysisResponse(aiResponse);
    } catch (error) {
      console.error('Cohere API Error:', error.response?.data || error.message);
      throw new Error('Cohere analysis failed');
    }
  }

  // ============== PAID: Claude API ==============
  async analyzeWithClaude(extractedText, reportType) {
    try {
      const prompt = this.buildAnalysisPrompt(extractedText, reportType);

      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-sonnet-20240229',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.anthropicApiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      const aiResponse = response.data.content[0].text;
      return this.parseAnalysisResponse(aiResponse);
    } catch (error) {
      console.error('Claude API Error:', error.response?.data || error.message);
      throw new Error('AI analysis failed');
    }
  }

  // ============== PAID: OpenAI API ==============
  async analyzeWithOpenAI(extractedText, reportType) {
    try {
      const prompt = this.buildAnalysisPrompt(extractedText, reportType);

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a medical report analyzer. Analyze the given medical report and provide structured insights.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.3
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.openaiApiKey}`
          }
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      return this.parseAnalysisResponse(aiResponse);
    } catch (error) {
      console.error('OpenAI API Error:', error.response?.data || error.message);
      throw new Error('AI analysis failed');
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
      console.error('Parse Error:', error.message);
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
  // Priority: Groq (free) -> Gemini (free) -> HuggingFace (free) -> Cohere (free) -> Claude (paid) -> OpenAI (paid) -> Mock
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

    // 1️⃣ Try Groq API first (FREE & FAST - Recommended!)
    if (this.groqApiKey && this.groqApiKey !== 'your_groq_api_key_here') {
      try {
        console.log('🤖 Analyzing with Groq API (FREE)...');
        return await this.analyzeWithGroq(extractedText, reportType);
      } catch (error) {
        console.log('⚠️ Groq API failed, trying next...');
      }
    }

    // 2️⃣ Try Google Gemini (FREE)
    if (this.geminiApiKey && this.geminiApiKey !== 'your_gemini_api_key_here') {
      try {
        console.log('🤖 Analyzing with Gemini API (FREE)...');
        return await this.analyzeWithGemini(extractedText, reportType);
      } catch (error) {
        console.log('⚠️ Gemini API failed, trying next...');
      }
    }

    // 3️⃣ Try HuggingFace (FREE)
    if (this.huggingfaceApiKey && this.huggingfaceApiKey !== 'your_huggingface_api_key_here') {
      try {
        console.log('🤖 Analyzing with HuggingFace API (FREE)...');
        return await this.analyzeWithHuggingFace(extractedText, reportType);
      } catch (error) {
        console.log('⚠️ HuggingFace API failed, trying next...');
      }
    }

    // 4️⃣ Try Cohere (FREE)
    if (this.cohereApiKey && this.cohereApiKey !== 'your_cohere_api_key_here') {
      try {
        console.log('🤖 Analyzing with Cohere API (FREE)...');
        return await this.analyzeWithCohere(extractedText, reportType);
      } catch (error) {
        console.log('⚠️ Cohere API failed, trying next...');
      }
    }

    // 5️⃣ Try Claude API (PAID)
    if (this.anthropicApiKey && this.anthropicApiKey !== 'your_anthropic_api_key_here') {
      try {
        console.log('🤖 Analyzing with Claude API (PAID)...');
        return await this.analyzeWithClaude(extractedText, reportType);
      } catch (error) {
        console.log('⚠️ Claude API failed, trying next...');
      }
    }

    // 6️⃣ Try OpenAI API (PAID)
    if (this.openaiApiKey && this.openaiApiKey !== 'your_openai_api_key_here') {
      try {
        console.log('🤖 Analyzing with OpenAI API (PAID)...');
        return await this.analyzeWithOpenAI(extractedText, reportType);
      } catch (error) {
        console.log('⚠️ OpenAI API failed, using mock...');
      }
    }

    // 7️⃣ Fallback to mock analysis for development
    console.log('🤖 Using mock analysis (no API keys configured)');
    return this.mockAnalysis(extractedText, reportType);
  }

  // Mock analysis for development/testing
  mockAnalysis(extractedText, reportType) {
    const text = extractedText.toLowerCase();
    
    // Simple keyword-based analysis
    const abnormalKeywords = ['high', 'low', 'abnormal', 'elevated', 'decreased', 'positive', 'negative'];
    const criticalKeywords = ['critical', 'urgent', 'immediate', 'severe', 'emergency'];
    
    let riskScore = 20;
    let riskLevel = 'low';
    const abnormalities = [];
    const keyFindings = [];

    // Check for abnormal values
    abnormalKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        riskScore += 10;
        keyFindings.push(`Detected "${keyword}" value in report`);
      }
    });

    // Check for critical values
    criticalKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        riskScore += 25;
        abnormalities.push(`Critical finding: "${keyword}" detected`);
      }
    });

    // Determine risk level
    if (riskScore >= 70) {
      riskLevel = 'high';
    } else if (riskScore >= 40) {
      riskLevel = 'medium';
    }

    // Cap risk score at 100
    riskScore = Math.min(riskScore, 100);

    return {
      summary: `${reportType} report analyzed. ${abnormalities.length > 0 ? 'Some abnormalities were detected that may require attention.' : 'Results appear to be within normal ranges.'}`,
      keyFindings: keyFindings.length > 0 ? keyFindings : ['Report processed successfully', 'Values extracted from document'],
      abnormalities: abnormalities,
      riskLevel: riskLevel,
      riskScore: riskScore,
      recommendations: [
        'Review the detailed findings with your healthcare provider',
        'Schedule a follow-up if recommended',
        riskLevel === 'high' ? 'Consider urgent consultation' : 'Maintain regular health checkups'
      ]
    };
  }

  // ============== CHATBOT QUERY HANDLER ==============
  async chatbotQuery(question, reportContext = null) {
    const prompt = this.buildChatbotPrompt(question, reportContext);

    // 1️⃣ Try Groq (FREE)
    if (this.groqApiKey && this.groqApiKey !== 'your_groq_api_key_here') {
      try {
        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.1-70b-versatile',
            messages: [
              { role: 'system', content: 'You are a helpful medical assistant. Provide clear, accurate health information. Always recommend consulting a healthcare provider for medical decisions.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.7
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.groqApiKey}`
            }
          }
        );
        return response.data.choices[0].message.content;
      } catch (error) {
        console.log('Groq chatbot failed, trying next...');
      }
    }

    // 2️⃣ Try Gemini (FREE)
    if (this.geminiApiKey && this.geminiApiKey !== 'your_gemini_api_key_here') {
      try {
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`,
          {
            contents: [{ 
              parts: [{ text: prompt }] 
            }],
            generationConfig: { 
              temperature: 0.7, 
              maxOutputTokens: 500 
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.data.candidates && response.data.candidates[0]?.content?.parts[0]?.text) {
          console.log('✅ Gemini chatbot successful');
          return response.data.candidates[0].content.parts[0].text;
        }
        throw new Error('Invalid Gemini response');
      } catch (error) {
        console.log('Gemini chatbot failed:', error.response?.data?.error?.message || error.message);
      }
    }

    // 3️⃣ Try Claude (PAID)
    if (this.anthropicApiKey && this.anthropicApiKey !== 'your_anthropic_api_key_here') {
      try {
        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-3-sonnet-20240229',
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }]
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.anthropicApiKey,
              'anthropic-version': '2023-06-01'
            }
          }
        );
        return response.data.content[0].text;
      } catch (error) {
        console.log('Claude chatbot failed');
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
    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('risk') || lowerQuestion.includes('danger')) {
      return reportContext
        ? `Based on your report, your risk level is ${reportContext.riskLevel}. ${reportContext.riskLevel === 'high' ? 'I recommend consulting your doctor soon.' : 'Continue monitoring and maintain regular checkups.'}`
        : 'Risk assessment requires reviewing your specific medical reports. Please upload a report for personalized analysis.';
    }

    if (lowerQuestion.includes('abnormal') || lowerQuestion.includes('problem')) {
      return reportContext?.abnormalities?.length > 0
        ? `Your report shows: ${reportContext.abnormalities.join(', ')}. Please discuss these findings with your healthcare provider.`
        : 'No significant abnormalities were detected in your report. However, always consult your doctor for a complete evaluation.';
    }

    if (lowerQuestion.includes('what') && lowerQuestion.includes('mean')) {
      return 'Medical reports contain various values and terms. I recommend discussing specific terms with your doctor who can explain them in the context of your overall health.';
    }

    return `Thank you for your question. ${reportContext ? 'Based on your report, ' + reportContext.summary : 'For personalized health advice, please consult with your healthcare provider.'} Remember, I can provide general information but cannot replace professional medical advice.`;
  }
}

module.exports = new AIService();