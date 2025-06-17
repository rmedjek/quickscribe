// app/components/InputSelectionView.tsx
"use client";

import React, {useRef, useState} from "react";
import {UploadCloud} from "lucide-react"; // Removed LinkIcon as it's not used here
import StyledButton from "./StyledButton";

interface InputSelectionViewProps {
  onFileSelected: (file: File) => void;
  onLinkSubmitted: (link: string) => void;
}

const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;

// Define accepted MIME types
const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-msvideo",
  "video/x-flv",
];
// Broader audio types, including common ones and those Groq explicitly supports
const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg", // .mp3
  "audio/mp4", // .m4a (often audio/mp4)
  "audio/aac", // .aac
  "audio/wav",
  "audio/wave",
  "audio/x-wav", // .wav
  "audio/ogg", // .ogg (can be Vorbis or Opus)
  "audio/opus", // .opus
  "audio/flac", // .flac
  "audio/webm", // .webm (often Opus or Vorbis in WebM audio)
  // Add any other specific audio types you want to support
];
const ALL_ACCEPTED_TYPES_STRING = [
  ...ACCEPTED_VIDEO_TYPES,
  ...ACCEPTED_AUDIO_TYPES,
  "video/*",
  "audio/*",
].join(",");

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

  // Centralized file validation logic
  const validateAndSelectFile = (file: File | undefined) => {
    if (file) {
      const fileType = file.type;
      // Check against specific known types first for more precise matching
      const isKnownVideo = ACCEPTED_VIDEO_TYPES.some(
        (type) => fileType === type
      );
      const isKnownAudio = ACCEPTED_AUDIO_TYPES.some(
        (type) => fileType === type
      );

      // Fallback to generic video/* or audio/* if specific type not matched
      const isGenericVideo = fileType.startsWith("video/");
      const isGenericAudio = fileType.startsWith("audio/");

      if (isKnownVideo || isKnownAudio || isGenericVideo || isGenericAudio) {
        onFileSelected(file);
      } else {
        alert(
          "Please upload a valid video (e.g., MP4, MOV) or audio file (e.g., MP3, WAV, Opus, FLAC)."
        );
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // --- FIX IS HERE ---
    event.stopPropagation(); // Stop the click from bubbling up to the parent div
    // --- END FIX ---
    handleCardClickToUpload(); // Then perform the action
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
    validateAndSelectFile(event.dataTransfer.files?.[0]);
  };

  const handleLinkInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setLinkUrl(event.target.value);
    if (linkError) setLinkError("");
  };

  const handleLinkSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLinkError("");

    if (!linkUrl.trim()) {
      setLinkError("Please enter a video link."); // Keep as video link for this section
      return;
    }

    try {
      const url = new URL(linkUrl);
      // Check if it's a YouTube search results page
      if (url.hostname.includes("youtube.com") && url.pathname === "/results") {
        setLinkError(
          "Please provide a link to a single video, not a search results page."
        );
        return;
      }
      // A simple check if it looks like a valid YouTube URL but has no video ID
      if (
        url.hostname.includes("youtube.com") &&
        url.pathname === "/watch" &&
        !url.searchParams.has("v")
      ) {
        setLinkError(
          "This looks like a YouTube link, but it's missing the video ID (e.g., ?v=...)."
        );
        return;
      }

      // Use regex for a more general check (optional but good)
      if (
        url.hostname.includes("youtube") &&
        !YOUTUBE_URL_REGEX.test(linkUrl)
      ) {
        setLinkError("Please provide a valid YouTube video link.");
        return;
      }

      // If all checks pass, submit the link
      onLinkSubmitted(linkUrl);
      setLinkUrl("");
    } catch {
      setLinkError("Please enter a valid video link (e.g., https://...).");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 dark:text-slate-200 w-full max-w-md sm:max-w-lg mx-auto rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900">
          QuickScribe{" "}
        </h1>

        <p className="text-base text-slate-500 mt-2">Powered by Groq</p>
      </div>

      <div
        className={`p-6 border-2 border-dashed rounded-lg transition-colors
                    ${
                      isDragging
                        ? "border-sky-500 bg-sky-50"
                        : "border-slate-300 dark:border-slate-600 hover:border-sky-400"
                    }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleCardClickToUpload}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClickToUpload();
          }
        }}
        role="button" // Inform screen readers this div acts like a button
        tabIndex={0} // Make it focusable
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <UploadCloud
            size={48}
            className={`${isDragging ? "text-sky-600" : "text-slate-400"}`}
          />
          <p className="text-slate-600">
            Drag and drop your video or audio file here, or
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept={ALL_ACCEPTED_TYPES_STRING} // Use the combined string
          />
          <StyledButton
            variant="primary"
            onClick={handleButtonClick}
            className="bg-orange-500 hover:bg-orange-600 focus-visible:ring-orange-500"
          >
            Select File {/* Changed from "Select Video" */}
          </StyledButton>
          <p className="text-xs text-slate-400 pt-2">
            Video: MP4, MOV, WEBM, etc. <br /> Audio: MP3, WAV, FLAC, M4A, Opus,
            etc.
          </p>
        </div>
      </div>

      <div className="my-6 flex items-center">
        <hr className="flex-grow border-slate-300 dark:border-slate-600" />
        <span className="px-3 text-slate-500 text-sm">OR</span>
        <hr className="flex-grow border-slate-300 dark:border-slate-600" />
      </div>

      <div>
        <form onSubmit={handleLinkSubmit} className="space-y-3">
          <label
            htmlFor="videoLinkInput"
            className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1"
          >
            Enter Video Link (e.g., YouTube, Vimeo, Direct URL){" "}
            {/* Link section remains video-focused */}
          </label>
          <div className="flex space-x-2">
            <input
              type="url"
              id="videoLinkInput"
              value={linkUrl}
              onChange={handleLinkInputChange}
              placeholder="https://example.com/video.mp4"
              className="flex-grow px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
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
      <div className="text-center mt-8">
        <p className="text-xs text-slate-400">{/* Optional footer text */}</p>
      </div>
    </div>
  );
};

export default InputSelectionView;
