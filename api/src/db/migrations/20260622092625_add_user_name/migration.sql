-- Add optional display name for auth responses and signup.
ALTER TABLE "public"."users"
ADD COLUMN IF NOT EXISTS "name" TEXT;
