import "server-only";
import { AGENT_MAX_FILES, AGENT_MAX_IMAGE_BYTES, AGENT_MAX_PDF_BYTES, AGENT_MAX_TOTAL_BYTES } from "@/lib/agent-config";

export type AgentUpload = { filename: string; mime: string; size: number; data: Buffer };

// ගොනුවේ සැබෑ වර්ගය (magic bytes) හඳුනාගනී; නමට / client දෙන mime එකට විශ්වාස නොකරයි
export function detectAgentMime(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf" | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (b.length > 12 && /^GIF8[79]a/.test(b.subarray(0, 6).toString("latin1"))) return "image/gif";
  if (b.length > 8 && b.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}

const cleanName = (n: string) => (n.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f<>"|?*]/g, "").trim().slice(0, 80) || "file";

export async function readUploads(formData: FormData): Promise<{ files: AgentUpload[] } | { error: string }> {
  const raw = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (raw.length > AGENT_MAX_FILES) return { error: "එක් පණිවිඩයකට ගොනු 3ක් දක්වා පමණක් එක් කළ හැක." };
  const files: AgentUpload[] = [];
  let total = 0;
  for (const f of raw) {
    if (f.size > AGENT_MAX_PDF_BYTES) return { error: "ගොනුව විශාලයි. ඡායාරූප 1.5MB ට සහ PDF 3MB ට අඩු විය යුතුයි." };
    const data = Buffer.from(await f.arrayBuffer());
    const mime = detectAgentMime(data);
    if (!mime) return { error: "ඡායාරූප (JPG, PNG, WebP, GIF) සහ PDF ගොනු පමණක් එක් කළ හැක." };
    if (mime !== "application/pdf" && data.length > AGENT_MAX_IMAGE_BYTES) return { error: "ගොනුව විශාලයි. ඡායාරූප 1.5MB ට සහ PDF 3MB ට අඩු විය යුතුයි." };
    total += data.length;
    files.push({ filename: cleanName(f.name), mime, size: data.length, data });
  }
  if (total > AGENT_MAX_TOTAL_BYTES) return { error: "ගොනු වල මුළු ප්‍රමාණය 4MB ට වඩා වැඩියි." };
  return { files };
}
