import XLSX from 'xlsx';
const PAGE='https://bip.uke.gov.pl/pozwolenia-radiowe/wykaz-pozwolen-radiowych-tresci/stacje-gsm-umts-lte-5gnr-oraz-cdma,12.html';
const html=await (await fetch(PAGE)).text();
const re=/<a[^>]+href=["']([^"']+\.xlsx(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
let m,link=null;
while((m=re.exec(html))){const name=m[2].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();if(/lte800/i.test(name+' '+m[1])){link={url:new URL(m[1],PAGE).href,name};break;}}
if(!link) throw new Error('Brak LTE800');
const ab=await (await fetch(link.url)).arrayBuffer();
const wb=XLSX.read(new Uint8Array(ab),{type:'array'});
console.log('UKE DIAG',link.name,wb.SheetNames);
for(const sn of wb.SheetNames.slice(0,1)){
  const matrix=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false});
  console.log('ROWS0-7');
  for(let i=0;i<Math.min(8,matrix.length);i++) console.log(i,JSON.stringify(matrix[i]));
}
