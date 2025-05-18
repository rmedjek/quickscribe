// app/components/LinkInputCard.tsx
"use client";

import React, { useState } from 'react';
import { Link as LinkIcon } from 'lucide-react'; // Using Link icon
import StyledButton from './StyledButton';

interface LinkInputCardProps {
  onLinkSubmit: (url: string) => void;
}

const LinkInputCard: React.FC<LinkInputCardProps> = ({ onLinkSubmit }) => {
  const [linkUrl, setLinkUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!linkUrl.trim()) {
      setError('Please enter a video link.');
      return;
    }
    // Basic URL validation (can be improved with a regex or library)
    try {
      new URL(linkUrl); // Will throw error if invalid URL
      setError('');
      onLinkSubmit(linkUrl);
      setLinkUrl(''); // Clear input after submission
    } catch (_) {
      setError('Please enter a valid video link (e.g., https://...).');
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 rounded-full bg-slate-100">
          <LinkIcon size={28} className="text-slate-500" />
        </div>
        <h3 className="text-xl font-semibold text-slate-700">
          Use Video Link
        </h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="videoLink" className="sr-only"> {/* For accessibility */}
            Video Link
          </label>
          <input
            type="url" // Use type="url" for basic browser validation & keyboard
            id="videoLink"
            name="videoLink"
            value={linkUrl}
            onChange={(e) => {
              setLinkUrl(e.target.value);
              if (error) setError(''); // Clear error on typing
            }}
            placeholder="Paste a YouTube, Vimeo, or direct video link"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-colors"
            aria-describedby={error ? "link-error" : undefined}
          />
          {error && (
            <p id="link-error" className="text-sm text-red-600 mt-1.5">
              {error}
            </p>
          )}
        </div>
        <StyledButton type="submit" variant="primary" className="w-full sm:w-auto">
          Process Link
        </StyledButton>
      </form>
      <p className="text-xs text-slate-400 mt-4">
        e.g., https://www.youtube.com/watch?v=...
      </p>
    </div>
  );
};

export default LinkInputCard;