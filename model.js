(function(root){
const dayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const fresh=()=>({date:dayKey(),capacity:12,assessed:false,ratings:[55,50,55],tasks:[],outfit:'bus',driving:false,ended:false,trips:0});
const make=()=>({version:3,day:fresh(),history:{}});
const used=d=>d.tasks.filter(t=>t.status==='onboard'||t.status==='done').reduce((n,t)=>n+t.load,0);
const archive=s=>{const d=s.day;const prev=s.history[d.date]||{};s.history[d.date]={capacity:d.capacity,assessed:d.assessed,done:(d.baseDone||0)+d.tasks.filter(t=>t.status==='done').length,load:(d.baseLoad||0)+d.tasks.filter(t=>t.status==='done').reduce((n,t)=>n+t.load,0),trips:d.trips}};
function rollover(s){if(s.day.date!==dayKey()){archive(s);s.day=fresh();return true}return false}
function action(s,type,p={}){rollover(s);const d=s.day;const t=d.tasks.find(t=>t.id===p.id);if(d.ended&&!['reopen','reset'].includes(type))throw Error('今天已收车，先继续今天再操作');
switch(type){case 'assess':if(p.capacity<used(d))throw Error('新容量小于已完成与已上车的总负荷，请先调整候车安排');d.capacity=p.capacity;d.ratings=p.ratings;d.assessed=true;break;
case 'add':if(!p.title.trim())throw Error('给这件事起个名字吧');d.tasks.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),title:p.title.trim(),load:p.load,urgency:p.urgency,status:'waiting'});break;
case 'edit':if(!t||t.status!=='waiting')throw Error('请先让乘客回到站台再编辑');Object.assign(t,{title:p.title.trim(),load:p.load,urgency:p.urgency});break;
case 'board':if(!d.assessed)throw Error('先评估今天的运力吧');if(!t||t.status!=='waiting')return;if(used(d)+t.load>d.capacity)throw Error('今天的座位不够啦，可以换一组乘客，或再接一程');t.status='onboard';break;
case 'leave':if(t?.status==='onboard')t.status='waiting';break;
case 'done':if(t?.status!=='onboard')return;t.status='done';if(!d.tasks.some(t=>t.status==='onboard'))d.driving=false;break;
case 'undo':if(t?.status==='done')t.status='onboard';break;
case 'delete':if(t?.status==='waiting')d.tasks=d.tasks.filter(x=>x.id!==t.id);break;
case 'start':if(!d.tasks.some(t=>t.status==='onboard'))throw Error('先送一组乘客上车吧');if(!d.driving)d.trips++;d.driving=true;break;
case 'pause':d.driving=false;break;
case 'extra':if(d.capacity>=20)throw Error('今天已是 20 座，留一点余力给自己吧');d.capacity=Math.min(20,d.capacity+2);break;
case 'end':d.ended=true;d.driving=false;break;
case 'reopen':d.ended=false;break;
case 'reset':{const prev=s.history[d.date];s.day=fresh();s.day.trips=Math.max(d.trips,prev?.trips||0);s.day.baseLoad=(d.baseLoad||0)+d.tasks.filter(t=>t.status==='done').reduce((n,t)=>n+t.load,0);s.day.baseDone=(d.baseDone||0)+d.tasks.filter(t=>t.status==='done').length;break;}
}return s}
const api={dayKey,fresh,make,used,archive,rollover,action};root.BusModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
