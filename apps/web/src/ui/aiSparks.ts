import { mascotColors } from './brand';
export interface AISpark{x:number;y:number;angle:number;distance:number;created:number;color:string}
export function aiBurst(x:number,y:number,created:number,phone=false):AISpark[]{return Array.from({length:phone?12:24},(_,i)=>({x,y,created,angle:i*2.3999632297,distance:32+(i%6)*11,color:[mascotColors.body,mascotColors.ember,mascotColors.gold][i%3]}));}
export function aiSparkPose(spark:AISpark,seconds:number){const age=Math.max(0,seconds-spark.created),t=Math.min(1,age/1.25),reach=1-Math.exp(-4*t);return{x:spark.x+Math.cos(spark.angle)*spark.distance*reach,y:spark.y+Math.sin(spark.angle)*spark.distance*reach+8*t*t,opacity:Math.max(0,1-t)**1.5,alive:t<1};}
