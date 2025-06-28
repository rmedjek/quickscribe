// app/page.tsx
import PageLayout from "@/components/PageLayout";
import NewTranscriptionPage from "@/components/NewTranscriptionPage";
import UserNav from "@/components/UserNav";
import DarkModeToggle from "@/components/DarkModeToggle";

// This Server Component defines the content for the root path '/'
export default function HomePage() {
  return (
    <>
      <header className="flex h-16 items-center justify-end gap-4 border-b bg-white dark:bg-slate-800/50 px-6 flex-shrink-0">
        <UserNav />
        <DarkModeToggle />
      </header>
      <PageLayout>
        {/* We delegate the entire "new transcription" flow to this component */}
        <NewTranscriptionPage />
      </PageLayout>
    </>
  );
}
