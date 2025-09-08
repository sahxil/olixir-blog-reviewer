// pages/api/review-document.js
import { GoogleGenerativeAI } from "@google/generative-ai";

// Rate limiting for free tier
const RATE_LIMIT = 15; // 2 requests per minute
const requestCounts = new Map();

const REVIEW_INSTRUCTIONS = `
ROLE & CONTEXT

You are a Senior Business Analyst and Content Review Specialist for Olixir Oil, a premium edible oils brand in India. You specialize in reviewing marketing content, blog posts, product descriptions, and website copy for regulatory compliance, accuracy, and user experience.

COMPANY BACKGROUND

Olixir Oil: Premium edible oils brand using traditional wood-pressed extraction
Primary Products: Groundnut oil (90% sales), Coconut, Sesame, Castor, Mustard oils
Market: Indian B2C consumers primarily, with future international expansion plans
Positioning: Premium, traditional, natural, wood-pressed oils
Packaging: Plastic containers (NOT glass bottles)

YOUR REVIEW CRITERIA

1. PROOFREADING & LANGUAGE
Grammar, spelling, and punctuation errors
Sentence structure and flow issues
Tone consistency and readability
Professional language appropriate for Indian consumers

2. UNSUBSTANTIATED CLAIMS (CRITICAL)
Flag any claims that lack evidence or proof:
- Medical or therapeutic claims (cures, treats, prevents diseases)
- Absolute statements without qualifiers ("always works", "guaranteed results")
- Specific health benefits without clinical backing
- Cosmetic claims that sound medical
- Nutritional claims without supporting data
- Time-specific promises ("results in 7 days") without studies

Examples of problematic claims:
- "Fights cancer" / "Prevents heart disease"
- "Cures acne" / "Eliminates dandruff"
- "Boosts collagen production"
- "100% effective for all skin types"
- "Clinically proven" (without actual studies)

3. USER EXPERIENCE ISSUES
Confusing transitions between topics
Information overload or overwhelming content
Missing usage instructions or safety information
Inconsistent tone (switching between casual and technical)
Poor content structure or flow
Unclear target audience messaging
Missing disclaimers where needed

4. PACKAGING CONTRADICTION CHECK
CRITICAL: Flag any mention that suggests glass packaging or glass superiority:
- Direct mentions of "glass bottles" or "glass containers"
- Indirect suggestions that product comes in glass
- Statements like "best stored in glass" or "glass preserves quality better"
- Comparisons favoring glass over plastic packaging
- Any implication that premium oils require glass packaging

NOTE: General purity language ("pure oil", "quality sourcing") is acceptable and NOT a packaging issue.

OUTPUT FORMAT

Provide your analysis in this exact structure:

PROOFREADING CORRECTIONS
List specific grammar, spelling, and flow issues with line references

UNSUBSTANTIATED CLAIMS (HIGH PRIORITY)
Quote exact problematic claims
Explain why each claim needs evidence
Suggest alternative, compliant language

USER EXPERIENCE ISSUES
Identify confusing sections or poor flow
Note missing information or unclear instructions
Suggest structural improvements

PACKAGING CONTRADICTION CHECK
✅ CLEAR: No glass-related issues found
OR
⚠️ ISSUES FOUND: List specific glass-related mentions to remove

REGULATORY RISK ASSESSMENT
Rate risk level: LOW/MEDIUM/HIGH
Identify most problematic claims for Indian market compliance
Suggest immediate fixes for high-risk content

IMPROVEMENT RECOMMENDATIONS
3-5 specific, actionable suggestions
Focus on maintaining premium brand positioning
Ensure content works for Indian consumer expectations

IMPORTANT GUIDELINES
- Be thorough but concise in your analysis
- Focus on business impact and compliance risks
- Maintain Olixir's premium brand positioning in suggestions
- Consider Indian consumer preferences and language patterns
- Prioritize issues by business risk level
- Don't suggest changes that would make content boring or generic

EXAMPLE REVIEW SNIPPET:
### UNSUBSTANTIATED CLAIMS (HIGH PRIORITY)
- "Eliminates dandruff completely" - Medical claim requiring clinical evidence  
  SUGGEST: "May help reduce dandruff flakes when used regularly"
- "100% effective for all skin types" - Absolute claim impossible to prove    
  SUGGEST: "Suitable for most skin types, patch test recommended"

NOTE: I do not need you to provide a 'corrected' draft. Only analysis and recommendations.
`;

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = requestCounts.get(ip) || [];
  const recentRequests = userRequests.filter(time => now - time < 60000); // 1 minute
  
  if (recentRequests.length >= RATE_LIMIT) return false;
  
  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  return true;
}

function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         'localhost';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests'
    });
  }

  const clientIP = getClientIP(req);
  
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait 1 minute before trying again.',
      retryAfter: 60
    });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'Configuration error',
        message: 'API key not configured. Please check server settings.'
      });
    }

    const { content, filename } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Invalid input',
        message: 'Document content is required and cannot be empty'
      });
    }

    if (content.length > 5000000) {
      return res.status(400).json({
        error: 'Document too large',
        message: 'Document must be less than 5MB. Please split into smaller sections.'
      });
    }

    console.log('Processing document:', filename, 'Length:', content.length);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
    });

    const fullPrompt = `${REVIEW_INSTRUCTIONS}

**DOCUMENT TO ANALYZE:**
**Filename:** ${filename || 'document.txt'}

**Content:**
${content}

**Instructions:** Please provide a thorough analysis following the exact format specified above.`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const analysisText = response.text();

    // Parse response sections
    const sections = {
      riskLevel: 'MEDIUM',
      correctedDocument: '',
      packaging: 'No packaging issues found'
    };

    try {
      // Extract risk level
      const riskMatch = analysisText.match(/Risk Level:\s*(HIGH|MEDIUM|LOW)/i);
      if (riskMatch) {
        sections.riskLevel = riskMatch[1].toUpperCase();
      }

      // Extract corrected document
      sections.correctedDocument = '';

      // Extract packaging check
      const packagingMatch = analysisText.match(/### PACKAGING CONTRADICTION CHECK\s*(.*?)(?=###|$)/s);
      if (packagingMatch) {
        sections.packaging = packagingMatch[1].trim();
      }

    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      if (!sections.correctedDocument) {
        sections.correctedDocument = analysisText;
      }
    }

    console.log('Analysis completed successfully');

    res.status(200).json({
      success: true,
      filename: filename || 'document.txt',
      analysis: analysisText,
      sections: sections,
      timestamp: new Date().toISOString(),
      usage: {
        charactersProcessed: content.length,
        requestsRemaining: Math.max(0, RATE_LIMIT - (requestCounts.get(clientIP)?.length || 0))
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    
    // Handle specific Gemini API errors
    if (error.message?.includes('API key') || error.message?.includes('authentication')) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Invalid API key. Please check your configuration.'
      });
    }
    
    if (error.message?.includes('quota') || error.message?.includes('limit')) {
      return res.status(429).json({ 
        error: 'Daily quota exceeded',
        message: 'Free tier limit reached for today. Please try again tomorrow.',
        retryAfter: 86400
      });
    }

    if (error.message?.includes('timeout')) {
      return res.status(408).json({
        error: 'Request timeout',
        message: 'Document processing took too long. Please try with a smaller document.'
      });
    }

    return res.status(500).json({ 
      error: 'Processing failed',
      message: 'An error occurred while processing your document. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}