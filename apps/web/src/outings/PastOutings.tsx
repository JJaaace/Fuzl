import { useEffect, useState } from 'react';
import { pastOutingsSchema } from '@fuzl/planning';
import type { PastOuting } from '@fuzl/planning';
import { privateRequest } from '../accounts/api';
export default function PastOutings({ token, groupId }: { token: string; groupId: string }) {
  const [rows, setRows] = useState<PastOuting[]>([]), [error, setError] = useState('');
  useEffect(() => { const c = new AbortController(); void privateRequest(token, `/groups/${groupId}/outings`, c.signal).then(raw => { if (!c.signal.aborted) setRows(pastOutingsSchema.parse(raw)); }).catch(() => { if (!c.signal.aborted) setError('Past outings could not load. Check migrations and reopen this group.'); }); return () => c.abort(); }, [token, groupId]);
  return <section className="review-section"><h3>Past outings</h3><p className="note">Recorded actual outings only. Cancelled, proposed and shortlisted ideas are not visits. Open the original session to correct the outing or edit/remove memory.</p>{error && <p role="status">{error}</p>}<ul>{rows.map(o => <li key={o.id}><strong>{o.actual.activity}</strong> · {o.actual.date}<p>{o.actual.meetingPoint}</p>{o.memoryActive && <p>Approved group takeaway: {o.approvedTakeaway}</p>}{o.approvedTakeaway && !o.memoryActive && <p className="note">Takeaway suspended pending review.</p>}</li>)}</ul>{!rows.length && !error && <p>No actual outings recorded yet.</p>}</section>;
}
