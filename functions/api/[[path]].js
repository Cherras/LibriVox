// Cloudflare Pages Function: same-origin proxy with input validation and short cache.
export async function onRequestGet({request,params}) {
  const endpoint = params.path?.[0];
  if (!['search','tracks'].includes(endpoint)) return json({error:'Ruta desconocida'},404);
  const q = new URL(request.url).searchParams;
  const api = new URL(endpoint==='search'?'https://librivox.org/api/feed/audiobooks/':'https://librivox.org/api/feed/audiotracks/');
  api.searchParams.set('format','json');
  if(endpoint==='search'){
    const term=(q.get('q')||'').trim();
    if(!term||term.length>120)return json({error:'Búsqueda no válida'},400);
    const field=q.get('field')==='title'?'title':'author';
    api.searchParams.set(field,term);
    const lang=q.get('language')||'';
    if(lang && !['Spanish','English','French','German'].includes(lang))return json({error:'Idioma no admitido'},400);
    if(lang)api.searchParams.set('language',lang);
    api.searchParams.set('limit',String(Math.min(50,Math.max(1,Number(q.get('limit'))||25))));
    api.searchParams.set('offset',String(Math.min(1000,Math.max(0,Number(q.get('offset'))||0))));
    api.searchParams.set('extended','1');
  }else{
    const id=q.get('id')||'';
    if(!/^\d{1,10}$/.test(id))return json({error:'ID no válido'},400);
    api.searchParams.set('project_id',id);
  }
  try{
    const r=await fetch(api.toString(),{headers:{accept:'application/json','user-agent':'Alejandria-LibriVox/2.0 (personal library manager)'},signal:AbortSignal.timeout(12000)});
    if(!r.ok)return json({error:'LibriVox respondió HTTP '+r.status},502);
    const body=await r.json();
    return json(endpoint==='search'?{books:Array.isArray(body.books)?body.books:[]}:{tracks:Array.isArray(body.sections)?body.sections:Array.isArray(body.tracks)?body.tracks:[]},200,{'Cache-Control':'public, max-age=180'});
  }catch(e){return json({error:'No se pudo consultar LibriVox: '+String(e.message||e)},502)}
}
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}})}
