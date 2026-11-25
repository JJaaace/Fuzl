import type {ReactNode} from 'react';
export default function ProviderPrivacy({children}:{children:ReactNode}){
  return <details className="privacy-details"><summary>Privacy & provider details</summary><div className="note">{children}<p>Use synthetic data only with unpaid Google services. Google content may be used for improvement and human review. Check your project’s Free Tier eligibility and quotas before a deliberate request. No automatic provider fallback.</p></div></details>;
}
