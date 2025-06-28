// app/dashboard/DashboardClientPage.tsx
"use client";

import {useState} from "react";
import type {TranscriptionJob} from "@prisma/client";
import Link from "next/link";
import {
  FileText,
  Link2,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  PlusCircle,
} from "lucide-react";
import {deleteJobAction} from "@/actions/jobActions";
import StyledButton from "@/components/StyledButton";
import Modal from "@/components/Modal";
import RelativeTimestamp from "@/components/RelativeTimestamp"; // Import our new component

function StatusIcon({status}: {status: string}) {
  const commonClasses = "h-5 w-5";
  switch (status) {
    case "PENDING":
      return <Clock className={`${commonClasses} text-yellow-500`} />;
    case "PROCESSING":
      return (
        <Clock className={`${commonClasses} text-sky-500 animate-spin-slow`} />
      );
    case "COMPLETED":
      return <CheckCircle2 className={`${commonClasses} text-green-500`} />;
    case "FAILED":
      return <XCircle className={`${commonClasses} text-red-500`} />;
    default:
      return null;
  }
}

export default function DashboardClientPage({
  jobs,
}: {
  jobs: TranscriptionJob[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<TranscriptionJob | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openDeleteModal = (job: TranscriptionJob) => {
    setJobToDelete(job);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!jobToDelete) return;
    setIsDeleting(true);
    await deleteJobAction(jobToDelete.id);
    setIsDeleting(false);
    setIsModalOpen(false);
    setJobToDelete(null);
  };

  return (
    <>
      <div className="w-full max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8 border-b border-slate-200 dark:border-slate-700 pb-5">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
            My Transcriptions
          </h1>
          <Link href="/" passHref>
            <StyledButton variant="primary">
              <PlusCircle size={20} className="mr-2" />
              New Transcription
            </StyledButton>
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md">
          {jobs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <p>You haven&apos;t created any transcriptions yet.</p>
              <p className="mt-2 text-sm">
                Click &quot;New Transcription&quot; to get started.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {jobs.map((job) => (
                // --- THIS IS THE FIX for the hydration warning ---
                <li
                  key={job.id}
                  className="group transition-colors duration-150"
                  suppressHydrationWarning
                >
                  <div className="flex items-center space-x-4 p-4 sm:p-6">
                    {/* ... rest of the content ... */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/dashboard/job/${job.id}`}
                        className="focus:outline-none"
                      >
                        <span className="absolute inset-0" aria-hidden="true" />
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Created <RelativeTimestamp date={job.createdAt} />
                        </p>
                      </Link>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        <StatusIcon status={job.status} />
                        <span>{job.status}</span>
                      </div>
                      <StyledButton
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => openDeleteModal(job)}
                      >
                        <Trash2
                          size={18}
                          className="text-slate-500 hover:text-red-500"
                        />
                      </StyledButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Delete Transcription?"
      >
        {jobToDelete && (
          <div>
            <p className="text-slate-600 dark:text-slate-300">
              Are you sure you want to permanently delete the transcription for:
            </p>
            <p className="my-4 font-semibold break-all">
              {jobToDelete.sourceFileName}
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 p-3 rounded-md">
              This action cannot be undone. The source file in storage will also
              be deleted.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <StyledButton
                variant="secondary"
                onClick={() => setIsModalOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </StyledButton>
              <StyledButton
                variant="danger"
                onClick={handleDelete}
                isLoading={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </StyledButton>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
