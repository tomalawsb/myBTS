for(const ident of ['50101','51200','43413']){
 const q=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:'public:extend_base_stations',outputFormat:'application/json',CQL_FILTER:`identity_name='${ident}'`,count:'5'});
 const url='https://si2pem.gov.pl/geoserver/public/wfs?'+q;
 const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 BTS-Asystent-PL'}}),t=await r.text();
 console.log('\nWFS',ident,'STATUS',r.status,r.headers.get('content-type'));console.log(t.slice(0,10000));
 try{const j=JSON.parse(t);for(const f of j.features||[]){const id=String(f.id).split('.').pop();console.log('ID',id,'PROPS',JSON.stringify(f.properties));for(const u of [`https://si2pem.gov.pl/all_installation_info/?base_station_id=${id}`,`https://si2pem.gov.pl/base_station/${id}/report/`]){const rr=await fetch(u,{redirect:'follow',headers:{'user-agent':'Mozilla/5.0 BTS-Asystent-PL'}}),ct=rr.headers.get('content-type')||'';console.log('DETAIL',u,'STATUS',rr.status,'TYPE',ct,'URL',rr.url);const b=await rr.arrayBuffer();console.log('BYTES',b.byteLength,'HEAD',new TextDecoder().decode(b.slice(0,16000)).replace(/\s+/g,' ').slice(0,15000));}}}catch(e){console.log('PARSE',e.message)}
}
