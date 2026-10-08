/** The list shows only this many courses; keep typing (or use Near me) to narrow it. */
export const MAX_COURSES = 5;

/** Best matches first: name starts with the search, then a word in the name does, then the rest. */
export function rankCourses<T extends { name: string }>(rows: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  const score = (name: string) => {
    const n = name.toLowerCase();
    if (n.startsWith(q)) return 0;
    if (n.split(/[\s\-']+/).some((w) => w.startsWith(q))) return 1;
    return 2;
  };
  return [...rows].sort((a, b) => score(a.name) - score(b.name) || a.name.localeCompare(b.name));
}
