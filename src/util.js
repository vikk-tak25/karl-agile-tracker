/**
 * Current timestamp formatted as "YYYY-MM-DD HH:mm" — the format used for
 * createdAt / updatedAt fields and comment timestamps.
 */
export function nowTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
