// ICT Agent සැකසුම් (client-safe: server-only නොවේ)
export const AGENT_NAME = "ICT මිතුරා";
export const AGENT_MAX_CHARS = 600; // එක් පණිවිඩයක උපරිම අකුරු
export const AGENT_HISTORY_LIMIT = 60; // තිරයේ පෙන්වන පණිවිඩ ගණන
export const AGENT_CONTEXT_MESSAGES = 10; // AI එකට යවන පෙර පණිවිඩ ගණන
// සියලුම සිසුන්ට නොමිලේ ලැබෙන credits (AGENT_FREE_CREDITS env මගින් වෙනස් කළ හැක). 1 පණිවිඩයක් = credit 1
export const DEFAULT_FREE_CREDITS = 40;
export const AGENT_MAX_GRANT = 500;
