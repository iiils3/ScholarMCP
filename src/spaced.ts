import { createEmptyCard,fsrs,Rating,type Card } from 'ts-fsrs';
import type { Flashcard } from './lib';

const KEY='scholarmcp.fsrs.v1';
type Stored=Record<string,any>;
function read():Stored{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}}
function write(x:Stored){localStorage.setItem(KEY,JSON.stringify(x))}
function hydrate(raw:any):Card{
  if(!raw)return createEmptyCard(new Date());
  return {...raw,due:new Date(raw.due),last_review:raw.last_review?new Date(raw.last_review):null} as Card;
}
function serialize(card:Card){return {...card,due:(card.due as Date).toISOString(),last_review:card.last_review?(card.last_review as Date).toISOString():null}}
const scheduler=fsrs();

export type ScholarRating='again'|'hard'|'good'|'easy';
const map:Record<ScholarRating,number>={again:Rating.Again,hard:Rating.Hard,good:Rating.Good,easy:Rating.Easy};

export function fsrsState(card:Flashcard){return hydrate(read()[card.id])}
export function dueDate(card:Flashcard){const raw=read()[card.id];return raw?.due?new Date(raw.due):new Date(card.dueAt)}
export function preview(card:Flashcard){const p=scheduler.repeat(fsrsState(card),new Date());return {again:p[Rating.Again].card.due,hard:p[Rating.Hard].card.due,good:p[Rating.Good].card.due,easy:p[Rating.Easy].card.due}}
export function review(card:Flashcard,rating:ScholarRating){const db=read();const next=scheduler.next(fsrsState(card),new Date(),map[rating]);db[card.id]=serialize(next.card);write(db);return next.card}
export function forget(card:Flashcard){const db=read();db[card.id]=serialize(createEmptyCard(new Date()));write(db)}
export function deleteFSRS(id:string){const db=read();delete db[id];write(db)}
export function retrievability(card:Flashcard){try{return Number(scheduler.get_retrievability(fsrsState(card),new Date(),false))}catch{return 0}}
export function formatInterval(date:Date){const ms=+date-Date.now(),m=Math.max(1,Math.round(ms/60000));if(m<60)return `${m}د`;const h=Math.round(m/60);if(h<48)return `${h}س`;return `${Math.round(h/24)}ي`}
