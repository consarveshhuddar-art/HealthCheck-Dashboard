import { RouteLoader } from "@/components/RouteLoader";
import { dashboardUi } from "@/lib/dashboardUi";

/** Shown while the home route RSC payload is loading (initial load, reload, filter navigations). */
export default function Loading() {
  return (
    <div
      className={`${dashboardUi.pageShell} min-h-screen bg-[#F6F8FB]`}
    >
      <div
        className={`${dashboardUi.content} flex min-h-[min(100dvh,100vh)] flex-1 flex-col items-center justify-center py-20`}
      >
        <RouteLoader />
      </div>
    </div>
  );
}
