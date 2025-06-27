// app/dashboard/job/[jobId]/page.tsx
import {PrismaClient} from "@prisma/client";
import {auth} from "@/lib/auth";
import {redirect} from "next/navigation";
import JobLifecycleClientPage from "./JobLifecycleClientPage";
import PageLayout from "@/components/PageLayout";
import {StepperProvider} from "@/app/contexts/StepperContext";

const prisma = new PrismaClient();

export default async function JobPage({
  params: {jobId},
}: {
  params: {jobId: string};
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const job = await prisma.transcriptionJob.findFirst({
    where: {
      id: jobId,
      userId: session.user.id,
    },
  });

  if (!job) {
    return (
      <PageLayout>
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-500">Job Not Found</h1>
          <p className="text-slate-500">
            The requested transcription job does not exist or you do not have
            permission to view it.
          </p>
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
