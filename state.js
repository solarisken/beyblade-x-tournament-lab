const KEY='x-tournament-director-v2';
const defaults={inventory:[],evidence:[],locks:[],analysis:null,selectedDeckId:null,testSession:null,testResults:[],match:{me:0,opponent:0,battles:[]},catalogFilter:'all'};
let memory=null;
function readRaw(){try{return localStorage.getItem(KEY)}catch{return memory}}
function writeRaw(value){memory=value;try{localStorage.setItem(KEY,value)}catch{}}
function removeRaw(){memory=null;try{localStorage.removeItem(KEY)}catch{}}
let state=load();
const listeners=new Set();
function load(){try{return {...structuredClone(defaults),...JSON.parse(readRaw()||'{}'),analysis:null,testSession:null,testResults:[]}}catch{return structuredClone(defaults)}}
function persist(){const {analysis,testSession,testResults,...saved}=state;writeRaw(JSON.stringify(saved))}
export function getState(){return state}
export function setState(patch,{save=true}={}){state={...state,...patch};if(save)persist();listeners.forEach(fn=>fn(state))}
export function mutate(fn,{save=true}={}){const next=structuredClone(state);fn(next);state=next;if(save)persist();listeners.forEach(fn=>fn(state))}
export function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}
export function reset(){state=structuredClone(defaults);removeRaw();listeners.forEach(fn=>fn(state))}
export function exportState(){const {analysis,testSession,testResults,...saved}=state;return JSON.stringify({version:2,exportedAt:new Date().toISOString(),state:saved},null,2)}
export function importState(raw){const data=JSON.parse(raw);const incoming=data.state||data;if(!Array.isArray(incoming.inventory)||!Array.isArray(incoming.evidence))throw new Error('Invalid backup file.');state={...structuredClone(defaults),...incoming,analysis:null,testSession:null,testResults:[]};persist();listeners.forEach(fn=>fn(state))}
