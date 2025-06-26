// app/dashboard/job/[jobId]/page.tsx
import {PrismaClient} from "@prisma/client";
import {auth} from "@/lib/auth";
import {redirect} from "next/navigation";
import JobLifecycleClientPage from "./JobLifecycleClientPage";
import PageLayout from "@/components/PageLayout";

const prisma = new PrismaClient();

// The props for a dynamic Server Component page
interface JobPageProps {
  params: {
    jobId: string;
  };
}

export default async function JobPage({params}: JobPageProps) {
  // Destructure after an await or when directly used.
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  // Use params.jobId directly here
  const job = await prisma.transcriptionJob.findFirst({
    where: {
      id: params.jobId,
      userId: session.user.id,
    },
  });

  if (!job) {
    return (
      <PageLayout>
        <div>Job not found or you do not have permission to view it.</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <JobLifecycleClientPage initialJob={job} />
    </PageLayout>
  );
}
