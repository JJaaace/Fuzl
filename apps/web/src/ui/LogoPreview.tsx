import { useState } from 'react';
import Logo from './Logo';
import { activeLogo, logoVariants, selectedLogo } from './brand';
export default function LogoPreview() {
  const [replay, setReplay] = useState(0);
  return <div className="page logo-preview"><header className="app-header"><a href="/" className="brand"><Logo /><span>Fuzl</span></a><span className="eyebrow">Local design preview</span></header>
    <main><h1>A little spark. A friendly plan.</h1><p>Two refined, rounded mascots. Exactly three fuse dots: amber at the far end, warm ivory toward the body. Spark is the provisional choice.</p>
      <section className="motion-preview surface" aria-label="Light the fuse animation"><Logo key={replay} size={96} playOnMount={replay > 0} /><div><h2>Light the fuse</h2><p>800 ms. The spark travels inward, the body makes a small lift, and the wider smile settles. Reduced motion shows the static mark.</p><button className="primary" onClick={() => setReplay((value) => value + 1)}>Replay Light the fuse</button><p className="note"><a href="/brand/light-the-fuse.svg" target="_blank" rel="noreferrer">Open the standalone animated SVG</a></p></div></section>
      <section className="actual-brand-sizes"><div className="brand"><Logo size={40} /><span>Fuzl</span><span className="size-label">Header · 40px</span></div><div><img src={selectedLogo.favicon} width="16" height="16" alt="Static Fuzl favicon at 16 pixels" /><span>16px favicon</span></div><div><img src={selectedLogo.favicon} width="24" height="24" alt="Static Fuzl favicon at 24 pixels" /><span>24px favicon</span></div></section>
      {logoVariants.map((variant) => <section className="logo-exploration" key={variant.id}><div><h2>{variant.name} {variant.id === activeLogo && <span className="badge">Selected provisionally</span>}</h2><p>{variant.description} The smile spans about two-thirds of the body, with a heavier stroke and clear margins.</p><a href={variant.src}>Open static SVG</a></div>
        {['dark', 'light'].map((background) => <div className={`logo-strip logo-strip-${background}`} key={background} aria-label={`${variant.name} on ${background}`}>
          {[16, 24, 40].map((size) => <div key={size}><Logo variant={variant.id} size={size} /><span>{size}px</span></div>)}
        </div>)}
        <details><summary>Monochrome checks</summary>{['dark', 'light'].map((background) => <div className={`logo-strip logo-strip-${background} is-monochrome`} key={background}>{[16, 24, 40].map((size) => <div key={size}><Logo variant={variant.id} size={size} monochrome /><span>{size}px</span></div>)}</div>)}</details>
      </section>)}
      <details className="legacy-explorations"><summary>Original three explorations</summary><p className="note">The earlier silhouette, soft mascot and geometric direction remain available for comparison.</p><div className="legacy-grid">{[['Spark — original', 'fuzl-spark-exploration'], ['Buddy', 'fuzl-buddy'], ['Loop', 'fuzl-loop']].map(([name, file]) => <div key={file}><img src={`/brand/${file}.svg`} width="64" height="64" alt={name} /><span>{name}</span></div>)}</div></details>
      <p className="note">Change activeLogo in src/ui/brand.ts to replace the header and static runtime favicon. Run node scripts/make-brand-assets.mjs after changing the vector geometry. This development-only preview makes no AI requests.</p>
    </main>
  </div>;
}
