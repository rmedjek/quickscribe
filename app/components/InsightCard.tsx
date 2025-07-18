// app/components/InsightCard.tsx
import React from "react";
import type {LucideProps} from "lucide-react";

interface InsightCardProps {
  title: string;
  icon: React.ComponentType<LucideProps>;
  children: React.ReactNode;
}

export const InsightCard: React.FC<InsightCardProps> = ({
  title,
  icon: Icon,
  children,
}) => {
  return (
    <div className="bg-[var(--card-primary-bg)] rounded-lg overflow-hidden">
      <div className="p-4 border-b border-[var(--border-color)]">
        <h4 className="font-semibold flex items-center text-base text-[var(--text-primary)]">
          <Icon size={18} className="mr-3 text-sky-500" />
          {title}
        </h4>
      </div>
      <div className="p-4 bg-[var(--card-bg)]">{children}</div>
    </div>
  );
};
