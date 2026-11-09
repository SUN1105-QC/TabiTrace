#!/usr/bin/env node
// Public, reusable content preparation. Existing Tokyo sources and image variants are preserved.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const spec=JSON.parse(fs.readFileSync(path.join(root,'assets-src/places/EXPANSION_CITIES.json'),'utf8'))
const overrides=JSON.parse(fs.readFileSync(path.join(root,'assets-src/places/EXPANSION_OVERRIDES.json'),'utf8'))
const cache=path.resolve(root,'../backend/.tabitrace/explore-expansion-20261109')
fs.mkdirSync(cache,{recursive:true})
const ua='TabiTrace-content-editor/1.0 (https://tabi.sunows.com/credits)'
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const strip=s=>(s??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()
async function json(url){for(let attempt=0;attempt<4;attempt++){try{const r=await fetch(url,{headers:{'User-Agent':ua},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}catch(e){if(attempt===3)throw e;await sleep(1000*(attempt+1))}}}
const api=(host,params)=>`https://${host}/w/api.php?`+new URLSearchParams({action:'query',format:'json',...params})
const places=spec.cities.flatMap(c=>c.places.map((p,index)=>({city:c.code,cityName:c.name,index:index+1,slug:`${c.slug}-${String(index+1).padStart(2,'0')}-${p[0]}`,name:p[1],title:p[2],reference:c.source})))
const mode=process.argv[2]
if(mode==='metadata'){
 const previous=fs.existsSync(path.join(cache,'metadata.json'))?JSON.parse(fs.readFileSync(path.join(cache,'metadata.json'))):{}
 for(let i=0;i<places.length;i+=10){
  const chunk=places.slice(i,i+10)
  const data=await json(api('en.wikipedia.org',{titles:chunk.map(p=>p.title).join('|'),prop:'pageimages|coordinates|pageprops',piprop:'original',redirects:'1'}))
  const aliases=new Map([...(data.query.normalized??[]),...(data.query.redirects??[])].map(r=>[r.from,r.to]))
  for(const p of chunk){
   let title=p.title;for(let n=0;n<5&&aliases.has(title);n++)title=aliases.get(title)
   const page=Object.values(data.query.pages).find(row=>row.title===title)
   const item={...p,page,coordinate:page?.coordinates?.[0],file:page?.pageprops?.page_image_free}
   if(!item.coordinate&&page?.pageprops?.wikibase_item){const wd=await json(`https://www.wikidata.org/wiki/Special:EntityData/${page.pageprops.wikibase_item}.json`);const v=wd.entities[page.pageprops.wikibase_item]?.claims?.P625?.find(r=>r.mainsnak?.datavalue)?.mainsnak.datavalue.value;if(v)item.coordinate={lat:v.latitude,lon:v.longitude}}
   if(!page?.original?.source?.includes('/wikipedia/commons/'))item.file=undefined
   Object.assign(item,overrides[p.slug]??{})
   previous[p.slug]=item
   console.log(item.file&&item.coordinate?'FOUND':'REVIEW',p.slug,item.file??'NO COMMONS IMAGE',item.coordinate??'NO COORDINATE')
  }
  fs.writeFileSync(path.join(cache,'metadata.json'),JSON.stringify(previous,null,2))
  await sleep(200)
 }
 const unresolved=Object.values(previous).filter(p=>!p.file||!p.coordinate)
 console.log('NEEDS_REVIEW',JSON.stringify(unresolved.map(p=>({slug:p.slug,title:p.title,missing:!p.file?'image':'coordinate'}))))
}else if(mode==='preflight'){
 const metadata=JSON.parse(fs.readFileSync(path.join(cache,'metadata.json')))
 for(let i=0;i<places.length;i+=10){
  const chunk=places.slice(i,i+10)
  const data=await json(api('commons.wikimedia.org',{titles:chunk.map(p=>'File:'+metadata[p.slug].file).join('|'),prop:'imageinfo',iiprop:'url|extmetadata|size|sha1',iiurlwidth:'1920'}))
  for(const p of chunk){const row=Object.values(data.query.pages).find(r=>r.title.replaceAll('_',' ')===('File:'+metadata[p.slug].file).replaceAll('_',' '));const ii=row?.imageinfo?.[0];metadata[p.slug].imageInfo=ii;const license=strip(ii?.extmetadata?.LicenseShortName?.value);console.log(JSON.stringify({slug:p.slug,width:ii?.width,height:ii?.height,license,file:metadata[p.slug].file}))}
  fs.writeFileSync(path.join(cache,'metadata.json'),JSON.stringify(metadata,null,2));await sleep(200)
 }
}else if(mode==='images'){
 const metadata=JSON.parse(fs.readFileSync(path.join(cache,'metadata.json')))
 const sourcesPath=path.join(root,'assets-src/places/SOURCES.json'),sources=JSON.parse(fs.readFileSync(sourcesPath))
 const generatedPath=path.join(root,'constants/place-images.generated.json'),generated=JSON.parse(fs.readFileSync(generatedPath))
 const bounds={SEOUL:[37.3,37.9,126.6,127.4],HONGKONG:[22.1,22.7,113.8,114.5],TAIPEI:[24.8,25.3,121.3,121.8]}
 for(const p of places){
  const m=metadata[p.slug];if(!m?.file||!m.coordinate)throw Error('Metadata missing: '+p.slug)
  const [south,north,west,east]=bounds[p.city],{lat,lon}=m.coordinate
  if(lat<south||lat>north||lon<west||lon>east)throw Error('Coordinate outside city: '+p.slug)
  const done=sources.images.find(s=>s.slug===p.slug)
  const sameFile=done?.originalUrl&&decodeURIComponent(new URL(done.originalUrl).pathname.split('/').pop()).replaceAll('_',' ')===m.file.replaceAll('_',' ')
  // 与东京一致：四档都从 Commons 原图生成（2560 档不能来自 1920 缩略图）。缓存的 imageInfo 必须对应当前文件。
  const fileOf=u=>decodeURIComponent(new URL(u).pathname.split('/').pop()).replace(/^File:/,'').replaceAll('_',' ')
  const cachedInfo=m.imageInfo?.descriptionurl&&fileOf(m.imageInfo.descriptionurl)===m.file.replaceAll('_',' ')?m.imageInfo:null
  if(sameFile&&cachedInfo&&generated[p.slug]?.original?.bytes===cachedInfo.size&&[640,1280,1920,2560].every(w=>fs.existsSync(path.join(root,`public/images/explore/hd/${w}/${p.slug}.webp`)))){console.log('CACHED',p.slug);continue}
  const info=cachedInfo?null:await json(api('commons.wikimedia.org',{titles:'File:'+m.file,prop:'imageinfo',iiprop:'url|extmetadata|size|sha1'}))
  const ii=cachedInfo??Object.values(info.query.pages)[0]?.imageinfo?.[0],em=ii?.extmetadata
  const license=strip(em?.LicenseShortName?.value)
  const accepted=/^((CC BY(-SA)? [1-4]\.[05]( kr)?)|(CC0)|(Public domain)|(KOGL Type 1))$/i.test(license)||(license==='Attribution'&&em?.Attribution?.value&&em?.Categories?.value?.includes('GWOIA'))
  if(!ii||!accepted||!/\.(jpe?g|png|webp)$/i.test(new URL(ii.url).pathname))throw Error('Review license/format: '+p.slug+' '+license+' '+ii?.url)
  if(ii.width<1200)throw Error('Source below 1200px: '+p.slug+' '+ii.width)
  const downloadUrl=ii.url
  const raw=path.join(cache,p.slug+'.source')
  if(fs.existsSync(raw)&&((done&&!sameFile)||fs.statSync(raw).size!==ii.size))fs.unlinkSync(raw)
  if(!fs.existsSync(raw)){let saved=false;for(let n=0;n<4;n++){const r=await fetch(downloadUrl,{headers:{'User-Agent':ua},signal:AbortSignal.timeout(60000)});if(r.ok){fs.writeFileSync(raw,Buffer.from(await r.arrayBuffer()));saved=true;break}await sleep(1200*(n+1))}if(!saved)throw Error('Download failed: '+p.slug)}
  const original=await sharp(raw).rotate().metadata()
  if(original.width<1200)throw Error('Downloaded image too small: '+p.slug)
  const variants={}
  for(const width of [640,1280,1920,2560]){const dir=path.join(root,`public/images/explore/hd/${width}`);fs.mkdirSync(dir,{recursive:true});const output=path.join(dir,p.slug+'.webp');const s=await sharp(raw).rotate().resize({width,withoutEnlargement:true}).webp({quality:82,effort:5}).toFile(output);variants[width]={width:s.width,height:s.height,bytes:s.size}}
  const source={slug:p.slug,file:p.slug+'.'+original.format,subject:p.name,downloadUrl,originalUrl:ii.url,sourcePage:ii.descriptionurl,author:strip(em.Artist?.value)||(sameFile?done.author:null)||null,attribution:strip(em.Attribution?.value)||null,credit:strip(em.Credit?.value),originalTitle:strip(em.ObjectName?.value),createdAt:strip(em.DateTimeOriginal?.value)||(sameFile?done.createdAt:'')||'',license,licenseUrl:(em.LicenseUrl?.value??(ii.descriptionurl+'#Licensing')).replace(/^http:\/\/(www\.kogl\.or\.kr|creativecommons\.org)/,'https://$1'),modifications:'Resized and converted to WebP; preview crops use CSS object-fit.',reference:p.reference,coordinateSource:m.coordinateSource??('https://en.wikipedia.org/wiki/'+encodeURIComponent(m.page.title.replaceAll(' ','_')))}
  fs.copyFileSync(raw,path.join(root,'assets-src/places',source.file))
  sources.images=sources.images.filter(s=>s.slug!==p.slug);sources.images.push(source)
  generated[p.slug]={subject:p.name,original:{file:source.file,width:original.width,height:original.height,bytes:fs.statSync(raw).size},variants,author:source.author,attribution:source.attribution,credit:source.credit,originalTitle:source.originalTitle,createdAt:source.createdAt,license,licenseUrl:source.licenseUrl,sourcePage:source.sourcePage}
  fs.writeFileSync(sourcesPath,JSON.stringify(sources,null,2)+'\n');fs.writeFileSync(generatedPath,JSON.stringify(generated,null,2)+'\n')
  console.log('SAVED',p.slug,license,original.width+'x'+original.height)
  await sleep(1000)
 }
}else throw Error('Use metadata or images')
