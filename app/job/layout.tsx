// app/job/layout.tsx
import AppLayout from "@/components/AppLayout";

export default function JobPagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
