"use client";

import React, { useState, useRef, useEffect } from "react";
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import RedactedResumePDF from "./redactedResumePDF";
import { useLocalAI } from "react-brai";

export default function Dropzone() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showOriginalName, setShowOriginalName] = useState(false);

  const [useCloudAI, setUseCloudAI] = useState(true);

  const [sections, setSections] = useState({
    name: true,
    contact: true,
    location: true,
    summary: true,
    skills: true,
    experience: true,
    projects: true,
    education: true,
    certifications: true,
    additional: true,
  });

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  // --- INITIALIZE REACT-BRAI ---
  const { loadModel, chat, isReady, isLoading, response } = useLocalAI();

  // Load the model into VRAM via the Leader tab when switched to Local AI
  useEffect(() => {
    if (!useCloudAI && !isReady) {
      loadModel("Llama-3.2-1B-Instruct-q4f16_1-MLC"); // Or your preferred model
    }
  }, [useCloudAI, isReady, loadModel]);

  // --- REACT-BRAI EVENT LISTENER ---
  // Listen for the local WebGPU worker to finish streaming the response
  useEffect(() => {
    // If we are actively processing a local job, and the engine just finished loading...
    if (isProcessing && !useCloudAI && !isLoading && response) {
      try {
        const cleanJsonString = response.replace(/```json\n?|```/g, "").trim();
        const localParsedData = JSON.parse(cleanJsonString);
        setParsedData(localParsedData);
        setShowPreview(true);
      } catch (err: any) {
        console.error("react-brai parsing error:", err);
        setError("Local AI failed to format JSON. Try again.");
      } finally {
        setIsProcessing(false);
        setStatusMsg("");
      }
    }
  }, [isLoading, response, isProcessing, useCloudAI]);

  const processResumePipeline = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setIsProcessing(true);
    setError(null);
    setParsedData(null);
    setShowOriginalName(false);

    try {
      setStatusMsg("Stripping PII & extracting text...");
      const formData = new FormData();
      formData.append("resume", uploadedFile);

      const redactRes = await fetch("/api/redact", {
        method: "POST",
        body: formData,
      });
      const redactResult = await redactRes.json();
      if (!redactRes.ok)
        throw new Error(redactResult.error || "Failed to extract text.");

      const extractedText = redactResult.data.redactedText;

      if (useCloudAI) {
        // --- CLOUD INFERENCE ---
        setStatusMsg("Cloud Engine: Analyzing profile...");
        const parseRes = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: extractedText }),
        });
        const parseResult = await parseRes.json();
        if (!parseRes.ok)
          throw new Error(
            parseResult.error || "Failed to parse with Cloud AI.",
          );

        setParsedData(parseResult.data);
        setShowPreview(true);
        setIsProcessing(false);
        setStatusMsg("");
      } else {
        // --- LOCAL INFERENCE (react-brai) ---
        setStatusMsg("Local Engine: Queuing job to Swarm...");

        const prompt = `
          You are an elite HR data extraction AI. 
          Parse this text and return ONLY a structured JSON object. DO NOT include markdown formatting.
          
          Expected JSON Structure:
          {
            "fullName": "Name or empty", "candidateId": "Random 6-char ID",
            "contactInfo": { "email": "Email", "phone": "Phone", "location": "Location" },
            "professionalSummary": "Summary", "topSkills": ["skill"],
            "experience": [{"role": "Role", "company": "Company", "duration": "Duration", "location": "Location", "bulletPoints": ["point"]}],
            "projects": [{"name": "Name", "role": "Role", "technologies": ["tech"], "duration": "Duration", "bulletPoints": ["point"]}],
            "education": [{"degree": "Degree", "institution": "School", "year": "Year"}],
            "certifications": [{"name": "Name", "issuer": "Issuer", "year": "Year"}],
            "additionalSections": [{"title": "Title", "content": ["point"]}]
          }
          Raw Resume Text: ${extractedText}
        `;

        // Push the job to the Swarm queue.
        // We do NOT set isProcessing(false) here. The useEffect above handles completion.
        chat([{ role: "user", content: prompt }]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to process resume.");
      setIsProcessing(false);
      setStatusMsg("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0)
      processResumePipeline(e.target.files[0]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files[0].type === "application/pdf") {
        processResumePipeline(e.dataTransfer.files[0]);
      } else {
        setError("Please upload a valid PDF file.");
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) =>
    e.preventDefault();
  const handleToggle = (key: keyof typeof sections) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="w-full max-w-4xl mx-auto p-6 relative">
      {/* --- ENGINE TOGGLE --- */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 p-1 rounded-full inline-flex shadow-inner border border-gray-200">
          <button
            onClick={() => !isProcessing && setUseCloudAI(true)}
            disabled={isProcessing}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
              useCloudAI
                ? "bg-indigo-600 text-white shadow-md"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            🌩️ Cloud API (Fast)
          </button>
          <button
            onClick={() => !isProcessing && setUseCloudAI(false)}
            disabled={isProcessing}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
              !useCloudAI
                ? "bg-green-600 text-white shadow-md"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            🔒 Local AI (Private)
          </button>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-all duration-300 ${
          isProcessing
            ? "border-indigo-400 bg-indigo-50 cursor-wait"
            : "border-gray-400 hover:bg-gray-50 cursor-pointer"
        }`}
        onDrop={isProcessing ? undefined : handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
      >
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={isProcessing}
        />
        <div className="flex flex-col items-center justify-center space-y-4">
          {isProcessing ? (
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          ) : (
            <svg
              className="w-12 h-12 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          )}
          <div>
            {isProcessing ? (
              <p className="text-lg font-bold text-indigo-700 animate-pulse">
                {statusMsg}
                {/* Show react-brai streaming progress if local and loading */}
                {!useCloudAI && isLoading && (
                  <span className="block text-sm text-indigo-500 mt-2 font-normal">
                    Tokens streaming in WebGPU worker...
                  </span>
                )}
              </p>
            ) : file ? (
              <p className="text-lg font-medium text-gray-700">
                {file.name} processed.
              </p>
            ) : (
              <p className="text-lg font-medium text-gray-600">
                Drag & drop your resume PDF here
              </p>
            )}

            {/* Show react-brai loading status to the user ONLY if they selected Local AI */}
            {!useCloudAI && !isReady && !isProcessing && (
              <p className="text-sm text-amber-600 mt-2 font-semibold">
                Waiting for Swarm Leader to load model into VRAM...
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-md border border-red-200">
          {error}
        </div>
      )}

      {parsedData && !isProcessing && (
        <div className="mt-8 pt-8 border-t flex justify-center">
          <button
            onClick={() => setShowPreview(true)}
            className="bg-black text-white px-8 py-3 rounded-md font-semibold hover:bg-gray-800 shadow-lg"
          >
            Re-open PDF Editor
          </button>
        </div>
      )}

      {/* LIVE PDF PREVIEW MODAL WITH SIDEBAR */}
      {showPreview && isMounted && parsedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">
                Configure & Preview
              </h2>
              <div className="flex items-center gap-4">
                <PDFDownloadLink
                  document={
                    <RedactedResumePDF
                      data={parsedData}
                      sections={sections}
                      showOriginalName={showOriginalName}
                    />
                  }
                  fileName={`${showOriginalName ? parsedData.fullName || "Resume" : "Redacted-Resume"}.pdf`}
                  className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-green-700"
                >
                  {/* @ts-ignore */}
                  {({ loading }) =>
                    loading ? "Generating..." : "Download PDF"
                  }
                </PDFDownloadLink>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-500 hover:text-red-600 font-bold text-2xl px-2"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="w-64 bg-white border-r p-6 overflow-y-auto">
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={showOriginalName}
                      onChange={() => setShowOriginalName(!showOriginalName)}
                      className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer"
                    />
                    <span className="text-gray-800 font-bold group-hover:text-green-600 transition-colors">
                      Reveal Original Name
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    Toggle to show the extracted real name instead of the
                    Candidate ID.
                  </p>
                </div>

                <h3 className="font-bold text-gray-800 mb-4 uppercase text-sm tracking-wide">
                  Include Sections
                </h3>
                <div className="space-y-4">
                  {Object.keys(sections).map((key) => (
                    <label
                      key={key}
                      className="flex items-center space-x-3 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={sections[key as keyof typeof sections]}
                        onChange={() =>
                          handleToggle(key as keyof typeof sections)
                        }
                        className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-gray-700 font-medium capitalize group-hover:text-indigo-600 transition-colors">
                        {key === "additional" ? "Other Info" : key}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex-1 bg-gray-200">
                <PDFViewer width="100%" height="100%" className="border-none">
                  <RedactedResumePDF
                    data={parsedData}
                    sections={sections}
                    showOriginalName={showOriginalName}
                  />
                </PDFViewer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
