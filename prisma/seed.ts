import "dotenv/config"; 

import { PrismaClient, Environment, EventStatus, RoleName } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!, // uses your docker URL from .env
});

const prisma = new PrismaClient({ adapter });

const EVENT_TYPES = [
  "report.generated",
  "user.login",
  "user.invited",
  "export.created",
  "sync.completed",
  "sync.failed",
];

const SOURCES = ["web", "api", "worker", "cron", "importer"];

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  // Roles
  for (const name of [RoleName.admin, RoleName.analyst, RoleName.viewer]) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }

  const [adminRole, analystRole, viewerRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: RoleName.admin } }),
    prisma.role.findUniqueOrThrow({ where: { name: RoleName.analyst } }),
    prisma.role.findUniqueOrThrow({ where: { name: RoleName.viewer } }),
  ]);

  // Known admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { email: "admin@example.com", displayName: "Admin User", isActive: true },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  // Additional users
  for (let i = 0; i < 15; i++) {
    const u = await prisma.user.create({
      data: {
        email: faker.internet.email().toLowerCase(),
        displayName: faker.person.fullName(),
        isActive: faker.datatype.boolean(0.9),
      },
    });

    const role = pick([analystRole, viewerRole]);
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id } });
  }

  // Events: 5000 across 60 days
  const total = 5000;
  const days = 60;
  const now = new Date();
  const envs: Environment[] = [Environment.dev, Environment.staging, Environment.prod];

  const batchSize = 500;
  for (let created = 0; created < total; created += batchSize) {
    const count = Math.min(batchSize, total - created);

    const data = Array.from({ length: count }).map(() => {
      const daysAgo = faker.number.int({ min: 0, max: days });
      const occurredAt = faker.date.between({
        from: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
        to: now,
      });

      const status = faker.datatype.boolean(0.82) ? EventStatus.ok : EventStatus.error;

      return {
        occurredAt,
        environment: pick(envs),
        type: pick(EVENT_TYPES),
        status,
        source: pick(SOURCES),
        durationMs: faker.number.int({ min: 10, max: 3500 }),
        payload: {
          requestId: faker.string.uuid(),
          userAgent: faker.internet.userAgent(),
          tags: faker.helpers.arrayElements(["billing", "reports", "auth", "sync", "ui"], { min: 1, max: 3 }),
          errorCode: status === EventStatus.error ? pick(["E_TIMEOUT", "E_BAD_INPUT", "E_DOWNSTREAM"]) : null,
        },
      };
    });

    await prisma.event.createMany({ data });
  }

  console.log("Seed complete. Admin: admin@example.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
