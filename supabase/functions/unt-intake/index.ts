/** FACULTADES UNT V19 — retirada segura del endpoint V18 de registro directo.
 * Las versiones anteriores creaban fichas ya enviadas y eludían el circuito
 * nuevo de borradores/subsanaciones. Por seguridad, este endpoint devuelve 410.
 * Desplegar conjuntamente con unt-registros y actualizar el frontend.
 */
const origins=(Deno.env.get('UNT_ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean);
Deno.serve(req=>{
 const origin=req.headers.get('Origin')||'';
 const headers={
  'Vary':'Origin',
  'Cache-Control':'no-store',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type, x-retry-count, traceparent, tracestate, baggage',
  ...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),
 };
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 return new Response(JSON.stringify({ok:false,error:'El formulario anterior fue reemplazado por la API V19. Abra la página principal actualizada del aplicativo.'}),{status:410,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
});
