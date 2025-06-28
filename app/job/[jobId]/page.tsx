// app/job/[jobId]/page.tsx
import {PrismaClient} from "@prisma/client";
import {auth} from "@/lib/auth";
import {redirect} from "next/navigation";
import PageLayout from "@/components/PageLayout";
import UserNav from "@/components/UserNav";
import DarkModeToggle from "@/components/DarkModeToggle";
import {StepperProvider} from "@/app/contexts/StepperContext";
import JobLifecycleClientPage from "./JobLifecycleClientPage";

const prisma = new PrismaClient();

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
        <div>Job not found.</div>
      </PageLayout>
    );
  }

  return (
    <>
      <header className="flex h-16 items-center justify-end gap-4 border-b bg-white dark:bg-slate-800/50 px-6 flex-shrink-0">
        <UserNav />
        <DarkModeToggle />
      </header>
      <PageLayout>
        <StepperProvider>
          <JobLifecycleClientPage initialJob={job} />
        </StepperProvider>
      </PageLayout>
    </>
  );
}
