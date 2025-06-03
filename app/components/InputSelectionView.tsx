/* eslint-disable @typescript-eslint/no-unused-vars */
// app/components/InputSelectionView.tsx
"use client";

import React, {useRef, useState} from "react";
import {UploadCloud, Link as LinkIcon} from "lucide-react";
import StyledButton from "./StyledButton"; // Your existing button

interface InputSelectionViewProps {
  onFileSelected: (file: File) => void;
  onLinkSubmitted: (link: string) => void;
}

const InputSelectionView: React.FC<InputSelectionViewProps> = ({
  onFileSelected,
  onLinkSubmitted,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");

  const handleCardClickToUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Basic client-side validation (can be expanded)
      if (
        [
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "video/x-matroska",
          "video/x-msvideo",
          "video/x-flv",
        ].some((type) => file.type.startsWith(type.split("/")[0] + "/"))
      ) {
        onFileSelected(file);
      } else {
        alert(
          "Please upload a valid video file (e.g., MP4, MOV, WEBM, MKV, AVI, FLV)."
        );
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      if (
        [
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "video/x-matroska",
          "video/x-msvideo",
          "video/x-flv",
        ].some((type) => file.type.startsWith(type.split("/")[0] + "/"))
      ) {
        onFileSelected(file);
      } else {
        alert(
          "Please upload a valid video file (e.g., MP4, MOV, WEBM, MKV, AVI, FLV)."
        );
      }
    }
  };

  const handleLinkInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setLinkUrl(event.target.value);
    if (linkError) setLinkError("");
  };

  const handleLinkSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!linkUrl.trim()) {
      setLinkError("Please enter a video link.");
      return;
    }
    try {
      new URL(linkUrl); // Basic URL format validation
      onLinkSubmitted(linkUrl);
      setLinkUrl("");
    } catch (_) {
      setLinkError("Please enter a valid video link (e.g., https://...).");
    }
  };

  return (
    <div className="bg-white w-full max-w-md sm:max-w-lg mx-auto rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
      {/* Title Section */}
      <div className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900">
          {" "}
          Quick Transcribe
        </h1>
        <p className="text-base text-slate-500 mt-2">Powered by Groq</p>
      </div>

      {/* File Upload Section */}
      <div
        className={`p-6 border-2 border-dashed rounded-lg transition-colors
                    ${
                      isDragging
                        ? "border-sky-500 bg-sky-50"
                        : "border-slate-300 hover:border-sky-400"
                    }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <UploadCloud
            size={48}
            className={`${isDragging ? "text-sky-600" : "text-slate-400"}`}
          />
          <p className="text-slate-600">
            Drag and drop your video file here, or
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo,video/x-flv,video/*" // Broaden accept
          />
          <StyledButton
            variant="primary"
            onClick={handleCardClickToUpload}
            className="bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-500"
          >
            Select Video
          </StyledButton>
          <p className="text-xs text-slate-400 pt-2">
            Supported: MP4, MOV, WEBM, MKV, AVI, FLV etc.
          </p>
        </div>
      </div>

      {/* "Or" Divider (Optional) */}
      <div className="my-6 flex items-center">
        <hr className="flex-grow border-slate-300" />
        <span className="px-3 text-slate-500 text-sm">OR</span>
        <hr className="flex-grow border-slate-300" />
      </div>

      {/* Video Link Section */}
      <div>
        <form onSubmit={handleLinkSubmit} className="space-y-3">
          <label
            htmlFor="videoLinkInput"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Enter Video Link (e.g., YouTube, Vimeo, Direct URL)
          </label>
          <div className="flex space-x-2">
            <input
              type="url"
              id="videoLinkInput"
              value={linkUrl}
              onChange={handleLinkInputChange}
              placeholder="https://example.com/video.mp4"
              className="flex-grow px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
              aria-describedby={linkError ? "link-input-error" : undefined}
            />
            <StyledButton
              type="submit"
              variant="secondary"
              className="flex-shrink-0"
            >
              Process Link
            </StyledButton>
          </div>
          {linkError && (
            <p id="link-input-error" className="text-sm text-red-600 mt-1">
              {linkError}
            </p>
          )}
        </form>
      </div>

      {/* Footer inside the panel (Optional, like the example image) */}
      <div className="text-center mt-8">
        <p className="text-xs text-slate-400">
          {/* Created by Your Name / App Name */}
          {/* Version 1.0.0 */}
        </p>
      </div>
    </div>
  );
};

export default InputSelectionView;
