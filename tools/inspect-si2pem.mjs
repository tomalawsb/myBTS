const mapUrl='https://si2pem.gov.pl/map/';
const html=await (await fetch(mapUrl,{headers:{'user-agent':'Mozilla/5.0 BTS-Asystent-PL'}})).text();
const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>new URL(m[1],mapUrl).href);
console.log('SCRIPTS',scripts);
for(const s of scripts){
 try{
  const js=await (await fetch(s)).text();
  if(!/base_stations|BASE_STATION|installation/i.test(js)) continue;
  console.log('\nSCRIPT',s,'LEN',js.length);
  for(const term of ['/api/base_stations/public/','installation','technolog','frequency','band','report','identity_name','source_for_filter']){
   let pos=0,c=0;
   while((pos=js.toLowerCase().indexOf(term.toLowerCase(),pos))>=0 && c<8){
    console.log('\nTERM',term,'AT',pos,'\n',js.slice(Math.max(0,pos-1000),pos+1800));
    pos+=term.length;c++;
   }
  }
 }catch(e){console.log('ERR',s,e.message)}
}
