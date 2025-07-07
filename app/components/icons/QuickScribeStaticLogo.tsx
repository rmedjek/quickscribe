import React from "react";

const QuickScribeStaticLogo = ({className}: {className?: string}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 200 80"
    className={className}
    aria-label="QuickScribe Logo"
  >
    <rect x="20" y="10" width="12" height="60" rx="4" fill="currentColor" />
    <rect x="50" y="20" width="12" height="40" rx="4" fill="currentColor" />
    <rect x="80" y="30" width="12" height="20" rx="4" fill="currentColor" />
    <rect x="110" y="30" width="12" height="20" rx="4" fill="currentColor" />
    <rect x="140" y="20" width="12" height="40" rx="4" fill="currentColor" />
    <rect x="170" y="10" width="12" height="60" rx="4" fill="currentColor" />
  </svg>
);

export default QuickScribeStaticLogo;
