// app/components/PageLayout.tsx
import React from 'react';

interface PageLayoutProps {
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center">
      {/* Optional: Simple Header */}
      <header className="w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-sky-600 text-center">
          QuickScribe
        </h1>
        <p className="text-lg text-slate-600 text-center mt-2">
          Effortless transcripts for your videos.
        </p>
      </header>

      <main className="w-full max-w-2xl px-4 sm:px-6 lg:px-8 flex-grow py-8">
        {children}
      </main>

      {/* Consistent Footer */}
      <footer className="w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 text-center">
        <p className="text-xs text-slate-500">
          Your video is processed in your browser for privacy. Only audio is
          sent for transcription.
        </p>
      </footer>
    </div>
  );
};

export default PageLayout;