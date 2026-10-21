// ඉතා පොදු / පහසුවෙන් අනුමාන කළහැකි මුරපද (කුඩා අකුරින්). Credential-stuffing සහ dictionary ප්‍රහාර අඩු කරයි.
const COMMON = new Set(
  `password password1 password12 password123 password1234 passw0rd p@ssw0rd p@ssword1 pass1234 qwerty123 qwerty1234 qwertyuiop1 1qaz2wsx 1q2w3e4r 1q2w3e4r5t zaq12wsx abc12345 abcd1234 abcd12345 abc123456 a1b2c3d4 letmein123 welcome1 welcome12 welcome123 admin123 admin1234 admin12345 administrator1 iloveyou1 iloveyou123 monkey123 dragon123 football1 football123 baseball1 master123 sunshine1 princess1 superman1 batman123 trustno1 changeme123 changeme1 test1234 test12345 guest1234 user1234 student123 student1234 school123 school1234 teacher123 ict12345 ict123456 ictclass1 innovativeict1 innovative123 srilanka123 srilanka1 colombo123 kandy1234 12345678a a12345678 a123456789 123456789a 1234567890a 987654321a qwerty12345 asdfghjkl1 asdf1234 asdf12345 zxcvbnm123 zxcv1234 00000000a 11111111a 0123456789a`
    .split(/\s+/),
);

export const WEAK_PASSWORD_MESSAGE = "මෙම මුරපදය ඉතා පොදු හෝ පහසුවෙන් අනුමාන කළ හැකියි. වෙනත් මුරපදයක් තෝරන්න.";

// පොදු මූල වචන (පසුපස ඉලක්කම්/සංකේත පමණක් එකතු කළ ඒවා: "Password123", "Qwerty123456")
const COMMON_BASES = new Set(
  `password passw0rd p@ssword p@ssw0rd qwerty qwertyuiop qwertyui asdf asdfgh asdfghjkl zxcv zxcvbn zxcvbnm letmein welcome admin administrator iloveyou monkey dragon football baseball master sunshine princess superman batman trustno changeme test guest user student school teacher innovative ict ictclass srilanka colombo kandy abc abcd abcdef login secret default root`.split(/\s+/),
);

export function isWeakPassword(pw: string): boolean {
  const p = pw.toLowerCase();
  if (COMMON.has(p)) return true;
  if (new Set(p).size <= 3) return true; // aaaaaaaa, 1111aaaa
  // පොදු මූල වචනයක් + ඉලක්කම්/සංකේත පමණක්
  const base = p.replace(/^[^a-z]+/, "");
  for (const w of COMMON_BASES) {
    if (base.startsWith(w) && !/[a-z]/.test(base.slice(w.length))) return true;
  }
  // අකුරු/ඉලක්කම් වල සරල අනුපිළිවෙල: abcdefgh12 වැනි
  const stripped = p.replace(/[^a-z0-9]/g, "");
  const seq = "abcdefghijklmnopqrstuvwxyz0123456789";
  let run = 1, maxRun = 1;
  for (let i = 1; i < stripped.length; i++) {
    const d = seq.indexOf(stripped[i]) - seq.indexOf(stripped[i - 1]);
    run = d === 1 ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
  }
  return maxRun >= 6 && stripped.length - maxRun <= 5;
}
