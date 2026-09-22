const urls=[
 'https://si2pem.gov.pl/installations/?base_station=51200&page=1&page_size=25',
 'https://si2pem.gov.pl/api/planned_measurements/?page=1&page_size=1',
 'https://si2pem.gov.pl/api/base_stations_export/?page=1&page_size=1',
 'https://si2pem.gov.pl/map/'
];
for(const u of urls){
 try{
  const r=await fetch(u,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 BTS-Asystent-PL'}});
  const t=await r.text();
  console.log('\nSI2PEM URL',u,'STATUS',r.status,'TYPE',r.headers.get('content-type'));
  console.log(t.slice(0,2500).replace(/\s+/g,' '));
  if(u.endsWith('/map/')){
   const scripts=[...t.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>new URL(m[1],u).href);
   console.log('SCRIPTS',scripts);
   for(const s of scripts.slice(-6)){
    try{const rr=await fetch(s);const js=await rr.text();const hits=[...new Set([...js.matchAll(/["'`](\/api\/[^"'`\\\s?]+)/g)].map(m=>m[1]))].slice(0,100);if(hits.length)console.log('API HITS',s,hits);}catch(e){console.log('JS ERR',s,e.message)}
   }
  }
 }catch(e){console.log('SI2PEM ERR',u,e.message)}
}
