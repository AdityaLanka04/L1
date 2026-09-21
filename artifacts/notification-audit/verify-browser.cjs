const {chromium}=require(process.cwd()+'/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true}); const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const errors=[]; const page=await context.newPage(); await page.routeWebSocket('**', socket=>socket.close());page.on('pageerror',e=>errors.push(e.message));
 const jwt='test.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:'1'})).toString('base64url')+'.test';
 await context.addInitScript(token=>{localStorage.setItem('token',token);localStorage.setItem('username','audit');localStorage.setItem('userProfile',JSON.stringify({username:'audit',firstName:'Alex',notificationsEnabled:true}));sessionStorage.setItem('safetyAccepted','true');},jwt);
 let read=false,deleted=false;
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();
  if(url.pathname.includes('/api/')){
   if(url.pathname.includes('battle'))console.log('Battle request',url.pathname);
   let body={}; const name=url.pathname;
   if(name.endsWith('/friends'))body={friends:[{id:2,username:'ada@example.test',email:'ada@example.test',first_name:'Ada',last_name:'Lovelace',level:2,experience:1350},{id:3,username:'grace@example.test',email:'grace@example.test',experience:null},{id:4,username:'averyverylongusernameforlayoutchecks',first_name:'Alexandria',last_name:'Montgomery-Wellington',experience:70}]};
   if(name.endsWith('/friend_requests'))body={received:[],sent:[]};
   if(name.endsWith('/get_leaderboard'))body={leaderboard:[]};
   if(name.endsWith('/get_notifications'))body={notifications:deleted?[]:[{id:10,title:'Class assignment ready',message:'Your assignment feedback is ready. '.repeat(15),notification_type:'class_grade',created_at:new Date().toISOString(),is_read:read,action_url:'/student/assignments?assignment=5'}],unread_count:read?0:1,total_count:deleted?0:1,next_cursor:null};
   if(name.includes('/mark_notification_read'))read=true;
   if(name.includes('/delete_notification'))deleted=true;
   if(name.endsWith('/quiz_battles'))body={battles:[]};
   if(name.endsWith('/quiz_battle/7'))body={battle:{id:7,status:'pending',is_challenger:false,subject:'Probability',difficulty:'intermediate',question_count:10,time_limit_seconds:300,opponent:{id:2,first_name:'Ada',last_name:'Lovelace',username:'ada'}},questions:[]};
   if(name.endsWith('/me'))body={id:1,username:'audit',account_role:'learner'};
   if(name.endsWith('/get_comprehensive_profile'))body={username:'audit',firstName:'Alex',notificationsEnabled:true};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  }
  return route.abort();
 });
 await page.goto('http://127.0.0.1:3101/friends');await page.getByRole('heading',{name:'Ada Lovelace',exact:true}).waitFor();
 if(await page.locator('.fd-friend-name').filter({hasText:'@'}).count())throw new Error('Email heading still visible');
 if((await page.locator('body').innerText()).includes('NaN%'))throw new Error('NaN progress');
 await page.waitForTimeout(1200);
 await page.screenshot({path:'artifacts/notification-audit/friends-desktop-fixed.png',fullPage:true});
 await page.getByRole('button',{name:/Class assignment ready.*View details/}).click();
 await page.getByRole('dialog',{name:'Class assignment ready'}).waitFor();
 await page.screenshot({path:'artifacts/notification-audit/notification-details-fixed.png'});
 await page.keyboard.press('Escape'); if(await page.getByRole('dialog',{name:'Class assignment ready'}).count())throw new Error('Escape failed');
 await page.screenshot({path:'artifacts/notification-audit/friends-desktop-fixed.png',fullPage:true});
 await page.goto('http://127.0.0.1:3101/dashboard-cerbyl');
 await page.getByRole('button',{name:/^Notifications/}).click();
 await page.getByRole('button',{name:'Delete notification Class assignment ready',exact:true}).press('Enter');
 if(!deleted)throw new Error('Keyboard delete did not execute');
 if(await page.getByRole('dialog',{name:'Class assignment ready'}).count())throw new Error('Keyboard delete opened details');
 await page.goto('http://127.0.0.1:3101/friends');
 await page.getByRole('heading',{name:'Ada Lovelace',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(1200);await page.screenshot({path:'artifacts/notification-audit/friends-mobile-fixed.png',fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);if(overflow)throw new Error('Mobile horizontal overflow');
 await page.goto('http://127.0.0.1:3101/quiz-battles?battle=7');
 try { await page.getByRole('dialog',{name:'Battle Challenge!'}).waitFor({timeout:10000}); } catch(e) { console.log('DEBUG',await page.locator('body').innerText(),errors); await page.screenshot({path:'/tmp/battle-debug.png'}); throw e; }
 await page.keyboard.press('Escape');
 if(await page.getByRole('dialog',{name:'Battle Challenge!'}).count())throw new Error('Battle Escape failed');
 if(errors.length)throw new Error(errors.join('; '));
 console.log(JSON.stringify({emailHeadings:0,nanProgress:false,detailDialog:'passed',escape:'passed',mobileOverflow:overflow,pageErrors:errors}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
