const ROUTES=new Set(['collection','deck','test','match']);
export function currentRoute(){const value=location.hash.replace(/^#\/?/,'').split('/')[0];return ROUTES.has(value)?value:'collection'}
export function go(route){if(!ROUTES.has(route))route='collection';location.hash=`#/${route}`}
export function startRouter(render){addEventListener('hashchange',()=>render(currentRoute()));if(!location.hash)go('collection');else render(currentRoute())}
