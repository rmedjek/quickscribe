// app/components/StyledButton.tsx
import React from "react";
import clsx from "clsx"; // For conditional classes

interface StyledButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  // Add other props like 'iconLeft', 'iconRight' if needed later
}

const StyledButton: React.FC<StyledButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  className,
  isLoading = false,
  disabled,
  ...props
}) => {
  const baseStyles =
    "font-semibold rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all duration-150 ease-in-out inline-flex items-center justify-center active:scale-[0.98] active:brightness-95";

  const variantStyles = {
    primary:
      "bg-sky-600 text-white hover:bg-sky-700 focus-visible:ring-sky-500 disabled:bg-sky-300",
    secondary:
      "bg-slate-200 text-slate-700 hover:bg-slate-300 focus-visible:ring-slate-400 disabled:bg-slate-100 disabled:text-slate-400",
    danger:
      "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300",
    ghost:
      "bg-transparent text-sky-600 hover:bg-sky-100 focus-visible:ring-sky-500 disabled:text-slate-400 disabled:bg-transparent",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
    icon: "p-2.5",
  };

  const loadingStyles = isLoading ? "opacity-75 cursor-not-allowed" : "";

  return (
    <button
      type="button"
      className={clsx(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        loadingStyles,
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className={`animate-spin h-5 w-5 ${
            children ? "-ml-1 mr-2" : ""
          } text-white`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {children}
    </button>
  );
};

export default StyledButton;
