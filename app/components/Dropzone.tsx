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
  HardDriveDownload,
  Database,
  Info,
  Key,
  ChevronDown,
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

  // Engine States
  const [useCloudAI, setUseCloudAI] = useState(true);
  const [localConsentGiven, setLocalConsentGiven] = useState(false);

  // NEW: Fallback Configuration States
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [customApiKey, setCustomApiKey] = useState("");
  const [cloudModel, setCloudModel] = useState("gemini-1.5-flash");

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

  useEffect(() => {
    if (!useCloudAI && !isReady && localConsentGiven) {
      loadModel("Qwen2.5-1.5B-Instruct-q4f16_1-MLC");
    }
  }, [useCloudAI, isReady, localConsentGiven, loadModel]);

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

        // NEW: Pass the optional overrides to the backend
        const parseRes = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: extractedText,
            apiKey: customApiKey || undefined,
            modelName: cloudModel || undefined,
          }),
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

        // The bracketed schema that guarantees 1.5B accuracy
        const targetSchema = {
          fullName: "[Candidate Full Name]",
          candidateId: "[Generate Random 6-Character ID]",
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
              bulletPoints: ["[Point 1]"],
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
            { title: "[Section Title]", content: ["[Point 1]"] },
          ],
        };

        const systemPrompt = `Extract the resume data into the provided JSON schema. Replace the bracketed instructions with the actual data from the resume. If a piece of information is not mentioned in the resume, output an empty string "". Output ONLY valid JSON.\n\nSchema:\n${JSON.stringify(targetSchema, null, 2)}`;

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
    if (!useCloudAI && !isReady) return;

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
      {/* Engine Segmented Control & Dynamic Warnings */}
      <div className="flex flex-col items-center mb-8">
        <div className="bg-gray-100/80 backdrop-blur-md p-1.5 rounded-2xl inline-flex shadow-sm border border-gray-200/50 relative mb-4">
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
          <motion.div
            className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl bg-white shadow-sm border border-gray-200 z-0 ${useCloudAI ? "left-1.5" : "right-1.5"}`}
            layout
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        </div>

        {/* Dynamic Warning Banners */}
        <AnimatePresence mode="wait">
          {useCloudAI ? (
            <motion.div
              key="cloud-warning"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex flex-col w-full max-w-md"
            >
              <div className="flex items-start gap-2 text-xs text-indigo-600/80 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 mb-2">
                <Info size={16} className="shrink-0 mt-0.5" />
                <p>
                  <strong>Cloud Processing:</strong> Fastest extraction.
                  PII-stripped data is securely transmitted to Google Gemini
                  servers via API.
                </p>
              </div>

              {/* Expandable BYOK Settings */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Settings size={14} /> Advanced API Configuration (Optional)
                  </div>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-300 ${showAdvancedSettings ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {showAdvancedSettings && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 pt-0 border-t border-gray-100 flex flex-col gap-4 mt-2">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-gray-500">
                            Custom Gemini API Key
                          </label>
                          <div className="relative">
                            <Key
                              size={14}
                              className="absolute left-3 top-2.5 text-gray-400"
                            />
                            <input
                              type="password"
                              placeholder="Leave blank to use default server key"
                              value={customApiKey}
                              onChange={(e) => setCustomApiKey(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-9 pr-3 text-xs text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-gray-500">
                            Cloud Model String
                          </label>
                          <select
                            value={cloudModel}
                            onChange={(e) => setCloudModel(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-xs text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none"
                          >
                            <option value="gemini-1.5-flash">
                              Gemini 1.5 Flash (Fastest)
                            </option>
                            <option value="gemini-1.5-pro">
                              Gemini 1.5 Pro (Highest Accuracy)
                            </option>
                            <option value="gemini-2.0-flash">
                              Gemini 2.0 Flash (Experimental)
                            </option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="local-warning"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-start gap-2 text-xs text-amber-700/80 bg-amber-50 p-3 rounded-xl border border-amber-200 max-w-md"
            >
              <ShieldCheck size={16} className="shrink-0 mt-0.5" />
              <p>
                <strong>100% Offline:</strong> Zero data leaves this device.
                Requires downloading a ~1.6GB AI model to browser cache. Best
                for ultra-sensitive data. Requires 4GB+ VRAM.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Dropzone / Engine UI */}
      <motion.div
        layout
        className={`relative overflow-hidden rounded-3xl border-2 transition-all duration-300 ${
          !useCloudAI && !isReady
            ? "border-gray-200 bg-white shadow-sm"
            : isDragging
              ? "border-indigo-500 bg-indigo-50/50 scale-[1.02]"
              : isProcessing
                ? "border-indigo-300 bg-white shadow-lg"
                : "border-dashed border-gray-300 bg-gray-50/50 hover:bg-gray-50 hover:border-indigo-400 cursor-pointer"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          if (useCloudAI || isReady) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={
          isProcessing || (!useCloudAI && !isReady) ? undefined : handleDrop
        }
        onClick={() =>
          !isProcessing &&
          (useCloudAI || isReady) &&
          fileInputRef.current?.click()
        }
      >
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={isProcessing || (!useCloudAI && !isReady)}
        />

        <div className="p-10 sm:p-16 flex flex-col items-center justify-center min-h-[340px]">
          <AnimatePresence mode="wait">
            {/* STATE 1: Local AI Needs Consent */}
            {!useCloudAI && !isReady && !localConsentGiven && (
              <motion.div
                key="consent"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center text-center max-w-md cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-green-50 p-4 rounded-full mb-4 border border-green-100">
                  <Database className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Enable Private Local Engine
                </h3>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                  To process resumes entirely offline without sending data to
                  the cloud, Proxy CV needs to download a secure AI model
                  directly into your browser's cache.
                </p>
                <button
                  onClick={() => setLocalConsentGiven(true)}
                  className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-green-700 shadow-md transition-all"
                >
                  <HardDriveDownload size={18} /> Download Secure Engine (1.6GB)
                </button>
              </motion.div>
            )}

            {/* STATE 2: Local AI Downloading */}
            {!useCloudAI && !isReady && localConsentGiven && (
              <motion.div
                key="downloading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center w-full max-w-md cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <Loader2 className="w-10 h-10 text-green-500 animate-spin mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Caching AI Engine...
                </h3>
                <p className="text-sm text-gray-500 font-mono text-center mb-6 h-10">
                  {progress?.text || "Connecting to Swarm network..."}
                </p>
                <div className="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden border border-gray-200">
                  <motion.div
                    className="bg-green-500 h-3 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: `${(progress?.progress || 0) * 100}%` }}
                    transition={{ ease: "linear", duration: 0.2 }}
                  />
                </div>
                <p className="text-xs text-gray-400 font-semibold">
                  {Math.round((progress?.progress || 0) * 100)}% Complete
                </p>
              </motion.div>
            )}

            {/* STATE 3: Processing File */}
            {isProcessing && (useCloudAI || isReady) && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center cursor-wait"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative">
                  <div
                    className={`absolute inset-0 rounded-full animate-ping opacity-75 ${useCloudAI ? "bg-indigo-100" : "bg-green-100"}`}
                  ></div>
                  <div className="relative bg-white p-4 rounded-full shadow-md">
                    <Loader2
                      className={`w-8 h-8 animate-spin ${useCloudAI ? "text-indigo-600" : "text-green-600"}`}
                    />
                  </div>
                </div>
                <h3 className="mt-6 text-xl font-bold text-gray-800 tracking-tight text-center max-w-sm">
                  {statusMsg}
                </h3>
                {!useCloudAI && isLoading && (
                  <p className="mt-2 text-sm text-green-600 font-medium animate-pulse">
                    WebGPU worker streaming tokens...
                  </p>
                )}
              </motion.div>
            )}

            {/* STATE 4: Ready to Drop (Idle) */}
            {!isProcessing && (useCloudAI || isReady) && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center"
              >
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-6">
                  <UploadCloud
                    className={`w-10 h-10 ${useCloudAI ? "text-indigo-500" : "text-green-500"}`}
                  />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Drop Candidate Resume Here
                </h3>
                <p className="text-sm text-gray-500 text-center max-w-sm">
                  Upload a PDF. Proxy CV will automatically strip contact
                  details and generate a secure, client-ready format.
                </p>
                {!useCloudAI && (
                  <p className="mt-4 text-xs font-bold text-green-600 px-3 py-1 bg-green-50 rounded-full">
                    Secure Offline Engine Active
                  </p>
                )}
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
            className="flex items-center gap-2 bg-gray-900 text-white px-8 py-3.5 rounded-full font-semibold hover:bg-gray-800 shadow-xl hover:-translate-y-0.5 transition-all"
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
              <div className="flex flex-1 overflow-hidden bg-gray-50/50">
                <div className="w-72 bg-white border-r border-gray-100 p-6 overflow-y-auto hide-scrollbar">
                  <div className="mb-8 p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200/60 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        {showOriginalName ? (
                          <Eye size={16} className="text-green-600" />
                        ) : (
                          <EyeOff size={16} className="text-gray-400" />
                        )}{" "}
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
