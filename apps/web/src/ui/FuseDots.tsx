import { fuseDotNames, fuseRestColors } from './brand';
export default function FuseDots() {
  return <svg className="fuse-indicator fuse-waiting" width="34" height="12" viewBox="0 0 34 12" aria-hidden="true">{fuseDotNames.map((name, index) => <circle key={name} className={`fuse-dot fuse-dot-${name}`} cx={5 + index * 12} cy="6" r="3" fill={fuseRestColors[index]} />)}</svg>;
}
