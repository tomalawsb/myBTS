import XLSX from 'xlsx';

const UA={'user-agent':'Mozilla/5.0 BTS-Asystent-PL/1.3'};
const ident='50101';
async function get(url){const r=await fetch(url,{headers:UA,redirect:'follow'});console.log('\nGET',r.status,r.headers.get('content-type'),url);return r;}
async function text(url){const r=await get(url);return r.text();}
async function json(url){const r=await get(url);return r.json();}

const base='https://si2pem.gov.pl/geoserver/public/wfs';

const stationQ=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'public:extend_base_stations',outputFormat:'application/json',CQL_FILTER:`identity_name='${ident}'`,count:'5'});
const stationJson=await json(base+'?'+stationQ);const station=stationJson.features?.[0];console.log('STATION',JSON.stringify(station));

for(const filter of [`identity_names LIKE '%${ident}%'`,`identity_names='${ident}'`]){
 try{
  const q=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'public:measures_all',outputFormat:'application/json',CQL_FILTER:filter,count:'100',sortBy:'year D'});
  const j=await json(base+'?'+q);
  console.log('MEASURES FILTER',filter,'count',j.features?.length||0);
  for(const f of (j.features||[]).slice(0,30)) console.log('MEASURE',JSON.stringify(f.properties));
 }catch(e){console.log('MEASURES ERR',filter,e.message)}
}

if(station){
 const id=String(station.id).split('.').pop();
 const u=`https://si2pem.gov.pl/base_station/${id}/report/`;
 try{const r=await get(u),ct=r.headers.get('content-type')||'';if(ct.includes('spreadsheet')){const ab=await r.arrayBuffer();const wb=XLSX.read(new Uint8Array(ab),{type:'array'});for(const sn of wb.SheetNames){const m=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false});console.log('REPORT',sn,JSON.stringify(m.slice(0,90)));}}}catch(e){console.log('REPORT ERR',e.message)}
}
