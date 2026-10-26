// වර්ෂාවසානයේ උසස් කළ හැකි ශ්‍රේණි (11 -> උසස් පෙළ). උසස් පෙළ සිසුන් උසස් නොකෙරේ
export const PROMOTABLE_GRADES = [6, 7, 8, 9, 10, 11] as const;

export type PromoteState = {
  error?: string;
  preview?: { grades: number[]; byGrade: Record<number, number>; total: number; medium: string; alYear: string };
  done?: { count: number; byGrade: Record<number, number> };
};
