import XLSX from 'xlsx';

const UA={'user-agent':'Mozilla/5.0 BTS-Asystent-PL/1.3'};
const ident='50101';

async function text(url){const r=await fetch(url,{headers:UA});console.log('GET',url,r.status,r.headers.get('content-type'));return r.text();}
async function json(url){const r=await fetch(url,{headers:UA});console.log('GET',url,r.status,r.headers.get('content-type'));return r.json();}

try{
  const caps=await text('https://si2pem.gov.pl/geoserver/public/wfs?service=WFS&version=2.0.0&request=GetCapabilities');
  const names=[...caps.matchAll(/<Name>([^<]+)<\/Name>/g)].map(m=>m[1]).filter(x=>/public:|station|install|anten|report|source|pem|measurement/i.test(x));
  console.log('LAYERS', [...new Set(names)].slice(0,120));
}catch(e){console.log('CAPS ERR',e.message)}

const q=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'public:extend_base_stations',outputFormat:'application/json',CQL_FILTER:`identity_name='${ident}'`,count:'5'});
const url='https://si2pem.gov.pl/geoserver/public/wfs?'+q;
const j=await json(url);
const f=j.features?.[0];console.log('FEATURE',JSON.stringify(f));
if(!f) process.exit(0);
const id=String(f.id).split('.').pop();

for(const u of [
 `https://si2pem.gov.pl/base_station/${id}/`,
 `https://si2pem.gov.pl/base_station/${id}/report/`,
 `https://si2pem.gov.pl/api/base_stations/${id}/`,
 `https://si2pem.gov.pl/api/public/base_stations/${id}/`
]){
 try{
  const r=await fetch(u,{headers:UA,redirect:'follow'});
  console.log('ENDPOINT',u,r.status,r.url,r.headers.get('content-type'));
  const ct=r.headers.get('content-type')||'';
  if(ct.includes('text')||ct.includes('json')) console.log((await r.text()).slice(0,4000));
  else if(ct.includes('spreadsheet')){
    const ab=await r.arrayBuffer();const wb=XLSX.read(new Uint8Array(ab),{type:'array',cellDates:false});console.log('SHEETS',wb.SheetNames);
    for(const sn of wb.SheetNames){const m=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false});console.log('\nSHEET',sn,'ROWS',m.length,'COLS',Math.max(0,...m.map(x=>x.length)));for(let i=0;i<Math.min(30,m.length);i++)console.log(i,JSON.stringify(m[i]));}
  }
 }catch(e){console.log('ENDPOINT ERR',u,e.message)}
}
