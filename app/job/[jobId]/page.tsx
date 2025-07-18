import prisma from "@/lib/prisma";
import {auth} from "@/lib/auth";
import {redirect} from "next/navigation";
import JobResultPage from "./JobResultPage";

export default async function JobPage({params}: {params: {jobId: string}}) {
  const {jobId} = params;
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const job = await prisma.transcriptionJob.findFirst({
    where: {id: jobId, userId: session.user.id},
  });

  if (!job) {
    return <div className="p-8 text-center">Job Not Found.</div>;
  }
  // It no longer needs to render any layout itself.
  return <JobResultPage job={job} />;
}
