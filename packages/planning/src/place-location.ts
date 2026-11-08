// US state names are normalized for matching; ZIPs are always strings.
const stateNames = 'AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming';
export const normalizePlaceName = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.’']/g, '').replace(/\bsaint\b/g, 'st').replace(/\bfort\b/g, 'ft').replace(/^(city|town|village) of /, '').replace(/\s+/g, ' ').trim();
export function usState(value: string): string | null {
  const clean = normalizePlaceName(value.replace(/^US-/i, ''));
  return stateNames.split('|').find(pair => pair.split(':').some(part => normalizePlaceName(part) === clean))?.split(':')[0] ?? null;
}
export function parseUsArea(value: string): { zip: string; city: null; state: null } | { zip: null; city: string; state: string | null } | null {
  const text = value.trim();
  if (/^\d{5}$/.test(text)) return { zip: text, city: null, state: null };
  if (!/^[\p{L} .’'-]+(?:,\s*[\p{L} .]+)?$/u.test(text) || text.length > 100 || text.length < 2) return null;
  const parts = text.split(',').map(v => v.trim());
  if (!parts[0] || parts.length > 2 || parts.length === 2 && !usState(parts[1])) return null;
  return { zip: null, city: parts[0], state: parts.length === 2 ? usState(parts[1]) : null };
}
// Resolve local clocks without choosing one side of a DST fold or gap.
function formatter(timeZone: string) { return new Intl.DateTimeFormat('en-US-u-ca-iso8601-nu-latn', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
function localParts(instant: number, timeZone: string, format = formatter(timeZone)) {
  const parts = format.formatToParts(instant);
  const get = (name: string) => parts.find(p => p.type === name)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}
export function localInstant(date: string, time: string, zone: string): number | null {
  const naive = Date.parse(`${date}T${time}:00Z`), matches: number[] = [], format = formatter(zone);
  for (let offset = -840; offset <= 840; offset += 15) {
    const instant = naive + offset * 60000, local = localParts(instant, zone, format);
    if (local.date === date && local.time === time) matches.push(instant);
  }
  return matches.length === 1 ? matches[0] : null;
}
export function venueWindow(date: string | null, start: string | null, end: string | null, chosenZone: string | null, venueZone: string | null) {
  if (!date || !start || !end || !venueZone) return null;
  const inputZone = chosenZone ?? venueZone;
  const first = localInstant(date, start, inputZone), last = localInstant(date, end, inputZone);
  if (first === null || last === null || last <= first) return null;
  const a = localParts(first, venueZone), b = localParts(last, venueZone);
  if (a.date !== b.date) return null; // Single-day hours model; don't invent overnight coverage.
  return { date: a.date, start: a.time, end: b.time, timeZone: venueZone };
}
