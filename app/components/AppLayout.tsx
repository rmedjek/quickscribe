// app/components/AppLayout.tsx
import prisma from "@/lib/prisma";
import {auth} from "@/lib/auth";
import {PageProvider} from "@/app/contexts/PageContext";
import HistorySidebar from "./HistorySidebar";
import DynamicHeader from "./DynamicHeader";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const jobs = session?.user?.id
    ? await prisma.transcriptionJob.findMany({
        where: {userId: session.user.id, status: "COMPLETED"},
        orderBy: {createdAt: "desc"},
      })
    : [];

  return (
    <div className="h-full w-full overflow-hidden">
      <PageProvider>
        <div className="flex h-full w-full">
          <HistorySidebar jobs={jobs} />
          <div
            id="main-content-scroll-container"
            className="flex-1 overflow-y-auto"
          >
            <DynamicHeader />
            <main>{children}</main>
          </div>
        </div>
      </PageProvider>
    </div>
  );
}
