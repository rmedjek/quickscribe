// app/dashboard/page.tsx
import {PrismaClient} from "@prisma/client";
import {auth} from "@/lib/auth";
import {redirect} from "next/navigation";
import Link from "next/link";
import {FileText, Link2, Clock, CheckCircle2, XCircle} from "lucide-react";

const prisma = new PrismaClient();

// A simple helper to format dates
function formatDate(date: Date | null) {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// A helper to get a status icon
function StatusIcon({status}: {status: string}) {
  switch (status) {
    case "PENDING":
    case "PROCESSING":
      return <Clock className="h-5 w-5 text-yellow-500" />;
    case "COMPLETED":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "FAILED":
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return null;
  }
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    // This should not happen due to middleware, but it's a good safeguard.
    redirect("/signin");
  }

  const jobs = await prisma.transcriptionJob.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          My Transcriptions
        </h1>
        <Link
          href="/"
          className="bg-sky-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-sky-700 transition-colors"
        >
          New Transcription
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <p>You haven&apos;t created any transcriptions yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/dashboard/job/${job.id}`}
                  className="block hover:bg-slate-50 dark:hover:bg-slate-700/50 p-4 sm:p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-sky-600 dark:text-sky-400 truncate flex items-center">
                        {job.sourceFileHash ? (
                          <FileText className="h-4 w-4 mr-2" />
                        ) : (
                          <Link2 className="h-4 w-4 mr-2" />
                        )}
                        {job.sourceFileName}
                      </p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Created: {formatDate(job.createdAt)}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0 flex flex-col items-end">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={job.status} />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {job.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {job.engineUsed?.toUpperCase()} Mode
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
