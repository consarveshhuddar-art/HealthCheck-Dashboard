import { Suspense } from "react";
import { DashboardTopNav } from "@/components/DashboardTopNav";
import { PrE2eGlobalBar } from "@/components/prE2e/PrE2eGlobalBar";
import { PrE2eSubNav } from "@/components/prE2e/PrE2eSubNav";
import {
  getCredentialAlertCounts,
  isCredentialExpiryTableAvailable,
} from "@/lib/credentials";
import { dashboardUi } from "@/lib/dashboardUi";
import { isHealthCheckMysqlConfigured } from "@/lib/mysql/server";

export default async function PrChecksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dbReady = isHealthCheckMysqlConfigured();
  const credTableReady = dbReady
    ? await isCredentialExpiryTableAvailable()
    : false;
  const alerts =
    dbReady && credTableReady ? await getCredentialAlertCounts() : null;

  return (
    <>
      <div className={`${dashboardUi.content} pb-0`}>
        <div className="mb-4 flex flex-col gap-3">
          <DashboardTopNav alerts={alerts} />
          <Suspense fallback={null}>
            <PrE2eSubNav />
          </Suspense>
          <Suspense fallback={null}>
            <PrE2eGlobalBar />
          </Suspense>
        </div>
      </div>
      {children}
    </>
  );
}
