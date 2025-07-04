// app/components/icons/QuickScribeLogo.tsx
import React from "react";

const QuickScribeLogo = ({className}: {className?: string}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 200 80"
    fill="none"
    className={className} // Allows passing size classes
    aria-label="QuickScribe Logo"
  >
    <style>{`
      .bar { fill:#0ea5e9; rx:4px; }
      @keyframes pulse {
        0%,100% { height:20px; y:30px; }
        50%     { height:60px; y:10px; }
      }
      .b1 { animation:pulse 1.2s -.00s infinite ease-in-out; }
      .b2 { animation:pulse 1.2s -.15s infinite ease-in-out; }
      .b3 { animation:pulse 1.2s -.30s infinite ease-in-out; }
      .b4 { animation:pulse 1.2s -.45s infinite ease-in-out; }
      .b5 { animation:pulse 1.2s -.60s infinite ease-in-out; }
      .b6 { animation:pulse 1.2s -.75s infinite ease-in-out; }
    `}</style>
    <rect className="bar b1" x="20" y="30" width="12" height="20" />
    <rect className="bar b2" x="50" y="30" width="12" height="20" />
    <rect className="bar b3" x="80" y="30" width="12" height="20" />
    <rect className="bar b4" x="110" y="30" width="12" height="20" />
    <rect className="bar b5" x="140" y="30" width="12" height="20" />
    <rect className="bar b6" x="170" y="30" width="12" height="20" />
  </svg>
);

export default QuickScribeLogo;
