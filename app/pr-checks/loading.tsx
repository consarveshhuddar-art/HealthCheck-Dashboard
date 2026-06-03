import { RouteLoader } from "@/components/RouteLoader";
import { dashboardUi } from "@/lib/dashboardUi";

export default function PrChecksLoading() {
  return (
    <div className={`${dashboardUi.content} py-16`}>
      <RouteLoader variant="page" />
    </div>
  );
}
