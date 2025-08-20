// app/changelog/page.tsx
import { getChangelogSorted } from "@/data/changelog";
import ChangelogList from "@/features/changelog/components/ChangelogList";

export const metadata = {
  title: "Changelog",
  description: "Release notes and updates",
};

export default function ChangelogPage() {
  const items = getChangelogSorted();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Changelog</h1>
      <ChangelogList items={items} />
    </div>
  );
}
