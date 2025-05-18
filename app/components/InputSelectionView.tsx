// app/components/InputSelectionView.tsx
"use client";

import React from 'react';
import FileUploadCard from './FileUploadCard';
import LinkInputCard from './LinkInputCard';

interface InputSelectionViewProps {
  onFileSelected: (file: File) => void;
  onLinkSubmitted: (link: string) => void;
}

const InputSelectionView: React.FC<InputSelectionViewProps> = ({
  onFileSelected,
  onLinkSubmitted,
}) => {
  return (
    <div className="max-w-xl mx-auto space-y-8 py-8"> {/* Centered and spaced */}
      <FileUploadCard onFileSelect={onFileSelected} />
      <LinkInputCard onLinkSubmit={onLinkSubmitted} />
    </div>
  );
};

export default InputSelectionView;