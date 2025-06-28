// app/dashboard/layout.tsx
import {PrismaClient} from "@prisma/client";
import {auth} from "@/lib/auth";
import {redirect} from "next/navigation";
import HistorySidebar from "@/components/HistorySidebar";
import UserNav from "@/components/UserNav";
import DarkModeToggle from "@/components/DarkModeToggle";

const prisma = new PrismaClient();

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  // Fetch all jobs for the user to pass to the sidebar
  const jobs = await prisma.transcriptionJob.findMany({
    where: {userId: session.user.id},
    orderBy: {createdAt: "desc"},
  });

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900">
      {/* Collapsible Sidebar */}
      <HistorySidebar jobs={jobs} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen">
        {/* Header for the main content */}
        <header className="flex h-16 items-center justify-end gap-4 border-b bg-white dark:bg-slate-800/50 px-6">
          <UserNav />
          <DarkModeToggle />
        </header>

        {/* The actual page content will be rendered here */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
