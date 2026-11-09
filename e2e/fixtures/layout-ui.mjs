const pictures=['asakusa','tokyo-tower','tokyo-station','shibuya-crossing','ueno-panda','nakamise','akihabara','ginza']
// Browser-only API data; no actual account is accessed or changed.
export function layoutFixture({web='http://127.0.0.1:3015',session=true,stress=false,longTitle=false,empty=false,photoCount=12,planType='PRO',enablePayments=false}={}) {
  const title=(stress||longTitle)?('东京跨城旅行_'+'TravelMemory_'.repeat(15)).slice(0,200):'东京三日散步'
  const trip={id:900001,title,destinationName:'东京',city:'东京',countryCode:'JP',startDate:'2026-10-30',endDate:'2026-11-01',peopleCount:2,planType,status:'ONGOING',visibility:'PRIVATE',coverImage:web+'/images/explore/tokyo-tower.jpg',createdAt:'2026-10-20T03:00:00+09:00'}
  const trips=empty?[]:[trip,{...trip,id:900002,title:(stress||longTitle)?title:'京都春日漫游',city:'京都',destinationName:'京都',status:'ARCHIVED',startDate:'2025-04-03',endDate:'2025-04-06'}]
  const places=[{id:101,name:stress?'浅草寺附近的仲见世商店街与隅田川沿岸步道'.repeat(3):'浅草寺',area:'浅草',city:'东京',latitude:35.71476,longitude:139.79665,sourceType:'OFFICIAL'},{id:102,name:'东京站',area:'丸之内',city:'东京',latitude:35.68124,longitude:139.767125,sourceType:'OFFICIAL'},{id:103,name:'东京塔',area:'港区',city:'东京',latitude:35.65858,longitude:139.74543,sourceType:'OFFICIAL'}]
  const checkins=empty?[]:places.map((p,i)=>({id:i+1,tripId:trip.id,placeId:p.id,itineraryItemId:i+1,placeName:p.name,area:p.area,checkinType:'MANUAL',checkinTime:`2026-10-${i===2?'31':'30'}T${i===0?'09:30':i===1?'14:20':'18:30'}:00+09:00`,latitude:p.latitude,longitude:p.longitude,weatherText:'晴',temperatureC:21,note:stress?'这段旅行的风景与心情值得记录，继续沿着街道慢慢走。'.repeat(20):'走过街角，看见了日常里的风景。',createdAt:'2026-10-31T12:00:00+09:00'}))
  const photos=empty?[]:Array.from({length:photoCount},(_,i)=>({id:i+1,tripId:trip.id,checkinId:i%3+1,storageKey:`fixture${i}`,imageUrl:web+'/images/explore/'+pictures[i%8]+'.jpg',mimeType:'image/jpeg',featured:i%3===0,capturedAt:`2026-10-${i%3===2?'31':'30'}T12:${String(i*3).padStart(2,'0')}:00+09:00`,createdAt:'2026-10-31T12:00:00+09:00',width:1200,height:900}))
  const timeline=['2026-10-30','2026-10-31'].map(date=>({date,items:checkins.filter(c=>c.checkinTime.startsWith(date)).map(checkin=>({checkin,photos:photos.filter(p=>p.checkinId===checkin.id)}))}))
  const itinerary=empty?[]:[...checkins.map(c=>({id:c.id,placeId:c.placeId,placeName:c.placeName,area:c.area,plannedDate:c.checkinTime.slice(0,10),plannedTime:'09:00:00',status:'DONE',sortOrder:c.id,latitude:c.latitude,longitude:c.longitude})),{id:4,placeId:101,placeName:'浅草街区晚间散步',plannedDate:'2026-11-01',plannedTime:'18:00:00',status:'PLANNED',sortOrder:4,latitude:35.71476,longitude:139.79665}]
  const summary={tripId:trip.id,title,status:trip.status,planType:'PRO',days:3,places:checkins.length,photos:photos.length,cities:1,areas:3,officialPlacesCompleted:3,officialPlacesTotal:30,explorationRate:10,dailyRecords:timeline.map(d=>({date:d.date,checkins:d.items.length,photos:d.items.reduce((n,i)=>n+i.photos.length,0),hasRecord:d.items.length>0})),readiness:{featuredPhotos:4,recordedDays:2,shareReady:!empty,videoReady:!empty}}
  const memoryTrips=trips.slice(1).map(t=>({...t,days:4,places:3,photos:12,cover:t.coverImage,moments:photos.slice(0,4),moreMoments:8,note:{text:'把走过的街道，收藏成值得回看的记忆。',place:'京都'},stories:0,shareLinks:1}))
  const memories={overview:{archivedTrips:memoryTrips.length,cities:1,photos:photos.length,creations:1},trips:memoryTrips,hasMore:false,timeline:memoryTrips.map(t=>({...t,cover:t.coverImage})),creations:memoryTrips.map(t=>({type:'SHARE_LINK',id:1,tripId:t.id,tripTitle:t.title,title:'东京旅行分享',preview:t.coverImage,url:'/s/fixture',createdAt:'2026-10-31T15:00:00+09:00',views:3})),photos:photos.map(p=>({...p,tripTitle:title,takenAt:p.capturedAt})),photoYear:2026,flashback:memoryTrips.length?{kind:'SEASON',yearsAgo:1,tripId:900002,title:'京都的春天',city:'京都',startDate:'2025-04-03',endDate:'2025-04-06',cover:trip.coverImage,photos:12,moments:photos.slice(0,3)}:null}
  const user={id:900001,email:stress?'very.long.fixture.email.address.for.layout@example.invalid':'layout@example.invalid',nickname:stress?'喜欢沿着街道散步并且记录旅行的测试用户':'布局验收',bio:stress?'记录生活和旅行里的日常风景。'.repeat(12):'用一次次到达，记录旅途。',locale:'zh-CN',timezone:'Asia/Tokyo',distanceUnit:'KM',emailNotifications:false,createdAt:'2025-01-01T00:00:00Z',lifetimePro:false}
  const overview={trips:trips.length,places:3,photos:photos.length,proTrips:empty?0:1,activeFreeTrips:0,freeTripLimit:1,tripProAmount:400,lifetimeAmount:100000,tripProCurrency:'CNY',lifetimePro:false,plans:trips.map(t=>({tripId:t.id,title:t.title,destinationName:t.destinationName,startDate:t.startDate,endDate:t.endDate,planType:t.planType,status:t.status}))}
  return `(() => {
    ${session?"localStorage.setItem('tabitrace-session','1');":"localStorage.removeItem('tabitrace-session');"}
    localStorage.setItem('tabitrace-live-trip-id','900001');localStorage.setItem('tabitrace.dev.dataSource','local');
    const trip=${JSON.stringify(trip)},trips=${JSON.stringify(trips)},places=${JSON.stringify(places)},checkins=${JSON.stringify(checkins)},photos=${JSON.stringify(photos)},timeline=${JSON.stringify(timeline)},itinerary=${JSON.stringify(itinerary)},summary=${JSON.stringify(summary)},memories=${JSON.stringify(memories)},user=${JSON.stringify(user)},overview=${JSON.stringify(overview)};
    const original=fetch.bind(window);window.__auditUnknown=[];window.__auditIntercepted=[];
    window.fetch=(input,init)=>{
      const url=new URL(typeof input==='string'?input:input.url,location.href),p=url.pathname,method=init?.method||input?.method||'GET';
      if(!p.startsWith('/api/v1/'))return original(input,init);
      if(method==='GET'&&['plans','official-cities','destinations','video-templates'].some(name=>p.startsWith('/api/v1/'+name)))return original(input,init).then(async response=>{
        if(!${enablePayments}||p!=='/api/v1/plans/trip-pro'||!response.ok)return response;
        const envelope=await response.json();
        Object.assign(envelope.data,{paymentsAvailable:true,unavailableReason:null,realPayments:false});
        return new Response(JSON.stringify(envelope),{headers:{'Content-Type':'application/json'}});
      });
      window.__auditIntercepted.push({p,method});let data=[];
      if(p.endsWith('/auth/refresh'))data={accessToken:'browser-layout-fixture'};
      else if(p==='/api/v1/users/me')data=user;
      else if(p.endsWith('/overview'))data=overview;
      else if(p==='/api/v1/trips')data=trips;
      else if(p.startsWith('/api/v1/trips/')&&p.split('/').length===5&&Number.isFinite(Number(p.split('/').pop())))data=trips.find(t=>p.endsWith('/'+t.id))||trip;
      else if(p.endsWith('/timeline'))data=timeline;
      else if(p.endsWith('/summary'))data=summary;
      else if(p.endsWith('/places'))data=places;
      else if(p.endsWith('/checkins'))data=checkins;
      else if(p.endsWith('/photos/page'))data={items:photos,nextCursor:null,counts:{total:photos.length,featured:photos.filter(p=>p.featured).length,linked:photos.length,unlinked:0}};
      else if(p.endsWith('/photos'))data=photos;
      else if(p.endsWith('/itinerary'))data=itinerary;
      else if(p.endsWith('/share-links'))data=[{id:1,tripId:900001,token:'fixture',status:'ACTIVE',viewCount:3,url:location.origin+'/s/fixture',createdAt:'2026-10-31T15:00:00Z'}];
      else if(p.endsWith('/recent-records'))data=checkins.map(c=>({kind:'CHECKIN',checkinId:c.id,placeName:c.placeName,area:c.area,at:c.checkinTime,photoCount:4,note:c.note}));
      else if(p==='/api/v1/me/memories')data=memories;
      else if(p.endsWith('/video-storyboard'))data={totalDuration:30,templateCode:'CITY_WALK',resolution:'1080x1920',watermark:false,transition:'fade',transitionSeconds:.5,notices:[],scenes:[{key:'opening',type:'OPENING',title:trip.title,start:0,duration:5,photoIds:[1],enabled:true,pinned:true,meta:{destination:'东京'}},{key:'place-1',type:'PLACE',title:places[0].name,start:5,duration:20,photoIds:[1,2,3],enabled:true,pinned:false,meta:{placeName:places[0].name}},{key:'ending',type:'ENDING',title:'把走过的风景，留在记忆里',start:25,duration:5,photoIds:[4],enabled:true,pinned:true,meta:{}}]};
      else if(p.endsWith('/video-projects')||p.endsWith('/sessions')||p.includes('/music')||p.endsWith('/favorite-places')||p==='/api/v1/payments')data=[];
      else if(p==='/api/v1/membership')data={status:'INACTIVE',plan:null};
      else if(p.endsWith('/usage'))data={day:'2026-11-05',renderRequests:2,outputSeconds:60,activeRenders:0,limits:{enforced:true,dailyRenders:20,dailyOutputSeconds:6000},media:{photoBytes:12000000,musicReservedBytes:0,videoBytes:24000000,variantEstimateBytes:4000000,unknownPhotos:0,unknownVideos:0}};
      else window.__auditUnknown.push({p,method});
      return Promise.resolve(new Response(JSON.stringify({success:true,data}),{headers:{'Content-Type':'application/json'}}));
    };
    const context=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:context.call(this,type,...args)};
    try{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:(_,error)=>error({code:1,message:'layout audit'})}})}catch{}
  })();`
}
