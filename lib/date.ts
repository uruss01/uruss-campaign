/** Never rely on the viewer's device timezone for campaign reporting dates. */
export function dateInMalaysia(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function readableDate(value: string): string {
  return new Intl.DateTimeFormat('en-MY', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`));
}

export function timeInMalaysia(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(date);
}

export function dateTimeInMalaysia(value: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(new Date(value));
}

export function campaignTimeLeft(endDate: string, now = Date.now()) {
  // Malaysia is UTC+08:00 year-round; campaign closes at the end of the selected date.
  const remaining = Math.max(0, Date.parse(`${endDate}T23:59:59+08:00`) - now);
  const seconds = Math.floor(remaining / 1000);
  return {
    remaining,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

export function durationDays(start: string, end: string): number {
  return Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1);
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatMoney(value: number): string {
  return `RM ${formatNumber(value)}`;
}
