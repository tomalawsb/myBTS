import XLSX from 'xlsx';

const UA={'user-agent':'Mozilla/5.0 BTS-Asystent-PL/1.3'};
const ident='50101';
async function get(url){const r=await fetch(url,{headers:UA,redirect:'follow'});console.log('\nGET',r.status,r.headers.get('content-type'),url);return r;}
async function text(url){const r=await get(url);return r.text();}
async function json(url){const r=await get(url);return r.json();}

const base='https://si2pem.gov.pl/geoserver/public/wfs';
for(const layer of ['public:extend_base_stations','public:measures_all','public:simple_base_stations','public:sim_active_included_base_stations']){
 try{
  const q=new URLSearchParams({service:'WFS',version:'2.0.0',request:'DescribeFeatureType',typeNames:layer});
  const xml=await text(base+'?'+q);
  console.log('DESCRIBE',layer,xml.slice(0,12000));
  const f=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:layer,outputFormat:'application/json',count:'2'});
  const j=await json(base+'?'+f);
  console.log('SAMPLE',layer,JSON.stringify(j.features?.slice(0,2),null,2).slice(0,16000));
 }catch(e){console.log('LAYER ERR',layer,e.message)}
}

const q=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'public:extend_base_stations',outputFormat:'application/json',CQL_FILTER:`identity_name='${ident}'`,count:'5'});
const j=await json(base+'?'+q);const f=j.features?.[0];console.log('STATION',JSON.stringify(f));
if(f){
 const id=String(f.id).split('.').pop();
 const u=`https://si2pem.gov.pl/base_station/${id}/report/`;
 try{const r=await get(u),ct=r.headers.get('content-type')||'';if(ct.includes('spreadsheet')){const ab=await r.arrayBuffer();const wb=XLSX.read(new Uint8Array(ab),{type:'array'});for(const sn of wb.SheetNames){const m=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false});console.log('REPORT',sn,JSON.stringify(m.slice(0,80)));}}}catch(e){console.log('REPORT ERR',e.message)}
}
