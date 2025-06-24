// app/dashboard/job/[jobId]/page.tsx

import {PrismaClient} from "@prisma/client";
import {auth} from "@/lib/auth";
import {redirect} from "next/navigation";
import JobStatusClientPage from "./JobStatusClientPage";

const prisma = new PrismaClient();

// --- THIS IS THE DEFINITIVE FIX for the server-side error ---
// We destructure `params` directly in the function signature. This is the
// officially documented and correct way to access dynamic route parameters
// in an async Server Component, which solves the rendering lifecycle error.
export default async function JobStatusPage({
  params,
}: {
  params: {jobId: string};
}) {
  const {jobId} = params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/signin");
  }

  const job = await prisma.transcriptionJob.findFirst({
    where: {
      id: jobId,
      userId: userId,
    },
  });
  // --- END FIX ---

  if (!job) {
    return (
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold text-red-500">Job Not Found</h1>
        <p className="text-slate-500">
          The requested transcription job does not exist or you do not have
          permission to view it.
        </p>
      </div>
    );
  }

  return <JobStatusClientPage initialJob={job} />;
}
