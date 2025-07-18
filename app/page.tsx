// app/page.tsx
import AppLayout from "@/components/AppLayout";
import NewTranscriptionPage from "@/components/NewTranscriptionPage";

export default function HomePage() {
  return (
    <AppLayout>
      <NewTranscriptionPage />
    </AppLayout>
  );
}
