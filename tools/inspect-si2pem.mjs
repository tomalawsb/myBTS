const lat=53.881388888888885, lon=20.271666666666665, d=.01;
const q=new URLSearchParams({SERVICE:'WMS',VERSION:'1.3.0',REQUEST:'GetFeatureInfo',LAYERS:'base_stations',QUERY_LAYERS:'base_stations',STYLES:'',CRS:'EPSG:4326',BBOX:`${lat-d},${lon-d},${lat+d},${lon+d}`,WIDTH:'101',HEIGHT:'101',I:'50',J:'50',INFO_FORMAT:'application/json',FEATURE_COUNT:'20'});
const url='https://si2pem.gov.pl/geoserver/public/wms?'+q;
const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 BTS-Asystent-PL'}}),t=await r.text();
console.log('WMS STATUS',r.status,r.headers.get('content-type'),url);console.log(t.slice(0,12000));
try{
 const j=JSON.parse(t);for(const f of j.features||[]){console.log('FEATURE',f.id,JSON.stringify(f.properties));if(String(f.properties?.identity_name)==='50101'||true){const id=String(f.id).split('.').pop();for(const u of [`https://si2pem.gov.pl/all_installation_info/?base_station_id=${id}`,`https://si2pem.gov.pl/base_station/${id}/report/`]){const rr=await fetch(u,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 BTS-Asystent-PL'}}),ct=rr.headers.get('content-type')||'';console.log('DETAIL',id,u,'STATUS',rr.status,'TYPE',ct,'URL',rr.url);const b=await rr.arrayBuffer();console.log('BYTES',b.byteLength,'HEAD',new TextDecoder().decode(b.slice(0,10000)).replace(/\s+/g,' ').slice(0,9000));}break;}}
}catch(e){console.log('PARSE ERR',e.message)}
const cap=await (await fetch('https://si2pem.gov.pl/geoserver/public/wfs?service=WFS&request=GetCapabilities')).text();console.log('WFS CAPS HEAD',cap.slice(0,12000).replace(/\s+/g,' '));
