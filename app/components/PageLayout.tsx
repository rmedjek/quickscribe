// app/components/PageLayout.tsx
import React from "react";

interface PageLayoutProps {
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({children}) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      {children}
      <footer className="w-full max-w-4xl px-4 py-4 text-center mt-6 sm:mt-8">
        {" "}
        {/* Reduced py and mt slightly */}
        <p className="text-xs text-slate-500">
          Your video is processed in your browser for privacy. Only audio is
          sent for transcription. (Consider if this footer is still needed or if
          similar info is on the panel itself)
        </p>
      </footer>
    </div>
  );
};

export default PageLayout;
