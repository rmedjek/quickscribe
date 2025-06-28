// app/components/PageLayout.tsx
import React from "react";

interface PageLayoutProps {
  children: React.ReactNode;
}

// This component's only job is to provide consistent padding and centering.
// It should NOT import any global CSS.
const PageLayout: React.FC<PageLayoutProps> = ({children}) => {
  return (
    <div className="flex flex-col items-center justify-start p-4 sm:p-6 lg:p-8 w-full h-full">
      <div className="w-full max-w-4xl">{children}</div>
    </div>
  );
};

export default PageLayout;
