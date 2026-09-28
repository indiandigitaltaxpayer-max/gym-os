CREATE TYPE "Gender" AS ENUM ('M', 'F');

ALTER TABLE "Member"
ADD COLUMN "heightCm" INTEGER,
ADD COLUMN "weightKg" DOUBLE PRECISION,
ADD COLUMN "genderNew" "Gender";

UPDATE "Member"
SET "genderNew" = CASE
  WHEN UPPER(TRIM("gender")) IN ('M', 'MALE') THEN 'M'::"Gender"
  WHEN UPPER(TRIM("gender")) IN ('F', 'FEMALE') THEN 'F'::"Gender"
  ELSE NULL
END
WHERE "gender" IS NOT NULL;

ALTER TABLE "Member" DROP COLUMN "gender";
ALTER TABLE "Member" RENAME COLUMN "genderNew" TO "gender";
