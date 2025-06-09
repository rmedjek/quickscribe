// app/components/PageLayout.tsx
import React from "react";

interface PageLayoutProps {
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({children}) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 transition-colors">
      {children}
      <footer className="w-full max-w-4xl px-4 py-4 text-center mt-6 sm:mt-8 text-xs text-slate-500 dark:text-slate-400">
        {" "}
        {/* Reduced py and mt slightly */}
        <p className="text-xs text-slate-500">
          Your video is processed in your browser for privacy and only audio is
          sent for transcription. If you choose server processing, your file is
          uploaded securely and deleted after processing.
        </p>
      </footer>
    </div>
  );
};

export default PageLayout;
