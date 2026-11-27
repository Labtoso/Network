import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { ROOT_DIR } from "./config.js";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.join(ROOT_DIR, "data", "network.db")}`;
}

export const prisma = new PrismaClient();
