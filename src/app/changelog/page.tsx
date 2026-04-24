import { getChangelogSorted, getLatestVersion } from "@/data/changelog";
import ChangelogList from "@/features/changelog/components/ChangelogList";

export const metadata = {
  title: "Changelog",
  description: "Release notes and updates",
};

export default function ChangelogPage() {
  const items = getChangelogSorted();
  const version = getLatestVersion();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <div className="flex items-baseline gap-2.5 mb-1">
          <h1 className="text-2xl font-semibold tracking-tight">What&apos;s New</h1>
          <span className="font-mono text-sm text-muted-foreground">{version}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Release history and updates for Wheel Strat Tracker.
        </p>
      </div>

      <ChangelogList items={items} initialVisibleCount={4} showToggle={true} />
    </div>
  );
}
