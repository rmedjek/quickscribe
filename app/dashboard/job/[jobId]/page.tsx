// app/dashboard/job/[jobId]/page.tsx
import {PrismaClient} from "@prisma/client";
import {auth} from "@/lib/auth";
import {redirect} from "next/navigation";
import JobLifecycleClientPage from "./JobLifecycleClientPage";
import PageLayout from "@/components/PageLayout";

const prisma = new PrismaClient();

export default async function JobPage({params}: {params: {jobId: string}}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  // Use params directly in the query.
  const job = await prisma.transcriptionJob.findFirst({
    where: {id: params.jobId, userId: session.user.id},
  });

  if (!job) {
    return (
      <PageLayout>
        <div>Job not found.</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <JobLifecycleClientPage initialJob={job} />
    </PageLayout>
  );
}
