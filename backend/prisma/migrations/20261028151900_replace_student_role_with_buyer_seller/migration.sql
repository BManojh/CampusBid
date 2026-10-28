-- Replace the original student role with explicit marketplace roles.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('BUYER', 'SELLER', 'ADMIN');

ALTER TABLE "User"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "UserRole"
    USING (
      CASE
        WHEN "role"::text = 'ADMIN' THEN 'ADMIN'::"UserRole"
        ELSE 'BUYER'::"UserRole"
      END
    ),
  ALTER COLUMN "role" SET DEFAULT 'BUYER';

DROP TYPE "UserRole_old";
