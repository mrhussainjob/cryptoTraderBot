(function(){
    const $=s=>document.querySelector(s);
    const state={poll:130,symbols:[],positions:[],closed:[],nextId:1,countdown:130};
  
    function log(m){ $('#log').textContent = `[${new Date().toLocaleTimeString()}] ${m}\n`+$('#log').textContent; }
    function fmtNum(n,d=2){ return (n==null||isNaN(n))?'-':Number(n).toFixed(d); }
  
    // Tabs
    document.querySelectorAll('.tab').forEach(tab=>{
      tab.onclick=()=>{
        document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        ['price','active','closed','autotrade','settings'].forEach(id=>{
          $('#'+id+'Tab').style.display=(tab.dataset.tab===id)?'block':'none';
        });
      };
    });
  
    // Settings
    $('#add').onclick=()=>{
      const sym=$('#sym').value.trim();
      const url=$('#url').value.trim();
      if(!sym||!url){alert('Enter symbol+url');return;}
      if(state.symbols.find(x=>x.sym===sym)) return alert('Symbol exists');
      state.symbols.push({sym,endpoint:url});
      renderSymbols();
    };
    function renderSymbols(){
      const tb=$('#symTable tbody');tb.innerHTML='';
      const sel=$('#tradeSymSel'); sel.innerHTML='';
      state.symbols.forEach(s=>{
        tb.innerHTML+=`<tr><td>${s.sym}</td><td>${s.endpoint}</td></tr>`;
        sel.innerHTML+=`<option value="${s.sym}">${s.sym}</option>`;
      });
    }
  
    // Networking
    async function httpGet(u){
      try{let r=await fetch(u,{cache:'no-store'}); if(!r.ok) throw new Error(r.status); return await r.json();}
      catch(e){ log('Fetch error: '+e.message); return null; }
    }
    function parseDiadata(j){ if(!j||j.Price==null) return null; return {price:+j.Price, prev:+j.PriceYesterday||null, time:new Date(j.Time).toLocaleTimeString()}; }
  
    // Signals
    function getSignal(price,prev){ if(!prev) return 'HOLD'; const chg=(price/prev-1)*100; if(chg>1) return 'BUY'; if(chg<-1) return 'EXIT'; return 'HOLD'; }
  
    // Price table
    function ensureRow(sym){ const tb=$('#liveTable tbody'); let tr=tb.querySelector(`tr[data-sym="${sym}"]`); if(!tr){ tr=document.createElement('tr'); tr.setAttribute('data-sym',sym); tb.appendChild(tr);} return tr; }
    function updateRow(s){
      const q=s.last; if(!q) return; const tr=ensureRow(s.sym);
      let chgPct = q.prev? ((q.price/q.prev-1)*100) : null;
      let arrowClass = chgPct==null? '' : (chgPct>=0? 'arrow-up':'arrow-down');
      const chgStr = chgPct==null? '-' : `<span class="${arrowClass}">${fmtNum(chgPct,2)}%</span>`;
      tr.innerHTML=`<td>${s.sym}</td><td>${fmtNum(q.price,2)}</td><td>${chgStr}</td><td>${getSignal(q.price,q.prev)}</td><td>${q.time}</td>`;
    }
  
    // Positions
    function renderOpen(){ const tb=$('#posOpen tbody'); tb.innerHTML=''; let tot=0;
      state.positions.forEach(p=>{ const pnl=(p.current-p.entry)*p.qty; p.pnl=pnl; tot+=pnl;
        const col=pnl>=0?'up':'down';
        tb.innerHTML+=`<tr><td>${p.id}</td><td>${p.sym}</td><td>${p.strategy}</td><td>${fmtNum(p.amount,2)}</td><td>${fmtNum(p.entry,2)}</td><td>${fmtNum(p.current,2)}</td><td class="${col}">${fmtNum(pnl,2)}</td><td><button class="red" data-close="${p.id}">Sell</button></td></tr>`;
      });
      $('#openTot').textContent=fmtNum(tot,2);
      tb.querySelectorAll('button[data-close]').forEach(b=>b.onclick=()=>closePos(+b.dataset.close));
    }
    function renderClosed(){ const tb=$('#posClosed tbody'); tb.innerHTML=''; let tot=0;
      state.closed.forEach(p=>{ const col=p.pnl>=0?'up':'down'; tot+=p.pnl;
        tb.innerHTML+=`<tr><td>${p.id}</td><td>${p.sym}</td><td>${p.strategy}</td><td>${fmtNum(p.amount,2)}</td><td>${fmtNum(p.entry,2)}</td><td>${fmtNum(p.exit,2)}</td><td class="${col}">${fmtNum(p.pnl,2)}</td></tr>`;
      });
      $('#closedTot').textContent=fmtNum(tot,2);
    }
    function openPos(sym,strategy,amount){
      const s=state.symbols.find(x=>x.sym===sym); if(!s||!s.last){ alert('No quote yet for '+sym); return; }
      const id=state.nextId++; const entry=s.last.price; const amt=amount||1000; const qty=amt/entry;
      state.positions.push({id,sym,strategy,entry,current:entry,qty,amount:amt,pnl:0});
      renderOpen(); log(`Opened ${sym} (${strategy}) for $${amt} @ ${entry}`);
    }
    function closePos(id){ const i=state.positions.findIndex(p=>p.id===id); if(i<0) return; const p=state.positions[i]; p.exit=p.current; p.pnl=(p.current-p.entry)*p.qty; state.closed.push(p); state.positions.splice(i,1); renderOpen(); renderClosed(); log(`Closed ${p.sym} @ ${p.exit} P&L ${p.pnl}`); }
  
    // Hook up New Trade button
    document.getElementById('newTrade').onclick=()=>{ if(!state.symbols.length) return alert('Add symbol in Settings'); const sym=$('#tradeSymSel').value; const strat=$('#tradeStratSel').value; const amt=parseFloat($('#tradeAmt').value)||1000; openPos(sym,strat,amt); };
  
    // Polling
    async function poll(){
      for(const s of state.symbols){ const j=await httpGet(s.endpoint); const q=parseDiadata(j); if(q){ s.last=q; updateRow(s); state.positions.filter(p=>p.sym===s.sym).forEach(p=>{p.current=q.price;}); renderOpen(); } }
      state.countdown=state.poll;
    }
  
    // Timers
    setInterval(()=>{ if(state.countdown>0) state.countdown--; $('#lastGlobal').textContent='Next refresh in: '+state.countdown+'s'; },1000);
    setInterval(poll,state.poll*1000);
    poll();
  })();
  