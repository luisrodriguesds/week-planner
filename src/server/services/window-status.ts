export function parseGoGymDate(raw: string): Date {
  const trimmed = (raw.split(".")[0] ?? raw).replace(" ", "T");
  return new Date(trimmed);
}

export function windowStatus(now: Date, inicio: string, fim: string): "FUTURE" | "OPEN" | "CLOSED" {
  const start = parseGoGymDate(inicio);
  const end = parseGoGymDate(fim);
  if (now.getTime() < start.getTime()) return "FUTURE";
  if (now.getTime() > end.getTime()) return "CLOSED";
  return "OPEN";
}
