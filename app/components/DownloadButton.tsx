// app/components/DownloadButton.tsx
"use client";
import React from 'react';
import StyledButton from './StyledButton'; // Your existing button
import { Download } from 'lucide-react';

interface DownloadButtonProps {
  fileContent: string;
  fileName: string;
  mimeType: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost'; // Match StyledButton variants
  size?: 'sm' | 'md' | 'lg';
}

const DownloadButton: React.FC<DownloadButtonProps> = ({
  fileContent,
  fileName,
  mimeType,
  label,
  variant = 'secondary', // Default to secondary for download buttons
  size = 'md',
}) => {
  const handleDownload = () => {
    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <StyledButton onClick={handleDownload} variant={variant} size={size}>
      <Download size={18} className="mr-2" />
      {label}
    </StyledButton>
  );
};

export default DownloadButton;