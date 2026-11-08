import type { FitCheck } from '@fuzl/planning';
export default function DiscoveryChecks({ checks, ranking }: { checks: { kind: string; status: FitCheck['status']; detail: string; blocking?: boolean }[]; ranking?: string[] }) {
  return <details><summary>Checks and ordering</summary><ul>{checks.map((check, i) => <li key={i}><strong>{check.kind} · {check.status}</strong>: {check.detail}{check.blocking === false && ' (Information only; no corresponding firm constraint.)'}</li>)}</ul><p className="note">{ranking?.join(' · ')}{ranking?.length ? '. ' : ''}Firm exclusions are applied before preferences; no match percentage is calculated.</p></details>;
}
