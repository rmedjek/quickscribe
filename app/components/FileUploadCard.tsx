// app/components/FileUploadCard.tsx
"use client";

import React, { useRef } from 'react';
import { UploadCloud } from 'lucide-react'; // Using UploadCloud icon
import StyledButton from './StyledButton'; // If we want an explicit button inside

interface FileUploadCardProps {
  onFileSelect: (file: File) => void;
}

const FileUploadCard: React.FC<FileUploadCardProps> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCardClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  // Optional: Drag and Drop (basic structure, can be enhanced later)
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Necessary to allow dropping
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
      // Basic validation for example: (we can make this more robust)
      if (['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) {
        onFileSelect(file);
      } else {
        alert('Please upload a .mp4, .mov, or .webm file.');
      }
    }
  };

  return (
    <div
      className={`bg-white p-6 sm:p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out cursor-pointer
                  border-2 ${isDragging ? 'border-sky-500 bg-sky-50' : 'border-dashed border-slate-300 hover:border-sky-400'}
                  flex flex-col items-center text-center space-y-4`}
      onClick={handleCardClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(); }} // Accessibility
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" // Specify accepted file types
      />
      <div className={`p-3 rounded-full ${isDragging ? 'bg-sky-100' : 'bg-slate-100'}`}>
        <UploadCloud
          size={48}
          className={`${isDragging ? 'text-sky-600' : 'text-slate-500'}`}
        />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-slate-700">
          Upload Video File
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Drag & drop or click to select a .mp4, .mov, or .webm file.
        </p>
      </div>
      {/* Alternatively, an explicit button instead of making the whole card clickable: */}
      {/* <StyledButton variant="secondary" onClick={handleCardClick} className="mt-4">
        Choose File
      </StyledButton> */}
    </div>
  );
};

export default FileUploadCard;