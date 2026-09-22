const urls=[
 'https://si2pem.gov.pl/api/base_stations/public/?page=1&page_size=1',
 'https://si2pem.gov.pl/api/base_stations/public/?identity_name=51200&page=1&page_size=10',
 'https://si2pem.gov.pl/api/base_stations/public/?search=51200&page=1&page_size=10',
 'https://si2pem.gov.pl/api/planned_measurements/?page=1&page_size=1',
 'https://si2pem.gov.pl/map/'
];
for(const u of urls){
 try{
  const r=await fetch(u,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 BTS-Asystent-PL'}});
  const t=await r.text();
  console.log('\nSI2PEM URL',u,'STATUS',r.status,'TYPE',r.headers.get('content-type'));
  console.log(t.slice(0,5000).replace(/\s+/g,' '));
  if(u.endsWith('/map/')){
   const scripts=[...t.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>new URL(m[1],u).href);
   console.log('SCRIPTS',scripts);
   for(const s of scripts.slice(-6)){
    try{
     const rr=await fetch(s),js=await rr.text();
     const needle='/api/base_stations/public/';
     const at=js.indexOf(needle);
     if(at>=0) console.log('PUBLIC API CONTEXT',s,js.slice(Math.max(0,at-2500),at+4000));
     const hits=[...new Set([...js.matchAll(/["'`](\/api\/[^"'`\\\s?]+)/g)].map(m=>m[1]))].slice(0,100);
     if(hits.length)console.log('API HITS',s,hits);
    }catch(e){console.log('JS ERR',s,e.message)}
   }
  }
 }catch(e){console.log('SI2PEM ERR',u,e.message)}
}
