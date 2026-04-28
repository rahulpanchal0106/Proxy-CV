"use client";

import React, { useState, useRef, useEffect } from "react";
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import RedactedResumePDF from "./redactedResumePDF";
import { useLocalAI } from "react-brai";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileText,
  Settings,
  ShieldCheck,
  Zap,
  X,
  Download,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

export default function Dropzone() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showOriginalName, setShowOriginalName] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

  const { loadModel, chat, isReady, isLoading, response, progress } =
    useLocalAI();

  // Load the model into VRAM via the Leader tab when switched to Local AI
  // Swap this in your Dropzone.tsx
  useEffect(() => {
    if (!useCloudAI && !isReady) {
      // Back to the lightweight 1.5B model
      loadModel("Qwen2.5-1.5B-Instruct-q4f16_1-MLC");
    }
  }, [useCloudAI, isReady, loadModel]);

  useEffect(() => {
    if (isProcessing && !useCloudAI && !isLoading && response) {
      try {
        const cleanJsonString = response.replace(/```json\n?|```/g, "").trim();
        setParsedData(JSON.parse(cleanJsonString));
        setShowPreview(true);
      } catch (err) {
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
        setStatusMsg("Local Engine: Queuing job to Swarm...");

        // 1. Define the schema exactly like your working app, using bracketed instructions
        const targetSchema = {
          fullName: "[Candidate Full Name]",
          candidateId: "[Generate Random 6-Character Alphanumeric ID]",
          contactInfo: {
            email: "[Email Address]",
            phone: "[Phone Number]",
            location: "[City, State, or Country]",
          },
          professionalSummary: "[Brief summary of profile]",
          topSkills: ["[Skill 1]", "[Skill 2]"],
          experience: [
            {
              role: "[Job Title]",
              company: "[Company Name]",
              duration: "[Time Period]",
              location: "[Location]",
              bulletPoints: ["[Point 1]", "[Point 2]"],
            },
          ],
          projects: [
            {
              name: "[Project Name]",
              role: "[Project Role]",
              technologies: ["[Tech 1]", "[Tech 2]"],
              duration: "[Time Period]",
              bulletPoints: ["[Point 1]"],
            },
          ],
          education: [
            {
              degree: "[Degree Name]",
              institution: "[School Name]",
              year: "[Graduation Year]",
            },
          ],
          certifications: [
            {
              name: "[Certification Name]",
              issuer: "[Issuing Organization]",
              year: "[Year]",
            },
          ],
          additionalSections: [
            {
              title: "[Section Title]",
              content: ["[Point 1]"],
            },
          ],
        };

        // 2. Exact same prompt structure from your working file
        const systemPrompt = `Extract the resume data into the provided JSON schema. 
Replace the bracketed instructions (e.g., "[Candidate Full Name]") with the actual data from the resume. 
If a piece of information is not mentioned in the resume, output an empty string "".
Output ONLY valid JSON. Do not include markdown formatting.

Schema: 
${JSON.stringify(targetSchema, null, 2)}`;

        // 3. Push to react-brai
        chat([
          { role: "system", content: systemPrompt },
          { role: "user", content: `Resume:\n${extractedText}` },
        ]);
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
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files[0].type === "application/pdf") {
        processResumePipeline(e.dataTransfer.files[0]);
      } else {
        setError("Please upload a valid PDF file.");
      }
    }
  };

  const handleToggle = (key: keyof typeof sections) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Custom UI Toggle Component
  const CustomToggle = ({
    checked,
    onChange,
    label,
  }: {
    checked: boolean;
    onChange: () => void;
    label: string;
  }) => (
    <div
      className="flex items-center justify-between py-2 cursor-pointer group"
      onClick={onChange}
    >
      <span className="text-sm font-medium text-gray-700 capitalize group-hover:text-indigo-600 transition-colors">
        {label === "additional" ? "Other Info" : label}
      </span>
      <div
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 ease-in-out ${checked ? "bg-indigo-600" : "bg-gray-200"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-300 ease-in-out ${checked ? "translate-x-4" : "translate-x-1"}`}
        />
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-6 relative font-sans">
      {/* Engine Segmented Control */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100/80 backdrop-blur-md p-1.5 rounded-2xl inline-flex shadow-sm border border-gray-200/50 relative">
          <button
            onClick={() => !isProcessing && setUseCloudAI(true)}
            className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 z-10 ${useCloudAI ? "text-indigo-700" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Zap size={16} /> Cloud Fast
          </button>
          <button
            onClick={() => !isProcessing && setUseCloudAI(false)}
            className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 z-10 ${!useCloudAI ? "text-green-700" : "text-gray-500 hover:text-gray-700"}`}
          >
            <ShieldCheck size={16} /> Local Private
          </button>

          {/* Animated Background Pill */}
          <motion.div
            className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl bg-white shadow-sm border border-gray-200 z-0 ${useCloudAI ? "left-1.5" : "right-1.5"}`}
            layout
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        </div>
      </div>

      {/* Main Dropzone */}
      <motion.div
        layout
        className={`relative overflow-hidden rounded-3xl border-2 transition-all duration-300 ${
          isDragging
            ? "border-indigo-500 bg-indigo-50/50 scale-[1.02]"
            : isProcessing
              ? "border-indigo-300 bg-white shadow-lg"
              : "border-dashed border-gray-300 bg-gray-50/50 hover:bg-gray-50 hover:border-indigo-400"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={isProcessing ? undefined : handleDrop}
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

        <div className="p-16 flex flex-col items-center justify-center min-h-[300px] cursor-pointer">
          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
                  <div className="relative bg-white p-4 rounded-full shadow-md">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  </div>
                </div>
                <h3 className="mt-6 text-xl font-bold text-gray-800 tracking-tight">
                  {statusMsg}
                </h3>
                {!useCloudAI && isLoading && (
                  <p className="mt-2 text-sm text-indigo-500 animate-pulse">
                    WebGPU worker streaming tokens...
                  </p>
                )}
                {!useCloudAI && !isReady && (
                  <p className="mt-2 text-sm text-amber-600 font-medium">
                    Loading Swarm Engine: {progress?.text}
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center"
              >
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
                  <UploadCloud className="w-10 h-10 text-indigo-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Drop Candidate Resume Here
                </h3>
                <p className="text-sm text-gray-500 text-center max-w-sm">
                  Upload a PDF. We'll automatically strip contact details and
                  generate a pristine, client-ready format.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-start gap-3"
        >
          <div className="bg-red-100 p-1 rounded-full">
            <X size={16} />
          </div>
          <div>
            <p className="font-semibold">Engine Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </motion.div>
      )}

      {parsedData && !isProcessing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 flex justify-center"
        >
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 bg-gray-900 text-white px-8 py-3.5 rounded-full font-semibold hover:bg-gray-800 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300"
          >
            <Settings size={18} /> Open PDF Editor
          </button>
        </motion.div>
      )}

      {/* Editor Modal */}
      <AnimatePresence>
        {showPreview && isMounted && parsedData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-gray-900/40 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-[2rem] w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/20"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white/50 backdrop-blur-xl z-10">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-xl">
                    <FileText className="text-indigo-600 w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 leading-tight">
                      Proxy CV Studio
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">
                      Candidate: {parsedData.candidateId}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <PDFDownloadLink
                    document={
                      <RedactedResumePDF
                        data={parsedData}
                        sections={sections}
                        showOriginalName={showOriginalName}
                      />
                    }
                    fileName={`${showOriginalName ? parsedData.fullName || "Resume" : "Redacted-Resume"}.pdf`}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-indigo-700 hover:shadow-lg transition-all"
                  >
                    {/* @ts-ignore */}
                    {({ loading }) =>
                      loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />{" "}
                          Generating...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" /> Export PDF
                        </>
                      )
                    }
                  </PDFDownloadLink>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Layout Editor */}
              <div className="flex flex-1 overflow-hidden bg-gray-50/50">
                {/* Left Sidebar */}
                <div className="w-72 bg-white border-r border-gray-100 p-6 overflow-y-auto hide-scrollbar">
                  {/* Identity Reveal Panel */}
                  <div className="mb-8 p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200/60 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        {showOriginalName ? (
                          <Eye size={16} className="text-green-600" />
                        ) : (
                          <EyeOff size={16} className="text-gray-400" />
                        )}
                        Reveal Identity
                      </h3>
                      <div
                        className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors duration-300 ${showOriginalName ? "bg-green-500" : "bg-gray-300"}`}
                        onClick={() => setShowOriginalName(!showOriginalName)}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-300 ${showOriginalName ? "translate-x-4" : "translate-x-1"}`}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Turn off anonymity to display the candidate's real name
                      instead of their ID.
                    </p>
                  </div>

                  <h3 className="font-bold text-gray-900 mb-4 text-sm tracking-wide flex items-center gap-2">
                    <Settings size={16} className="text-gray-400" /> Document
                    Sections
                  </h3>

                  <div className="space-y-1 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                    {Object.keys(sections).map((key) => (
                      <CustomToggle
                        key={key}
                        label={key}
                        checked={sections[key as keyof typeof sections]}
                        onChange={() =>
                          handleToggle(key as keyof typeof sections)
                        }
                      />
                    ))}
                  </div>
                </div>

                {/* PDF Viewer Area */}
                <div className="flex-1 bg-gray-200/50 p-6">
                  <div className="w-full h-full rounded-2xl overflow-hidden shadow-xl border border-gray-200/60 bg-white">
                    <PDFViewer
                      width="100%"
                      height="100%"
                      className="border-none bg-white"
                    >
                      <RedactedResumePDF
                        data={parsedData}
                        sections={sections}
                        showOriginalName={showOriginalName}
                      />
                    </PDFViewer>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
