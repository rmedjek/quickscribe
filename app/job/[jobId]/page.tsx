// app/job/[jobId]/page.tsx
import prisma from "@/lib/prisma"; // CORRECT: Import the singleton
import {auth} from "@/lib/auth";
import {redirect} from "next/navigation";
import JobLifecycleClientPage from "./JobLifecycleClientPage";
import PageLayout from "@/components/PageLayout";
import {StepperProvider} from "@/app/contexts/StepperContext";
import Link from "next/link";
import StyledButton from "@/components/StyledButton";

// REMOVED: const prisma = new PrismaClient();

export default async function JobPage({params}: {params: {jobId: string}}) {
  const {jobId} = params;
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const job = await prisma.transcriptionJob.findFirst({
    where: {id: jobId, userId: session.user.id},
  });

  if (!job) {
    return (
      <PageLayout>
        <div className="text-center p-8 space-y-6">
          <h1 className="text-2xl font-bold text-red-500">Job Not Found</h1>
          <p className="text-[var(--text-secondary)]">
            The transcription you are looking for has been deleted or does not
            exist.
          </p>
          <Link href="/">
            <StyledButton variant="primary">New Transcription</StyledButton>
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <StepperProvider>
        <JobLifecycleClientPage initialJob={job} />
      </StepperProvider>
    </PageLayout>
  );
}
