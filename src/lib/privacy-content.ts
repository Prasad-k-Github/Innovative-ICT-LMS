// පෞද්ගලිකත්ව ප්‍රතිපත්තියේ අන්තර්ගතය (සිංහල + English).
// සටහන: මෙය සාමාන්‍ය ආකෘතියකි. Launch කිරීමට පෙර නීතිඥයෙකුගෙන් පරීක්ෂා කරවා, ඔබේ සැබෑ තොරතුරු (සම්බන්ධතා, රඳවා ගැනීමේ කාලය, භාවිතා කරන සේවා) සමඟ ගැළපෙන්නේදැයි තහවුරු කරගන්න.
// පද්ධතිය එකතු කරන දත්ත වෙනස් වූ විට (නව ක්ෂේත්‍ර, නව සේවා) මෙය සහ PRIVACY_VERSION යාවත්කාලීන කරන්න.

export type PrivacySection = {
  id: string;
  title: { si: string; en: string };
  paras?: { si: string; en: string }[];
  items?: { si: string; en: string }[];
  after?: { si: string; en: string }; // ලැයිස්තුවෙන් පසු අමතර වාක්‍යයක්
};

export const PRIVACY_INTRO = {
  si: "Innovative ICT හි ශිෂ්‍යයන්ගේ, විශේෂයෙන් ළමයින්ගේ, පෞද්ගලික තොරතුරු ආරක්ෂා කිරීම අපට වැදගත්ය. අප කුමන තොරතුරු එකතු කරන්නේද, ඒවා භාවිතා කරන්නේ ඇයි, කාටද පෙනෙන්නේ, ඔබට කළ හැක්කේ කුමක්ද යන්න මෙහි සරලව පැහැදිලි කර ඇත.",
  en: "Protecting the personal information of our students, especially children, matters to us. This page explains in plain language what we collect, why, who can see it and what you can do about it.",
};

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: "who",
    title: { si: "අප කවුද", en: "Who we are" },
    paras: [
      {
        si: "Innovative ICT යනු ICT ගුරුවරයෙකු වන Prasad K. Gamage විසින් පවත්වාගෙන යන, ශ්‍රේණි 6 සිට උසස් පෙළ දක්වා සිසුන් සඳහා වූ ඔන්ලයින් ඉගෙනුම් පද්ධතියකි. ඔබේ දත්ත සඳහා වගකියන්නේ ඔහුය (data controller).",
        en: "Innovative ICT is an online learning system for students from Grade 6 to A/L, run by ICT teacher Prasad K. Gamage. He is responsible for your data (the data controller).",
      },
    ],
  },
  {
    id: "collect",
    title: { si: "අප එකතු කරන තොරතුරු", en: "What we collect" },
    items: [
      {
        si: "ලියාපදිංචියේදී: නම, පාසල, ශ්‍රේණිය, මාධ්‍යය, (උසස් පෙළ සඳහා) විභාග වර්ෂය, දුරකතන අංකය, email ලිපිනය සහ පැමිණෙන ආයතනය.",
        en: "At registration: name, school, grade, medium, (for A/L) exam year, phone number, email address and the institute you attend.",
      },
      {
        si: "ගිණුම පිළිබඳ: ඔබට ලැබෙන index අංකය, මුරපදය (කිසිවෙකුට කියවිය නොහැකි සංකේතිත hash එකක් ලෙස පමණි), අවසන් login වේලාව, ඔබේ device එකේ IP ලිපිනය සහ browser විස්තර (ආරක්ෂාව සඳහා).",
        en: "About your account: the index number you receive, your password (stored only as an unreadable hash), last login time, and your device's IP address and browser details (for security).",
      },
      {
        si: "ඉගෙනුම් ක්‍රියාකාරකම්: quiz පිළිතුරු සහ ලකුණු, පැවරුම් සඳහා ඔබ upload කරන ගොනු, ඔබට ලැබෙන දැනුම්දීම්.",
        en: "Learning activity: quiz answers and scores, files you upload for assignments, and the notifications you receive.",
      },
      {
        si: "සංවාද මණ්ඩපය සහ chat හි ඔබ ලියන පණිවිඩ.",
        en: "Messages you write in the discussion forum and chat.",
      },
      {
        si: "ICT මිතුරා (AI) සමඟ සංවාද: ඔබ අසන ප්‍රශ්න, ඔබ යවන ඡායාරූප හෝ PDF ගොනු සහ ලැබෙන පිළිතුරු.",
        en: "Conversations with the ICT Buddy (AI): the questions you ask, photos or PDF files you send, and the replies you receive.",
      },
      {
        si: "ඔබ කැමති නම් පමණක්: ප්‍රොෆයිල් ඡායාරූපය සහ Landing page එකේ පෙන්වීමට ඔබ ලියන අදහසක්.",
        en: "Only if you choose to: a profile photo and an opinion you write to be shown on the landing page.",
      },
      {
        si: "දෙමාපියන්ගේ දුරකතන අංකය (අනිවාර්යයි) සහ email ලිපිනය (විකල්ප), සහ සතිපතා ප්‍රගති සාරාංශය දෙමාපියන්ට දැනුම් දීම පන්තියේ ක්‍රියාපටිපාටියක් බව ඔබ දන්නා බවට තහවුරු කිරීම (දිනය සහිතව). පාඩම් බැලීම් (කුමන පාඩම් කවදා බැලුවාද යන්න) ද ප්‍රගතිය පෙන්වීමට සටහන් කරයි.",
        en: "Your parents' phone number (required) and email address (optional), and your confirmation that you know weekly progress summaries are shared with parents as a class procedure (with the date). We also record which lessons you open and when, to show your progress.",
      },
      {
        si: "ඔබ ලියාපදිංචි වන විට මෙම ප්‍රතිපත්තියට (සහ වයස 18ට අඩු නම් දෙමාපිය/භාරකරුගේ අවසරයට) එකඟ වූ බවට සාක්ෂියක් (දිනය සහ ප්‍රතිපත්ති අනුවාදය).",
        en: "A record that you agreed to this policy (and to parent/guardian permission, if under 18) when you registered: the date and policy version.",
      },
    ],
  },
  {
    id: "use",
    title: { si: "අප ඒවා භාවිතා කරන්නේ ඇයි", en: "Why we use it" },
    items: [
      { si: "ඔබේ ගිණුම සෑදීමට, ඔබ හඳුනාගැනීමට සහ ඔබේ ශ්‍රේණියට අදාළ පාඩම් සහ පැවරුම් ලබාදීමට.", en: "To create your account, identify you and give you the lessons and assignments for your grade." },
      { si: "පැවරුම් සහ quiz ලකුණු කිරීමට, ඔබේ ප්‍රගතිය නිරීක්ෂණයට සහ ඉගැන්වීම වැඩිදියුණු කිරීමට.", en: "To mark assignments and quizzes, follow your progress and improve teaching." },
      { si: "Email මගින් තහවුරු කේත, මුරපද සැකසුම් සහ වැදගත් දැනුම්දීම් යැවීමට.", en: "To send verification codes, password set-up links and important notices by email." },
      { si: "ගිණුම් ආරක්ෂා කිරීමට, අනවසර ප්‍රවේශ සහ අපයෝජන වැළැක්වීමට.", en: "To keep accounts safe and prevent unauthorised access and abuse." },
      { si: "දෙමාපියන්ට සතිපතා ප්‍රගති සාරාංශය (බැලූ පාඩම්, Quiz ලකුණු, පැවරුම්) WhatsApp හෝ Email මගින් දැනුම් දීමට. Email සාරාංශවල ඇති unsubscribe link එකෙන් Email ලැබීම නවත්වා ගත හැක.", en: "To tell your parents your weekly progress summary (lessons viewed, quiz marks, assignments) by WhatsApp or email. Email summaries contain an unsubscribe link to stop emails." },
      { si: "ගුරුවරයා ඔබේ ගිණුම සාදන්නේ නම්, ජනනය වන තාවකාලික මුරපදය (සුරකින්නේ සංකේතනය කළ hash එකක් පමණි; දින 14ක් වලංගුයි) ඔබට පමණක් දෙනු ලැබේ; පළමු login එකේදී ඔබටම අයත් මුරපදයක් සෑදිය යුතුයි.", en: "If the teacher creates your account, a temporary password is generated (only an encrypted hash is stored; valid 14 days) and given to you alone; you must set your own password at first login." },
    ],
    after: {
      si: "අපි ඔබේ දත්ත විකුණන්නේ නැත, දැන්වීම් සඳහා භාවිතා කරන්නේ නැත, ඔබව ලුහුබැඳීම් (tracking) සඳහා යොදාගන්නේ නැත.",
      en: "We do not sell your data, use it for advertising or track you.",
    },
  },
  {
    id: "see",
    title: { si: "ඔබේ තොරතුරු කාටද පෙනෙන්නේ", en: "Who can see your information" },
    items: [
      {
        si: "ගුරුතුමා සහ Admin ගිණුම්: ඔබේ ලියාපදිංචි විස්තර, පැවරුම්, quiz ප්‍රතිඵල සහ ICT මිතුරා සමඟ ඔබේ සංවාද (ඉගැන්වීම සහ ආරක්ෂාව සඳහා) බැලිය හැක.",
        en: "The teacher and admin accounts can see your registration details, assignments, quiz results and your conversations with the ICT Buddy (for teaching and safety).",
      },
      {
        si: "අනෙක් සිසුන්: සංවාද මණ්ඩපයේ සහ chat හි ඔබේ මුල් නම සහ ශ්‍රේණිය පමණි. ඔබේ සම්පූර්ණ නම, email, දුරකතන අංකය සහ ඡායාරූපය අනෙක් සිසුන්ට නොපෙනේ.",
        en: "Other students: only your first name and grade in the forum and chat. Your full name, email, phone number and photo are not visible to other students.",
      },
      {
        si: "ප්‍රසිද්ධියේ: Landing page එකේ පෙන්වන්නේ ඔබ එයට අවසර දී, ගුරුතුමා අනුමත කළ අදහසක් පමණි. ඒවායේ ඔබේ සම්පූර්ණ නම, email හෝ දුරකතන අංකය නොපෙන්වයි.",
        en: "Publicly: the landing page shows only an opinion you agreed to share and the teacher approved. It never shows your full name, email or phone number.",
      },
    ],
  },
  {
    id: "providers",
    title: { si: "අප භාවිතා කරන බාහිර සේවා", en: "Outside services we use" },
    paras: [
      {
        si: "පද්ධතිය ක්‍රියාත්මක කිරීමට අපි විශ්වාසදායක සේවා සපයන්නන් භාවිතා කරමු. ඔවුන් ඔබේ දත්ත සකසන්නේ අප වෙනුවෙන් පමණි. මෙම සේවාවල සේවාදායකයන් ශ්‍රී ලංකාවෙන් පිටත විය හැක.",
        en: "We use trusted service providers to run the system. They process your data only on our behalf. Their servers may be outside Sri Lanka.",
      },
    ],
    items: [
      { si: "වෙබ් අඩවිය ධාවනය (hosting) සහ දත්ත සමුදාය (database).", en: "Website hosting and the database." },
      { si: "ගොනු ගබඩාව (පැවරුම්, ඡායාරූප ආදිය).", en: "File storage (assignments, photos and so on)." },
      { si: "Email යැවීමේ සේවාව (තහවුරු කේත සහ දැනුම්දීම් සඳහා).", en: "The email service (for verification codes and notices)." },
      { si: "AI සේවාව (Anthropic): ICT මිතුරාට ඔබ යවන ප්‍රශ්න, ඡායාරූප සහ ගොනු පිළිතුරක් සෑදීමට එම සේවාවට යවයි. අපි භාවිතා කරන API සේවාවේ නියමයන් අනුව එම දත්ත ඔවුන්ගේ ආකෘති පුහුණුවට භාවිතා නොකෙරේ. ICT මිතුරාට ඔබේ දුරකතන අංකය, email වැනි පෞද්ගලික තොරතුරු නොයවන්න.",
        en: "The AI service (Anthropic): the questions, photos and files you send to the ICT Buddy are sent to this service to produce a reply. Under the terms of the API service we use, this data is not used to train their models. Please do not send personal details such as your phone number or email to the ICT Buddy." },
      { si: "Bot ලියාපදිංචි වීම් වැළැක්වීම (Cloudflare Turnstile): සක්‍රිය කර ඇති විට පමණි.", en: "Bot protection (Cloudflare Turnstile): only when it is switched on." },
    ],
  },
  {
    id: "children",
    title: { si: "ළමයින්ගේ දත්ත", en: "Children's data" },
    paras: [
      {
        si: "අපගේ සිසුන් බොහෝ දෙනා වයස 18ට අඩුය. ලියාපදිංචි වීමට පෙර දෙමාපියන්ගේ/භාරකරුගේ අවසරය ලබාගත යුතුය. ඔබේ දරුවා ගැන අප රඳවා ගන්නා තොරතුරු බැලීමට, නිවැරදි කිරීමට හෝ මකා දැමීමට දෙමාපියන්ට/භාරකරුවන්ට ඕනෑම වේලාවක පහත සම්බන්ධතා මගින් අපට දැනුම් දිය හැක.",
        en: "Most of our students are under 18. Parent or guardian permission must be obtained before registering. Parents and guardians can contact us at any time to see, correct or delete the information we hold about their child.",
      },
      {
        si: "අපි ළමයින්ගේ දත්ත දැන්වීම් සඳහා හෝ ඔවුන්ව ලුහුබැඳීමට භාවිතා නොකරමු.",
        en: "We never use children's data for advertising or tracking.",
      },
    ],
  },
  {
    id: "retention",
    title: { si: "දත්ත රඳවා ගන්නා කාලය", en: "How long we keep data" },
    items: [
      { si: "ඔබේ ගිණුම පවතින තාක් ඔබේ තොරතුරු රඳවා ගනිමු.", en: "We keep your information while your account exists." },
      {
        si: "ඔබට ඕනෑම වේලාවක ප්‍රොෆයිල් පිටුවෙන් (මුරපදය තහවුරු කර) ගිණුම මකා දැමිය හැක. එවිට ඔබේ ප්‍රොෆයිල්, පැවරුම්, පණිවිඩ, ICT මිතුරා සංවාද ඇතුළු දත්ත මැකේ.",
        en: "You can delete your account at any time from your profile page (after confirming your password). Your profile, assignments, messages and ICT Buddy conversations are then deleted.",
      },
      {
        si: "ආරක්ෂක ලොග් වල (කවුරුන් කවදා කුමන ක්‍රියාවක් කළාද යන වාර්තාව) සීමිත තොරතුරු (උදා: email ලිපිනය, වේලාව) ආරක්ෂාව සහ වංචා වැළැක්වීම සඳහා ගිණුම මැකූ පසුවත් රඳවා ගත හැක. උපස්ථ පිටපත් (backups) වලින් ඒවායේ රඳවා ගැනීමේ කාලය අවසන් වූ පසු දත්ත ඉවත් වේ.",
        en: "Security logs (a record of who did what and when) may keep limited details (for example your email address and the time) after deletion, to protect security and prevent fraud. Data is removed from backups once their retention period ends.",
      },
    ],
  },
  {
    id: "rights",
    title: { si: "ඔබේ අයිතිවාසිකම්", en: "Your rights" },
    items: [
      { si: "ඔබ ගැන අප රඳවා ගන්නා තොරතුරු බැලීමට ඉල්ලීම.", en: "Ask to see the information we hold about you." },
      { si: "වැරදි තොරතුරු නිවැරදි කිරීම: නම, පාසල සහ දුරකතන අංකය ප්‍රොෆයිල් පිටුවෙන්ම වෙනස් කළ හැක; ශ්‍රේණිය, මාධ්‍යය සහ ආයතනය වෙනස් කිරීමට ඉල්ලීමක් යවන්න.", en: "Correct wrong information: you can change your name, school and phone number on your profile page; send a request to change your grade, medium or institute." },
      { si: "ඔබේ දත්ත සියල්ල JSON file එකක් ලෙස බාගැනීම: ගිණුමේ \"මගේ දත්ත\" කොටසෙන් ඔබටම කළ හැක.", en: "Download all your data as a JSON file: you can do this yourself from the \"My data\" section of your account." },
      { si: "ගිණුම සහ දත්ත මකා දැමීම.", en: "Delete your account and data." },
      { si: "දෙමාපියන්ට සතිපතා සාරාංශ ලැබීම නවත්වීම: ගිණුමෙන්, ගුරුවරයාට කියා, හෝ සෑම Email එකකම ඇති unsubscribe link එකෙන්.", en: "Stop parents receiving weekly summaries: from your account, by telling the teacher, or from the unsubscribe link in every email." },
      { si: "ඕනෑම වේලාවක ඔබේ එකඟතාව ඉවත් කර ගැනීම (එවිට ගිණුම මකා දැමිය යුතුය).", en: "Withdraw your consent at any time (the account will then need to be deleted)." },
      { si: "ඔබේ දත්ත භාවිතය ගැන පැමිණිලි කිරීම. පළමුව අපට දැනුම් දෙන්න; ශ්‍රී ලංකාවේ පුද්ගල දත්ත ආරක්ෂණ නීතියට අනුව අදාළ බලධාරියාටද පැමිණිලි කළ හැක.", en: "Complain about how your data is used. Please tell us first; you may also complain to the relevant authority under Sri Lanka's personal data protection law." },
    ],
  },
  {
    id: "security",
    title: { si: "ආරක්ෂාව", en: "Security" },
    items: [
      { si: "සියලු සම්බන්ධතා HTTPS මගින් සංකේතනය කෙරේ; මුරපද hash කර ගබඩා කෙරේ.", en: "All connections are encrypted with HTTPS and passwords are stored hashed." },
      { si: "සිසුවෙකුට බැලිය හැක්කේ තමාගේ දත්ත පමණි. ගුරුවරයාගේ/Admin ගිණුම් 2-පියවර තහවුරු කිරීමෙන් (2-step verification) ආරක්ෂා කළ හැක.", en: "A student can only see their own data. Teacher/admin accounts can be protected with 2-step verification." },
      { si: "Login උත්සාහ සීමා කිරීම, session කාල සීමා සහ ආරක්ෂක ලොග් භාවිතා කෙරේ.", en: "Login attempts are rate-limited, sessions expire and security logs are kept." },
    ],
    after: {
      si: "කිසිදු පද්ධතියක් 100% ආරක්ෂිත නොවේ. ඔබේ මුරපදය කිසිවෙකුට නොදෙන්න.",
      en: "No system is 100% secure. Never share your password with anyone.",
    },
  },
  {
    id: "changes",
    title: { si: "මෙම ප්‍රතිපත්තිය වෙනස් වූ විට", en: "When this policy changes" },
    paras: [
      {
        si: "අප දත්ත භාවිතා කරන ආකාරය වෙනස් වුවහොත් මෙම පිටුව යාවත්කාලීන කර ඉහත අනුවාදය වෙනස් කරමු. වැදගත් වෙනස්කම් ඇත්නම් ඔබට දැනුම් දෙමු.",
        en: "If we change how we use data, we will update this page and the version above. We will tell you about important changes.",
      },
    ],
  },
];
