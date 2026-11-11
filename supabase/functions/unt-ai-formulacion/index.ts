/** FACULTADES UNT V19.1.1 — IA externa retirada de forma permanente.
 * Este endpoint queda explícitamente inhabilitado para clientes antiguos.
 * El autoasistente de reglas trabaja exclusivamente en el navegador.
 * No existe fetch a ningún proveedor de modelos.
 */
const allowed=(Deno.env.get('UNT_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim().replace(/\/$/,'')).filter(Boolean);
Deno.serve(req=>{
 const origin=req.headers.get('Origin')||'';
 const headers:Record<string,string>={
   'Vary':'Origin','Cache-Control':'no-store',
   'Access-Control-Allow-Methods':'POST,OPTIONS',
   'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type, x-retry-count, traceparent, tracestate, baggage',
   ...(allowed.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})
 };
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 return new Response(JSON.stringify({ok:false,error:'La IA externa fue retirada. Utilice el autoasistente local integrado en la aplicación.'}),{status:410,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
});
