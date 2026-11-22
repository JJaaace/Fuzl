import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ballotOptionSchema } from '@fuzl/planning';
import type { BallotOption, ShortlistContent } from '@fuzl/planning';
export const ShortlistContext = createContext<((option: () => BallotOption) => void) | null>(null);
export function useShortlist() { return useContext(ShortlistContext); }
interface Draft {
    content: ShortlistContent;
    onContent: (value: ShortlistContent) => void;
    changeRevision: () => number;
    message: string;
    onMessage: (value: string) => void;
}
const DraftContext = createContext<Draft | null>(null);
export const useShortlistDraft = () => useContext(DraftContext);
export function ShortlistProvider({ children }: {
    children: ReactNode;
}) {
    const [content, setContent] = useState<ShortlistContent>({ title: 'Which option would you prefer?', options: [] }), [message, onMessage] = useState('');
    const current = useRef(content), changes = useRef(0);
    const onContent = useCallback((next: ShortlistContent) => { changes.current++; current.current = next; setContent(next); }, []);
    const changeRevision = useCallback(() => changes.current, []);
    const add = useCallback((makeOption: () => BallotOption) => {
        let option: BallotOption;
        try {
            option = ballotOptionSchema.parse(makeOption());
        }
        catch {
            onMessage('Check the public option details and links before shortlisting.');
            return;
        }
        if (current.current.options.some(o => o.kind === option.kind && o.name === option.name && JSON.stringify(o.links) === JSON.stringify(option.links))) {
            onMessage('That option is already shortlisted.');
            return;
        }
        if (current.current.options.length >= 3) {
            onMessage('The shortlist already has three options. Remove one before adding another.');
            return;
        }
        onContent({ ...current.current, options: [...current.current.options, option] });
        onMessage('Added to your temporary shortlist. Save the session and shortlist before publishing.');
    }, [onContent]);
    return <DraftContext value={{ content, onContent, changeRevision, message, onMessage }}><ShortlistContext value={add}>{children}</ShortlistContext></DraftContext>;
}
