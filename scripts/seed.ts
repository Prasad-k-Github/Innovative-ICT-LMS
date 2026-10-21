// පළමු Admin ගිණුම සහ ආයතන ලැයිස්තුව සාදයි.  භාවිතය:  npm run db:seed
import "./env"; // පළමුවෙන්ම (.env.local පූරණය කිරීමට)
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { institutes, lessons, users } from "../src/db/schema";
import { CURRICULUM } from "../src/db/curriculum";
import { CLASS_LOCATIONS } from "../src/lib/constants";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL සකසා නැත");

  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(".env.local හි ADMIN_EMAIL සහ ADMIN_PASSWORD සකසන්න");
  }
  if (/වෙනස්|example|changeme|password/i.test(password)) {
    throw new Error("ADMIN_PASSWORD තවමත් උදාහරණ අගයයි. ශක්තිමත්, අද්විතීය මුරපදයක් සකසන්න");
  }
  if (password.length < 10) {
    throw new Error("ADMIN_PASSWORD අවම වශයෙන් අක්ෂර 10ක් විය යුතුයි");
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    // ගුරුවරයාගේ ගිණුම Super Admin බවට පත් කරයි (පැරණි ADMIN ගිණුම් සඳහා)
    if (existing.role === "ADMIN") await db.update(users).set({ role: "SUPER_ADMIN" }).where(eq(users.id, existing.id));
    console.log(`Super Admin දැනටමත් ඇත: ${email} (මුරපදය වෙනස් කළේ නැත)`);
  } else {
    await db.insert(users).values({
      name: process.env.ADMIN_NAME ?? "Admin",
      school: "-",
      grade: 0,
      phone: "-",
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      emailVerified: new Date(),
    });
    console.log(`Super Admin සාදන ලදී: ${email}`);
  }

  // පන්ති ස්ථාන (src/lib/constants.ts). පසුව Admin Panel එකෙන් වෙනස් කළ හැක
  const names = CLASS_LOCATIONS.map((c) => c.name);
  for (const name of names) {
    await db.insert(institutes).values({ name }).onConflictDoNothing();
  }
  console.log(`ආයතන: ${names.join(", ")}`);

  // ශ්‍රේණි 6 - 11 පාඩම් (පෙළපොත් පරිච්ඡේද). නැවත run කළත් අනුපිටපත් නොසැදේ,
  // Admin විසින් සංස්කරණය කළ පාඩම් වලට බලපෑමක් නැත.
  let added = 0;
  for (const c of CURRICULUM) {
    for (const [i, title] of c.titles.entries()) {
      const r = await db
        .insert(lessons)
        .values({ title, grade: c.grade, medium: c.medium, order: i + 1 })
        .onConflictDoNothing()
        .returning({ id: lessons.id });
      added += r.length;
    }
  }
  console.log(`පාඩම් අලුතින් එක් කළ ගණන: ${added}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
