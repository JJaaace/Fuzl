const accents=['#d8b47b','#c2b59a','#d39b83','#d5c477','#aebbb0','#c4a9a0'];
export function personAccent(id:string) {let hash=2166136261;for(const char of id){hash^=char.codePointAt(0)!;hash=Math.imul(hash,16777619);}return accents[(hash>>>0)%accents.length];}
export function peopleColumns(count:number) {return count<=1?1:count===2||count===4?2:3;}
