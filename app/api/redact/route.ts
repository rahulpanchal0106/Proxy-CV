import { NextRequest, NextResponse } from 'next/server';
import PDFParser from 'pdf2json';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('resume') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Wrap the event-based pdf2json in a clean Promise
    const extractedText = await new Promise<string>((resolve, reject) => {
      // The '1' tells it to parse raw text only (much faster, skips UI rendering)
      const pdfParser = new PDFParser(null, true); 

      pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
      pdfParser.on("pdfParser_dataReady", () => {
        resolve(pdfParser.getRawTextContent());
      });

      pdfParser.parseBuffer(buffer);
    });

    let processedText = extractedText;

    // Redact Emails
    // const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    // processedText = processedText.replace(emailRegex, '[REDACTED_EMAIL]');

    // Redact Phone Numbers
    // const phoneRegex = /(\+?\d{1,2}\s?)?(\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/g;
    // processedText = processedText.replace(phoneRegex, '[REDACTED_PHONE]');

    return NextResponse.json({
      success: true,
      data: {
        redactedText: processedText,
      }
    });

  } catch (error: any) {
    console.error('Red-Actor Engine Error:', error);
    return NextResponse.json(
      { error: 'Failed to process the PDF. Check server logs.' }, 
      { status: 500 }
    );
  }
}