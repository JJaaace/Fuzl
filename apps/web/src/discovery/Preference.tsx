import type { DiscoveryPreference } from '@fuzl/planning';
export default function Preference({ value, onChange }: { value: DiscoveryPreference; onChange: (v: DiscoveryPreference) => void }) {
  return <div className="discovery-preference"><label className="field"><span>Discovery preference</span><select value={value} onChange={e => onChange(e.target.value as DiscoveryPreference)}><option value="balanced">Balanced</option><option value="familiar">Familiar favorites</option><option value="new">Something new</option></select></label><p className="note">This session only. Reorders the loaded options within each fit category; no provider request. Previously shortlisted options stay in place. History is from the last search/recheck; reopen starts Balanced.</p></div>;
}
