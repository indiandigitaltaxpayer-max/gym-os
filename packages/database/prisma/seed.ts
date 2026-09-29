import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";
import { ROLE_PERMISSIONS, RoleName } from "../src/permissions.ts";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "pulse-fitness" },
    update: {},
    create: { id: "tenant_pulse_demo", name: "Pulse Fitness", slug: "pulse-fitness", status: "ACTIVE" },
  });
  const branch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "HQ" } },
    update: {},
    create: { tenantId: tenant.id, name: "Indiranagar", code: "HQ", address: "Bengaluru" },
  });
  await prisma.membershipPlan.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Quarterly Unlimited" } },
    update: {},
    create: { tenantId: tenant.id, name: "Quarterly Unlimited", durationDays: 90, priceMinor: 899900, taxRateBps: 1800 },
  });
  await prisma.membershipPlan.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Annual Unlimited" } },
    update: {},
    create: { tenantId: tenant.id, name: "Annual Unlimited", durationDays: 365, priceMinor: 2499900, taxRateBps: 1800 },
  });
  const roles = new Map<string, string>();
  for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: { permissions },
      create: { tenantId: tenant.id, name, permissions },
    });
    roles.set(name, role.id);
  }

  const ownerEmail = process.env.DEV_OWNER_EMAIL?.trim().toLowerCase();
  const ownerPassword = process.env.DEV_OWNER_PASSWORD;
  if (!ownerEmail || !ownerPassword) {
    throw new Error("DEV_OWNER_EMAIL and DEV_OWNER_PASSWORD are required for seeding");
  }
  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: ownerEmail } },
    update: { status: "ACTIVE", passwordHash: await hash(ownerPassword) },
    create: {
      tenantId: tenant.id,
      email: ownerEmail,
      name: "Pulse Owner",
      status: "ACTIVE",
      passwordHash: await hash(ownerPassword),
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: owner.id, roleId: roles.get(RoleName.OWNER)! } },
    update: {},
    create: { userId: owner.id, roleId: roles.get(RoleName.OWNER)! },
  });
  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId: owner.id, branchId: branch.id } },
    update: {},
    create: { userId: owner.id, branchId: branch.id },
  });

  const platformEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase()
    ?? (process.env.NODE_ENV === "production" ? undefined : ownerEmail);
  const platformPassword = process.env.PLATFORM_ADMIN_PASSWORD
    ?? (process.env.NODE_ENV === "production" ? undefined : ownerPassword);
  if (platformEmail && platformPassword) {
    await prisma.platformAdmin.upsert({
      where: { email: platformEmail },
      update: { status: "ACTIVE", passwordHash: await hash(platformPassword) },
      create: {
        email: platformEmail,
        name: process.env.PLATFORM_ADMIN_NAME?.trim() || "Platform Administrator",
        status: "ACTIVE",
        passwordHash: await hash(platformPassword),
      },
    });
    console.log(`Seeded platform administrator ${platformEmail}`);
  } else {
    console.log("Skipped platform administrator seed; configure PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD");
  }
  console.log(`NEXT_PUBLIC_DEV_TENANT_ID=${tenant.id}`);
  console.log(`Seeded branch ${branch.name} (${branch.id})`);
  console.log(`Seeded owner ${owner.email}`);
}

main().finally(() => prisma.$disconnect());
