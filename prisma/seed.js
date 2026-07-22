import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const highland = await db.location.upsert({ where: { name: "Highland Shell" }, update: {}, create: { name: "Highland Shell" } });
  const delRosa = await db.location.upsert({ where: { name: "Del Rosa Shell" }, update: {}, create: { name: "Del Rosa Shell" } });

  const defaultHash = await bcrypt.hash("changeme123", 10);

  const roster = [
    { name: "Melissa", phone: "+19095550101", locations: [highland], role: "MANAGER" },
    { name: "Isha", phone: "+19095550102", locations: [highland] },
    { name: "Michelle", phone: "+19095550103", locations: [highland] },
    { name: "Alondra", phone: "+19095550104", locations: [highland] },
    { name: "Kimberly", phone: "+19095550105", locations: [highland] },
    { name: "Ali", phone: "+19095550106", locations: [highland, delRosa] },
    { name: "Andrew", phone: "+19095550107", locations: [highland, delRosa] },
    { name: "Bilal", phone: "+19095550108", locations: [delRosa] },
    { name: "Rohanth", phone: "+19095550109", locations: [delRosa] },
    { name: "Salik", phone: "+19095550110", locations: [highland, delRosa] },
    { name: "Shoeb", phone: "+19095550111", locations: [highland, delRosa] },
  ];

  for (const r of roster) {
    await db.employee.upsert({
      where: { phone: r.phone },
      update: {},
      create: {
        name: r.name,
        phone: r.phone,
        passwordHash: defaultHash,
        role: r.role || "EMPLOYEE",
        locations: { connect: r.locations.map((l) => ({ id: l.id })) },
      },
    });
  }

  console.log("Seeded roster. Everyone's temp password is 'changeme123' — have each person change it on first login.");
  console.log("Melissa was set up as the manager account. Adjust in the DB if that's wrong.");
}

main().finally(() => db.$disconnect());
