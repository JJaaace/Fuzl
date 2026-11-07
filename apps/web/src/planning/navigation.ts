export type WorkspaceStage = 'conversation' | 'transcript' | 'understanding';
export type InputMode = 'paste' | 'screenshots';
export interface WorkspaceNavigation { stage: WorkspaceStage; mode: InputMode; transcriptReady: boolean; previewReady: boolean }
export const initialNavigation: WorkspaceNavigation = { stage: 'conversation', mode: 'paste', transcriptReady: false, previewReady: false };
export type NavigationAction =
  | { type: 'stage'; stage: WorkspaceStage }
  | { type: 'mode'; mode: InputMode }
  | { type: 'preview-ready'; activate?: boolean }
  | { type: 'transcript-ready' | 'transcript-cleared' | 'transcript-used' | 'preview-opened' | 'preview-cleared' | 'summary-opened' };
// Navigation contains no planning values. Changing visibility cannot replace a
// draft, transcript, form, source revision or accepted summary.
export function navigateWorkspace(current: WorkspaceNavigation, action: NavigationAction): WorkspaceNavigation {
  switch (action.type) {
    case 'stage': return { ...current, stage: action.stage };
    case 'mode': return { ...current, mode: action.mode, stage: 'conversation' };
    case 'transcript-ready': return { ...current, transcriptReady: true, stage: current.stage === 'conversation' && current.mode === 'screenshots' ? 'transcript' : current.stage };
    case 'transcript-cleared': return { ...current, transcriptReady: false, stage: current.stage === 'transcript' ? 'conversation' : current.stage };
    case 'transcript-used': return { ...current, stage: 'conversation', mode: 'paste' };
    case 'preview-ready': return { ...current, previewReady: true, stage: action.activate !== false && current.stage === 'conversation' && current.mode === 'paste' ? 'understanding' : current.stage };
    case 'preview-opened': return { ...current, previewReady: true, stage: 'understanding' };
    case 'preview-cleared': return { ...current, previewReady: false };
    case 'summary-opened': return { ...current, stage: 'understanding', previewReady: false };
  }
}
