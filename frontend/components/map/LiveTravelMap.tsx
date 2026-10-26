'use client'

import { MAP_TILES_MISSING, mapTiles, maplibreStyle } from '@/lib/map-tiles'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl'
import { ensureMaplibreWorker } from '@/components/map/maplibreWorker'
import { isWebGLError, markWebGL2Unavailable, supportsWebGL2 } from '@/components/map/basicMap'
import { LiveBasicMap } from '@/components/map/LiveBasicMap'
import type { CheckinView, PlaceView } from '@/services/tabitrace-api'

function valid(n: unknown): n is number { return typeof n === 'number' && Number.isFinite(n) }

/** 浏览器支持 WebGL2 时用 MapLibre，否则（或创建失败时）改用不依赖 WebGL 的基础地图 */
export function LiveTravelMap({places,checkins,onSelect}:{places:PlaceView[];checkins:CheckinView[];onSelect?:(place:PlaceView)=>void}) {
  const [engine,setEngine]=useState<'pending'|'gl'|'basic'>('pending')
  useEffect(()=>{setEngine(supportsWebGL2()?'gl':'basic')},[])
  const ref=useRef<HTMLDivElement|null>(null)
  const mapRef=useRef<MapLibreMap|null>(null)
  const markerRef=useRef<Marker[]>([])
  const routeRef=useRef<[number,number][]>([])
  const visitedIds=useMemo(()=>new Set(checkins.map(c=>c.placeId).filter(Boolean) as number[]),[checkins])
  const route=useMemo(()=>[...checkins].sort((a,b)=>a.checkinTime.localeCompare(b.checkinTime)).map(c=>{
    const p=c.placeId?places.find(x=>x.id===c.placeId):undefined
    const lng=valid(c.longitude)?c.longitude:p?.longitude
    const lat=valid(c.latitude)?c.latitude:p?.latitude
    return valid(lng)&&valid(lat)?[lng,lat] as [number,number]:null
  }).filter(Boolean) as [number,number][],[checkins,places])
  routeRef.current=route

  useEffect(()=>{
    if(engine!=='gl'||!ref.current||mapRef.current)return
    ensureMaplibreWorker()
    let map:MapLibreMap
    try{map=new maplibregl.Map({container:ref.current,center:[139.755,35.682],zoom:10.4,minZoom:2,maxZoom:18,attributionControl:{compact:true},style:maplibreStyle() as maplibregl.StyleSpecification|string})}
    catch(error){if(isWebGLError(error)){markWebGL2Unavailable();setEngine('basic');return}throw error}
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right')
    map.on('load',()=>{
      if(!map.getSource('live-route')) map.addSource('live-route',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:routeRef.current}}})
      if(!map.getLayer('live-route-line')) map.addLayer({id:'live-route-line',type:'line',source:'live-route',paint:{'line-color':'#C56A3A','line-width':3,'line-opacity':.86,'line-dasharray':[2,2]}})
      map.resize()
    })
    mapRef.current=map
    const resize=()=>map.resize()
    window.addEventListener('resize',resize)
    return()=>{window.removeEventListener('resize',resize);markerRef.current.forEach(m=>m.remove());map.remove();mapRef.current=null}
  },[engine])

  useEffect(()=>{
    const map=mapRef.current;if(engine!=='gl'||!map)return
    markerRef.current.forEach(m=>m.remove())
    const placeMarkers=places.filter(p=>valid(p.latitude)&&valid(p.longitude)).map(p=>{
      const el=document.createElement('button');el.type='button';el.title=p.name;el.setAttribute('aria-label',p.name);el.style.width='20px';el.style.height='20px';el.style.borderRadius='999px';el.style.border=p.sourceType==='CUSTOM'?'3px dashed white':'3px solid white';el.style.boxShadow='0 8px 20px rgba(0,0,0,.18)';el.style.cursor='pointer';el.style.background=visitedIds.has(p.id)?'#C56A3A':p.sourceType==='OFFICIAL'?'#C8A96A':'#A7A39A';el.onclick=()=>onSelect?.(p)
      return new maplibregl.Marker({element:el}).setLngLat([p.longitude!,p.latitude!]).addTo(map)
    })
    const orphanMarkers=checkins.filter(c=>!c.placeId&&valid(c.latitude)&&valid(c.longitude)).map(c=>{
      const el=document.createElement('div');el.title=c.placeName||'手动打卡';el.style.width='16px';el.style.height='16px';el.style.borderRadius='999px';el.style.border='3px solid white';el.style.background='#C56A3A';el.style.boxShadow='0 6px 16px rgba(0,0,0,.18)'
      return new maplibregl.Marker({element:el}).setLngLat([c.longitude!,c.latitude!]).addTo(map)
    })
    markerRef.current=[...placeMarkers,...orphanMarkers]
    const updateRoute=()=>{const source=map.getSource('live-route') as GeoJSONSource|undefined;if(source)void source.setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:route}})}
    if(map.loaded())updateRoute();else map.once('load',updateRoute)
    const coords=[...places.filter(p=>valid(p.latitude)&&valid(p.longitude)).map(p=>[p.longitude!,p.latitude!] as [number,number]),...checkins.filter(c=>!c.placeId&&valid(c.latitude)&&valid(c.longitude)).map(c=>[c.longitude!,c.latitude!] as [number,number])]
    if(coords.length){const bounds=coords.reduce((b,c)=>b.extend(c),new maplibregl.LngLatBounds(coords[0],coords[0]));map.fitBounds(bounds,{padding:70,maxZoom:13,duration:500})}
  },[places,checkins,route,visitedIds,onSelect,engine])

  if(engine==='basic')return <LiveBasicMap places={places} checkins={checkins} route={route} visitedIds={visitedIds} onSelect={onSelect}/>
  return <div className="relative"><div ref={ref} className="h-[520px] w-full overflow-hidden rounded-[26px] bg-[#efe9de]"/>{mapTiles.kind==='none'&&<div className="tm-map-note is-warn" role="status"><span>{MAP_TILES_MISSING}</span></div>}</div>
}
