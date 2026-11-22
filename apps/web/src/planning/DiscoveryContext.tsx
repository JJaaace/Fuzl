import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { AssessedPlace, AssessedEvent, PlaceResults, EventResults, PlanningSummary } from '@fuzl/planning';
export interface DiscoveredOption {
    kind: 'place';
    value: AssessedPlace;
    mode: 'demo' | 'live';
}
export interface DiscoveredEvent {
    kind: 'event';
    value: AssessedEvent;
    mode: 'demo' | 'live';
}
interface Discovery {
    items: (DiscoveredOption | DiscoveredEvent)[];
    stale: boolean;
    hasResults?: boolean;
    kind?: 'place' | 'event';
    revision: number;
    blocked: boolean;
    scope?: {
        label: string;
        count: number;
    };
    onScopeChange?: (blocked: boolean) => void;
    clear?: () => void;
    invalidate?: () => void;
    onPlaces?: (value: PlaceResults) => void;
    onEvents?: (value: EventResults) => void;
}
const Context = createContext<Discovery>({ items: [], stale: false, revision: 0, blocked: false });
export const useDiscovered = () => useContext(Context);
export function DiscoveryProvider({ summary, sessionId, children }: {
    summary: PlanningSummary;
    sessionId?: string;
    children: ReactNode;
}) {
    const key = JSON.stringify([summary, sessionId]);
    const [result, setResult] = useState<{
        key: string;
        items: Discovery['items'];
        kind: 'place' | 'event';
        scope: Discovery['scope'];
    } | null>(null);
    const [revision, setRevision] = useState(0), [blocked, setBlocked] = useState(false);
    const onScopeChange = useCallback((value: boolean) => { setBlocked(value); setRevision(v => v + 1); setResult(v => v ? { ...v, key: 'stale' } : null); }, []);
    const clear = useCallback(() => setResult(null), []);
    const invalidate = useCallback(() => setResult(value => value ? { ...value, key: 'stale' } : null), []);
    const onPlaces = useCallback((data: PlaceResults) => setResult({ key, kind: 'place', scope: { label: data.participation?.mode === 'available' ? 'Reviewed opted-in attendees' : 'Everyone together', count: data.participation ? data.participation.attendeeCount : summary.participants.length }, items: [...data.verified, ...data.promising, ...data.excluded].map(value => ({ kind: 'place', value, mode: data.mode })) }), [key, summary.participants.length]);
    const onEvents = useCallback((data: EventResults) => setResult({ key, kind: 'event', scope: { label: data.participation?.mode === 'available' ? 'Reviewed opted-in attendees' : 'Everyone together', count: data.participation ? data.participation.attendeeCount : summary.participants.length }, items: [...data.verified, ...data.promising, ...data.excluded].map(value => ({ kind: 'event', value, mode: data.mode })) }), [key, summary.participants.length]);
    return <Context value={{ hasResults: result?.key === key, kind: result?.kind, revision, blocked, onScopeChange, scope: result?.key === key ? result.scope : undefined, items: result?.key === key ? result.items : [], stale: !!result && result.key !== key, onPlaces, onEvents, clear, invalidate }}>{children}</Context>;
}
