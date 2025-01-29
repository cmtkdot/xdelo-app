export function parsePurchaseDate(dateStr: string): string | null {
  if (dateStr.length < 5 || dateStr.length > 6) return null;

  // Pad with leading zero if 5 digits
  const paddedDate = dateStr.length === 5 ? '0' + dateStr : dateStr;
  
  const month = paddedDate.substring(0, 2);
  const day = paddedDate.substring(2, 4);
  const year = '20' + paddedDate.substring(4, 6);

  // Validate date
  const date = new Date(`${year}-${month}-${day}`);
  if (isNaN(date.getTime()) || date > new Date()) return null;

  return `${year}-${month}-${day}`;
}