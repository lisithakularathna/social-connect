-- Fix cascade delete for Post relations

-- Drop existing constraints
ALTER TABLE "postLike" DROP CONSTRAINT IF EXISTS "postLike_postId_fkey";
ALTER TABLE "comment" DROP CONSTRAINT IF EXISTS "comment_postId_fkey";

-- Re-add constraints with CASCADE
ALTER TABLE "postLike" 
  ADD CONSTRAINT "postLike_postId_fkey" 
  FOREIGN KEY ("postId") 
  REFERENCES "post"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;

ALTER TABLE "comment" 
  ADD CONSTRAINT "comment_postId_fkey" 
  FOREIGN KEY ("postId") 
  REFERENCES "post"("id") 
  ON DELETE CASCADE 
  ON UPDATE CASCADE;
