// ශ්‍රී ලංකා අධ්‍යාපන ප්‍රකාශන දෙපාර්තමේන්තුවේ ICT කියවීම් පොත් (පෙළපොත්) වල පටුන (පරිච්ඡේද) අනුව.
// ශ්‍රේණි 6 - 11, සිංහල සහ English දෙමාධ්‍යයටම. පොත්වල පරිච්ඡේද අනුපිළිවෙලම "order" ලෙස යොදයි.
// උසස් පෙළ (A/L) = grade 12 කේතය (12 සහ 13 වෙන් නොකරයි): ඒකක 14, ICT නිර්දේශයේ අනුව.
import type { Medium } from "./schema";

export type CurriculumEntry = { grade: number; medium: Medium; titles: string[] };

export const CURRICULUM: CurriculumEntry[] = [
  /* ------------------------------ සිංහල මාධ්‍ය ------------------------------ */
  {
    grade: 6,
    medium: "SINHALA",
    titles: [
      "පරිගණකයේ වැදගත්කම",
      "පරිගණක විද්‍යාගාරය ආරක්ෂිතව භාවිතය",
      "මෙහෙයුම් පද්ධතිය හා ගොනු හැසිරවීම",
      "යෙදුම් මෘදුකාංග භාවිතය සඳහා මූසිකය හා යතුරුපුවරුව යොදා ගැනීම",
      "ඇල්ගොරිතම සහ ගැලීම් සටහන්",
      "තොරතුරු රැස්කිරීම හා සන්නිවේදනය සඳහා අන්තර්ජාලය භාවිතය",
    ],
  },
  {
    grade: 7,
    medium: "SINHALA",
    titles: [
      "මධ්‍ය සැකසුම් ඒකකය",
      "මෙහෙයුම් පද්ධතිය",
      "පරිගණක පද්ධතියේ ආරක්ෂාව",
      "වදන් සැකසීම",
      "ක්‍රමලේඛ සංවර්ධනය",
      "සමර්පණ මෘදුකාංග",
      "තොරතුරු හා සන්නිවේදනය සඳහා අන්තර්ජාලය භාවිතය",
    ],
  },
  {
    grade: 8,
    medium: "SINHALA",
    titles: [
      "සංඛ්‍යා පද්ධති",
      "මෙහෙයුම් පද්ධතිය භාවිතයෙන් පරිගණකයක් වින්‍යාස කිරීම සහ සිටුවම් කිරීම",
      "වදන් සැකසීම",
      "ක්‍රමලේඛ ගොඩනැගීම",
      "භෞතික ආගණනය සඳහා මෘදුකාංග භාවිතය",
      "අන්තර්ජාලයේ සැරිසරමු",
    ],
  },
  {
    grade: 9,
    medium: "SINHALA",
    titles: [
      "පරිගණක සහ පර්යන්ත උපාංග මිල දී ගැනීම සඳහා පිරිවිතර සැකසීම",
      "විද්‍යුත් පැතුරුම්පත්",
      "ක්‍රමලේඛ ගොඩනැගීම",
      "ක්ෂුද්‍ර පාලක භාවිතය",
      "පරිගණක ජාලකරණය",
      "තොරතුරු හා සන්නිවේදන තාක්ෂණය සහ සමාජය",
    ],
  },
  {
    grade: 10,
    medium: "SINHALA",
    titles: [
      "තොරතුරු හා සන්නිවේදන තාක්ෂණය",
      "පරිගණකය හඳුනා ගනිමු",
      "පරිගණක පද්ධතියේ දත්ත නිරූපණයට භාවිත කරන ක්‍රම",
      "තාර්කික ද්වාර සමඟ බූලීය වීජ තර්කය",
      "මෙහෙයුම් පද්ධති",
      "වදන් සැකසීම",
      "විද්‍යුත් පැතුරුම්පත්",
      "ඉලෙක්ට්‍රොනික සමර්පණ",
      "දත්ත සමුදාය",
    ],
  },
  {
    grade: 11,
    medium: "SINHALA",
    titles: [
      "ගැටළු විසඳීමට ක්‍රමලේඛ ලිවීම",
      "තොරතුරු පද්ධති සංවර්ධන ක්‍රියාවලිය",
      "අන්තර්ජාලය හා විද්‍යුත් තැපැල",
      "බහුමාධ්‍ය භාවිතය",
      "බහුමාධ්‍ය තාක්ෂණය යොදා ගනිමින් සරල වෙබ් අඩවි නිර්මාණය",
      "සමාජය සහ තොරතුරු හා සන්නිවේදන තාක්ෂණය",
    ],
  },

  /* ------------------------------ English Medium ------------------------------ */
  {
    grade: 6,
    medium: "ENGLISH",
    titles: [
      "Importance of Computers",
      "Use the Computer Laboratory Safely",
      "Operating System and File Management",
      "Using Mouse and Keyboard to use Application Software",
      "Algorithm & Flow Charts",
      "Using the Internet for collecting Information and Communication",
    ],
  },
  {
    grade: 7,
    medium: "ENGLISH",
    titles: [
      "Central Processing Unit",
      "Operating System",
      "Security of Computer System",
      "Word Processing",
      "Programme Development",
      "Presentation Software",
      "Using Internet for Information and Communication",
    ],
  },
  {
    grade: 8,
    medium: "ENGLISH",
    titles: [
      "Number Systems",
      "Configuring and Formatting a Computer",
      "Word Processing",
      "Programming",
      "Physical Computing",
      "Internet",
    ],
  },
  {
    grade: 9,
    medium: "ENGLISH",
    titles: [
      "Preparation of Computer Specifications",
      "Electronic Spreadsheets",
      "Programming",
      "Use of Microcontrollers",
      "Computer Networks",
      "ICT and Society",
    ],
  },
  {
    grade: 10,
    medium: "ENGLISH",
    titles: [
      "Information and Communication Technology",
      "Fundamentals of a Computer System",
      "Data Representation Methods in the Computer System",
      "Logic Gates with Boolean Functions",
      "Operating Systems",
      "Word Processing",
      "Electronic Spreadsheet",
      "Electronic Presentations",
      "Database",
    ],
  },
  {
    grade: 11,
    medium: "ENGLISH",
    titles: [
      "Programming",
      "System Development Life Cycle",
      "The Internet and the Electronic Mail",
      "Use of Multimedia",
      "Web Designing Using Multimedia",
      "Information and Communication Technology and Society",
    ],
  },

  /* ------------------------ උසස් පෙළ (A/L) = grade 12 ------------------------ */
  {
    grade: 12,
    medium: "SINHALA",
    // සටහන: මේවා සිංහල පරිවර්තන යි. Admin Panel එකෙන් ඔබේ වචන වලට සංස්කරණය කළ හැක.
    titles: [
      "තොරතුරු හා සන්නිවේදන තාක්ෂණයේ සංකල්ප",
      "පරිගණකය හැඳින්වීම",
      "දත්ත නිරූපණය",
      "ඩිජිටල් පරිපථ මූලික ධර්ම",
      "පරිගණක මෙහෙයුම් පද්ධති",
      "දත්ත සන්නිවේදනය හා ජාලකරණය",
      "පද්ධති විශ්ලේෂණය හා සැලසුම්කරණය",
      "දත්ත සමුදාය කළමනාකරණය",
      "ක්‍රමලේඛනය",
      "වෙබ් සංවර්ධනය",
      "දේවල්වල අන්තර්ජාලය (IoT)",
      "ව්‍යාපාරවල ICT",
      "ICT හි නව ප්‍රවණතා සහ අනාගත දිශානති",
      "ව්‍යාපෘතිය",
    ],
  },
  {
    grade: 12,
    medium: "ENGLISH",
    titles: [
      "Concept of ICT",
      "Introduction to Computer",
      "Data Representation",
      "Fundamentals of Digital Circuits",
      "Computer Operating System",
      "Data Communication and Networking",
      "System Analysis and Design",
      "Database Management",
      "Programming",
      "Web Development",
      "Internet of Things (IoT)",
      "ICT in Business",
      "New Trends and Future Directions of ICT",
      "Project",
    ],
  },
];
