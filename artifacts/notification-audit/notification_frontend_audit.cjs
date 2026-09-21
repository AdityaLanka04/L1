const fs=require('fs'),vm=require('vm');
const root=process.cwd();const babel=require(root+'/node_modules/@babel/core');
const code=babel.transformSync(fs.readFileSync('src/contexts/NotificationContext.js','utf8'),{presets:[require.resolve(root+'/node_modules/@babel/preset-react')],plugins:[require.resolve(root+'/node_modules/@babel/plugin-transform-modules-commonjs')],babelrc:false,configFile:false}).code;
let slots=[],cursor=0,timers=new Map(),tid=0,storage={token:'token-a',username:'user-a'},pending;
const React={createContext:()=>({Provider:'provider'}),useState:(v)=>{let i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],x=>slots[i]=typeof x==='function'?x(slots[i]):x]},useRef:(v)=>{let i=cursor++;return slots[i]||(slots[i]={current:v})},useCallback:f=>f,useEffect:()=>{},createElement:(type,props)=>props};
const context={exports:{},require:name=>name==='react'?React:{API_URL:'/api'},React,localStorage:{getItem:k=>storage[k]||null},Date,Set,Map,window:{},setTimeout:(f,ms)=>{timers.set(++tid,{f,ms});return tid},clearTimeout:id=>timers.delete(id),setInterval:()=>1,clearInterval:()=>{},fetch:(...args)=>pending(...args)};
vm.runInNewContext(code,context);function render(){cursor=0;return context.exports.NotificationProvider({children:null}).value}
const tick=()=>new Promise(r=>setImmediate(r));
const now=Date.now();const item={id:1,title:'Reminder',message:'Due soon [reminder_due_at:'+new Date(now+60000).toISOString()+']',notification_type:'reminder',is_read:false,created_at:new Date(now).toISOString()};
(async()=>{
 pending=async()=>({ok:true,json:async()=>({notifications:[item]})});render().refreshNotifications();await tick();
 pending=async()=>({ok:true});await render().markNotificationAsRead(1);console.log('After mark read, scheduled due timers:',timers.size);for(const t of timers.values())t.f();console.log('After due timer, read reminder popup count:',render().slideQueue.length);
 // Unread count incorrectly decremented for an already-read item.
 pending=async()=>({ok:true,json:async()=>({notifications:[{...item,is_read:true},{...item,id:2,message:'other'}]})});render().refreshNotifications();await tick();pending=async()=>({ok:true});await render().markNotificationAsRead(1);console.log('Already-read click: badge=',render().unreadCount,'actual unread=',render().notifications.filter(n=>!n.is_read).length);
 // Slow old response overwrites a successful deletion.
 let resolve;pending=()=>new Promise(r=>resolve=r);render().refreshNotifications();pending=async()=>({ok:true});await render().deleteNotification(2);resolve({ok:true,json:async()=>({notifications:[{...item,id:2}]})});await tick();console.log('Deleted notification restored by stale poll:',render().notifications.some(n=>n.id===2));
 // A request issued before disabling notifications can repopulate the inbox.
 pending=()=>new Promise(r=>resolve=r);render().refreshNotifications();storage.userProfile=JSON.stringify({notificationsEnabled:false});render().refreshNotifications();await tick();resolve({ok:true,json:async()=>({notifications:[item]})});await tick();console.log('Disabled setting: inbox repopulated by pending request:',render().notifications.length);
})();
