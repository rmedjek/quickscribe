// app/job/[jobId]/page.tsx
import prisma from "@/lib/prisma";
import {auth} from "@/lib/auth";
import {redirect} from "next/navigation";
import PageLayout from "@/components/PageLayout";
import JobResultPage from "./JobResultPage";

export default async function JobPage({
  params,
}: {
  params: Promise<{jobId: string}>;
}) {
  // Await the params before destructuring
  const {jobId} = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const job = await prisma.transcriptionJob.findFirst({
    where: {id: jobId, userId: session.user.id, status: "COMPLETED"},
  });

  if (!job) {
    return (
      <PageLayout>
        {" "}
        <div className="text-center p-8">Job Not Found.</div>{" "}
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <JobResultPage job={job} />
    </PageLayout>
  );
}
