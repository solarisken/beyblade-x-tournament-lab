export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function pageHead(step,title,text){return `<header class="page-head"><div><div class="eyebrow">${esc(step)}</div><h1>${esc(title)}</h1><p>${esc(text)}</p></div></header>`}
export function empty(title,text,action='',label=''){return `<div class="card empty"><div class="empty-icon">◎</div><h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>${action?`<a class="button" href="${action}">${esc(label)}</a>`:''}</div>`}
