import { PrismaClient, PlatformAdminStatus } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || "Platform Administrator";

  if (!email || !password) {
    throw new Error("PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD are required for platform bootstrap");
  }

  const existing = await prisma.platformAdmin.findUnique({ where: { email } });
  if (existing) {
    await prisma.platformAdmin.update({
      where: { id: existing.id },
      data: { name, status: PlatformAdminStatus.ACTIVE },
    });
    console.log(`Platform administrator ${email} is ready`);
    return;
  }

  await prisma.platformAdmin.create({
    data: {
      email,
      name,
      status: PlatformAdminStatus.ACTIVE,
      passwordHash: await hash(password),
    },
  });
  console.log(`Platform administrator ${email} created`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
