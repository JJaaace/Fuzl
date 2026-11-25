export default function LoadingView({ label = 'Opening Fuzl…' }: { label?: string }) {
  return <main className="page" aria-busy="true"><h1>Fuzl</h1><p role="status">{label}</p><p className="note">Your current work stays in this tab. If loading fails, use the recovery controls.</p></main>;
}
