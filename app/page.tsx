// app/page.tsx
import PageLayout from "@/components/PageLayout";
import NewTranscriptionPage from "@/components/NewTranscriptionPage";
import {StepperProvider} from "./contexts/StepperContext";

// This Server Component is the "welcome mat" inside the main authenticated layout.
// It should not have its own header.
export default function HomePage() {
  return (
    <PageLayout>
      <StepperProvider>
        <NewTranscriptionPage />
      </StepperProvider>
    </PageLayout>
  );
}
