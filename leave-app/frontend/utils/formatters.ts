export const formatDate = (dateStr: string): string => {
  if (!dateStr) return "";
  // Safely handle ISO strings or other formats by extracting YYYY-MM-DD
  const pureDate = dateStr.split("T")[0].split(" ")[0];
  const date = new Date(`${pureDate}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

export const formatDuration = (
  start: string,
  end: string,
  holidays: string[] = [],
): number => {
  const s = new Date(`${start.split("T")[0].split(" ")[0]}T00:00:00`);
  const e = new Date(`${end.split("T")[0].split(" ")[0]}T00:00:00`);
  let count = 0;
  const current = new Date(s);

  while (current <= e) {
    const day = current.getDay();
    const formatted = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    if (day !== 0 && day !== 6 && !holidays.includes(formatted)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
};

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
