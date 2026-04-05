/**
 * Formatta data e ora per Body Check (it-IT).
 * Accetta ISO8601 con orario dal backend o solo data (YYYY-MM-DD) per dati legacy.
 */
export function formatBodyCheckDateTime(isoOrDate: string, options?: { month?: 'short' | 'long' }): string {
  const monthStyle = options?.month ?? 'short';
  try {
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) {
      return isoOrDate;
    }
    return d.toLocaleString('it-IT', {
      day: 'numeric',
      month: monthStyle,
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoOrDate;
  }
}
