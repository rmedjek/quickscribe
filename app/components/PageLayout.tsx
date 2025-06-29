// app/components/PageLayout.tsx
import React from "react";

interface PageLayoutProps {
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({children}) => {
  return (
    <div className="w-full min-h-full flex flex-col items-center justify-center p-2 sm:p-4 lg:p-6">
      {/* --- THIS IS THE FIX --- */}
      {/* We are changing `max-w-2xl` to `max-w-xl`. This will make the container
          for ResultsView, ConfirmationView, etc., narrower and feel more scaled-down. */}
      <div className="w-full max-w-xl">{children}</div>
      {/* --- END FIX --- */}
    </div>
  );
};

export default PageLayout;
