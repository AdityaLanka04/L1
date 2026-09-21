const {chromium}=require(process.cwd()+'/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true}); const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const errors=[]; const page=await context.newPage(); await page.routeWebSocket('**', socket=>socket.close());page.on('pageerror',e=>errors.push(e.message));
 const jwt='test.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:'1'})).toString('base64url')+'.test';
 await context.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('username','audit');localStorage.setItem('userProfile',JSON.stringify({username:'audit',firstName:'Alex',notificationsEnabled:true}));sessionStorage.setItem('safetyAccepted','true');},jwt);

 await page.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.hostname==='127.0.0.1')return route.continue();
 if(url.pathname.includes('/api/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(url.pathname.includes('playlists')?{playlists:[]}:{notifications:[],unread_count:0,total_count:0,username:'audit'})});
 return route.abort();
 });
 await page.goto('http://127.0.0.1:3101/playlists');
 await page.getByRole('button',{name:/new playlist/i}).first().click();
 const dialog=page.getByRole('dialog',{name:'Create Playlist'});
 await dialog.waitFor();
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['small-mobile',320,568],['landscape',844,390]]){
 await page.setViewportSize({width,height});
 await page.waitForTimeout(400);
 await page.getByRole('button',{name:/Choose cover color/}).click();
 await page.getByLabel('Allow collaborators').scrollIntoViewIfNeeded();
 const layout=await page.evaluate(()=>{
 const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
 return {dialog:rect('.playlist-create-dialog'),fields:rect('.playlist-create-fields'),footer:rect('.playlist-create-footer'),checkbox:rect('.form-checkboxes'),overflow:document.documentElement.scrollWidth>innerWidth};
 });
 if(layout.overflow||layout.dialog.bottom>height||layout.dialog.top<0||layout.fields.bottom>layout.footer.top+1||layout.checkbox.bottom>layout.footer.top+1)throw new Error(name+JSON.stringify(layout));
 await page.waitForTimeout(700);
 await page.screenshot({path:'artifacts/playlist-ui/'+name+'.png'});
 await page.getByRole('button',{name:/Choose cover color/}).click();
 console.log(name+' passed',layout);
 }
 await page.keyboard.press('Escape');
 if(await dialog.count())throw new Error('Escape failed');
 if(errors.length)throw new Error(errors.join(';'));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
