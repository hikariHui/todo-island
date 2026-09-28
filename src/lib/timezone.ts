/** Business timezone for timed dueAt / iCal (wall clock, not browser TZ). */
export function getAppTimeZone(): string {
  return (
    process.env.APP_TIMEZONE?.trim() ||
    process.env.TZ?.trim() ||
    "Asia/Shanghai"
  );
}

/**
 * Interpret YYYY-MM-DD + HH:mm:ss as wall time in `timeZone`, return UTC Date.
 * Uses Intl offset iteration (no extra deps; handles DST).
 */
export function zonedLocalToUtc(
  date: string,
  time: string,
  timeZone: string = getAppTimeZone(),
): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [hh, mm, rawSs] = time.split(":");
  const ss = Number(rawSs || "0");
  const desiredWall = Date.UTC(y, mo - 1, d, Number(hh), Number(mm), ss);

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  let guess = desiredWall;
  for (let i = 0; i < 3; i += 1) {
    const parts = dtf.formatToParts(new Date(guess));
    const map: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
    const actualWall = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
    const diff = desiredWall - actualWall;
    if (diff === 0) break;
    guess += diff;
  }

  return new Date(guess);
}
