import { lazy, Suspense } from 'react';
import LoadingView from './LoadingView';

// Keep fixtures and design tools out of the production dependency graph.
const Preview = import.meta.env?.DEV ? lazy(() => import('./DesignDemos')) : null;
export const workspacePreviewNames = new Set(['logos', 'people', 'health', 'signin']);

export default function DevelopmentPreview({ name }: { name: string }) {
  return Preview ? <Suspense fallback={<LoadingView label="Opening design preview…" />}><Preview name={name} /></Suspense> : null;
}
