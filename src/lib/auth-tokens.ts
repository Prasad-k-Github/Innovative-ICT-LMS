import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { authTokens } from "@/db/schema";
import { generateToken, hashToken } from "./crypto";

type TokenType = "VERIFY_EMAIL" | "RESET_PASSWORD";

// අලුත් token එකක් සාදයි (පරණ ඒවා ඉවත් කර). Raw token එක email එකෙන් යැවීමට ආපසු දෙයි.
export async function issueToken(userId: string, type: TokenType, hours: number) {
  const token = generateToken();
  await db
    .delete(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.type, type)));
  await db.insert(authTokens).values({
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
  });
  return token;
}

export async function findValidToken(token: string | null | undefined, type: TokenType) {
  if (!token || token.length < 10) return null;
  const [row] = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(token)),
        eq(authTokens.type, type),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function consumeTokens(userId: string, type: TokenType) {
  await db
    .delete(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.type, type)));
}
