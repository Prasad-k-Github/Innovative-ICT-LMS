// scripts/seed.ts හි පළමුවෙන්ම import කරයි, එවිට src/db පූරණය වීමට පෙර .env.local කියවේ
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
