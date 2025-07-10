import { Suspense } from "react";
import HomePageClient from "@/app/HomePageClient";

export default function HomePage() {
  const pageTitle = process.env.BACKUPS_UI_TITLE || "Database Backups";
  const retention = process.env.RETENTION_COUNT || "7";
  const cronSchedule = process.env.CRON_SCHEDULE || "0 0 * * *";
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePageClient pageTitle={pageTitle} retention={retention} cronSchedule={cronSchedule} />
    </Suspense>
  );
}
