import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided for parsing.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3-flash-preview', // Or gemini-3-flash-preview depending on your SDK
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
      You are an elite HR data extraction AI. 
      I will provide you with the raw text of a redacted resume. 
      Your job is to parse this text and return a comprehensive, structured JSON object.
      
      STRICT RULES:
      1. DO NOT hallucinate, guess, or invent information.
      2. If a field or section is missing in the text, leave it as an empty string "" or empty array [].
      3. DO NOT ever write "REDACTED" or "[REDACTED]" in any field UNLESS you literally see that exact word in the source text.
      4. IGNORE all URLs, websites, portfolio links, and social media profiles.

      Expected JSON Structure:
      {
        "fullName": "The candidate's original full name. Leave empty if none is found.",
        "candidateId": "Generate a random 6-character alphanumeric ID",
        "contactInfo": {
          "email": "Email address (or [REDACTED_EMAIL] if masked)",
          "phone": "Phone number (or [REDACTED_PHONE] if masked)",
          "location": "City, State, or Country if mentioned"
        },
        "professionalSummary": "A brief summary of their profile. Leave empty if none exists.",
        "topSkills": ["skill1", "skill2", "skill3"],
        "experience": [
          {
            "role": "Job Title",
            "company": "Company Name. Leave empty if none.",
            "duration": "Time period",
            "location": "Location if mentioned",
            "bulletPoints": ["point 1", "point 2"]
          }
        ],
        "projects": [
          {
            "name": "Project Name",
            "role": "Role in the project (e.g., Lead Developer, Creator)",
            "technologies": ["tech1", "tech2"],
            "duration": "Time period if mentioned",
            "bulletPoints": ["point 1", "point 2"]
          }
        ],
        "education": [
          {
            "degree": "Degree Name",
            "institution": "School Name",
            "year": "Graduation Year or Duration"
          }
        ],
        "certifications": [
          {
            "name": "Certification Name",
            "issuer": "Issuing Organization",
            "year": "Year obtained"
          }
        ],
        "additionalSections": [
          {
            "title": "Name of the section",
            "content": ["Bullet point or item 1", "Bullet point or item 2"]
          }
        ]
      }

      Raw Resume Text to Parse:
      ${text}
    `;

    const result = await model.generateContent(prompt);
    const structuredData = JSON.parse(result.response.text());

    return NextResponse.json({ success: true, data: structuredData });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to parse resume with AI.' }, { status: 500 });
  }
}