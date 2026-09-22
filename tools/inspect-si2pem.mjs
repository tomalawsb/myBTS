import XLSX from 'xlsx';
const ident='50101';
const q=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'public:extend_base_stations',outputFormat:'application/json',CQL_FILTER:`identity_name='${ident}'`,count:'5'});
const url='https://si2pem.gov.pl/geoserver/public/wfs?'+q;
const j=await (await fetch(url,{headers:{'user-agent':'Mozilla/5.0 BTS-Asystent-PL'}})).json();
const f=j.features?.[0];console.log('FEATURE',JSON.stringify(f));
if(!f) process.exit(0);
const id=String(f.id).split('.').pop();
const rr=await fetch(`https://si2pem.gov.pl/base_station/${id}/report/`,{headers:{'user-agent':'Mozilla/5.0 BTS-Asystent-PL'}});
console.log('REPORT',rr.status,rr.headers.get('content-type'));
const ab=await rr.arrayBuffer();
const wb=XLSX.read(new Uint8Array(ab),{type:'array',cellDates:false});
console.log('SHEETS',wb.SheetNames);
for(const sn of wb.SheetNames){
 const m=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false});
 console.log('\nSHEET',sn,'ROWS',m.length,'COLS',Math.max(0,...m.map(r=>r.length)));
 for(let i=0;i<Math.min(30,m.length);i++) console.log(i,JSON.stringify(m[i]));
}
