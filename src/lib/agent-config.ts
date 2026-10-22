// ICT Agent සැකසුම් (client-safe: server-only නොවේ)
export const AGENT_NAME = "ICT මිතුරා";
export const AGENT_MAX_CHARS = 600; // එක් පණිවිඩයක උපරිම අකුරු
export const AGENT_HISTORY_LIMIT = 60; // තිරයේ පෙන්වන පණිවිඩ ගණන
export const AGENT_CONTEXT_MESSAGES = 10; // AI එකට යවන පෙර පණිවිඩ ගණන
// සියලුම සිසුන්ට නොමිලේ ලැබෙන credits (AGENT_FREE_CREDITS env මගින් වෙනස් කළ හැක). 1 පණිවිඩයක් = credit 1
export const DEFAULT_FREE_CREDITS = 40;
export const AGENT_MAX_GRANT = 500;

// ඇමුණුම් (ඡායාරූප / PDF). Server action body සීමාව 5MB නිසා මුළු ප්‍රමාණය 4MB ට සීමා කරයි
export const AGENT_MAX_FILES = 3;
export const AGENT_MAX_IMAGE_BYTES = 1_500_000; // browser එකේදී JPEG ලෙස පොඩි කරයි
export const AGENT_MAX_PDF_BYTES = 3_000_000;
export const AGENT_MAX_TOTAL_BYTES = 4_000_000;
export const AGENT_FILE_COST = 2; // ඇමුණුම් සහිත පණිවිඩයක credits (PDF/ඡායාරූප විශ්ලේෂණය වියදම් වැඩි නිසා)
export const AGENT_FULL_PATH = "/dashboard/agent";
