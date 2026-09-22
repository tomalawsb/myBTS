const mapUrl='https://si2pem.gov.pl/map/';
const html=await (await fetch(mapUrl,{headers:{'user-agent':'Mozilla/5.0 BTS-Asystent-PL'}})).text();
const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>new URL(m[1],mapUrl).href);
for(const s of scripts){
 try{
  const js=await (await fetch(s)).text();
  if(!/extend_base_stations|geoserver|GetFeatureInfo|base_station\//i.test(js)) continue;
  console.log('\nSCRIPT',s,'LEN',js.length);
  for(const term of ['extend_base_stations','geoserver','GetFeatureInfo','all_installation_info','/base_station/','permit:', 'no_permit']){
   let pos=0,c=0;
   while((pos=js.indexOf(term,pos))>=0 && c<12){console.log('\nTERM',term,'AT',pos,'\n',js.slice(Math.max(0,pos-1800),pos+2600));pos+=term.length;c++;}
  }
 }catch(e){console.log('ERR',s,e.message)}
}
