// randomUUID is secure-context-only; getRandomValues also works on HTTP LAN
// previews. IDs remain cryptographically random UUID v4s in either context.
// This does not relax backend origin checks or change guest credential entropy.
export function newRecordId(source: Pick<Crypto,'getRandomValues'> & Partial<Pick<Crypto,'randomUUID'>> = globalThis.crypto): string {
  if(typeof source?.randomUUID==='function')return source.randomUUID();
  if(typeof source?.getRandomValues!=='function')throw new Error('This browser cannot create secure identifiers. Open Fuzl in a current browser on the Mac.');
  const bytes=source.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
