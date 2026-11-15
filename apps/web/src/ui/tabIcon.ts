// One icon element and fresh per-theme pathnames; no competing SVG/ICO links.
export const tabIconPaths = { dark: '/brand/fuzl-mark-v3-dark.ico', light: '/brand/fuzl-mark-v3-light.ico' } as const;
export function installTabIcon(icon: HTMLLinkElement | null, media = window.matchMedia('(prefers-color-scheme: dark)')) {
  if (!icon) return () => {};
  const apply = () => icon.setAttribute('href', media.matches ? tabIconPaths.dark : tabIconPaths.light);
  apply(); media.addEventListener('change', apply);
  return () => media.removeEventListener('change', apply);
}
