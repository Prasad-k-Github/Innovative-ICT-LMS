// drizzle නව අනුවාද වල pg error එක `cause` තුළ ඇත
export function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}
