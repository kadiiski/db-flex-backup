export const dynamic = "force-dynamic";

import { Suspense } from "react";
import HomePageClient from "@/app/HomePageClient";

export default function HomePage() {
  const pageTitle = process.env.BACKUPS_UI_TITLE || "Database Backups";
  const retention = process.env.RETENTION_COUNT!;
  const cronSchedule = process.env.CRON_SCHEDULE!;
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePageClient pageTitle={pageTitle} retention={retention} cronSchedule={cronSchedule} />
    </Suspense>
  );
}
