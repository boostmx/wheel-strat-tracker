-- AlterTable
ALTER TABLE "WatchlistItem" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows: assign order based on createdAt within each user
UPDATE "WatchlistItem" w
SET "order" = subq.row_num
FROM (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt") - 1) AS row_num
  FROM "WatchlistItem"
) subq
WHERE w.id = subq.id;
