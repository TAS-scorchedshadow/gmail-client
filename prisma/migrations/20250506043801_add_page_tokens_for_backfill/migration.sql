/*
  Warnings:

  - Added the required column `text` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "text" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastHistoryId" TEXT,
ADD COLUMN     "nextPageToken" TEXT;
