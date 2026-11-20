const $ = s => document.querySelector(s);
const auth = $("#auth"), app = $("#app");
let market = {};
function money(n){return "$"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});}
async function api(url, options={}) {
  const res = await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data = await res.json().catch(()=>({error:"Unexpected server response."}));
  if(!res.ok) throw new Error(data.error||"Request failed.");
  return data;
}
function formData(form){return Object.fromEntries(new FormData(form).entries());}
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===btn));
  $("#loginForm").hidden=btn.dataset.tab!=="login"; $("#registerForm").hidden=btn.dataset.tab!=="register"; $("#authMsg").textContent="";
}));
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/login",{method:"POST",body:JSON.stringify(formData(e.target))});await loadDashboard();}catch(err){$("#authMsg").textContent=err.message;}});
$("#registerForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/register",{method:"POST",body:JSON.stringify(formData(e.target))});await loadDashboard();}catch(err){$("#authMsg").textContent=err.message;}});
$("#logout").addEventListener("click",async()=>{await api("/api/logout",{method:"POST"});app.hidden=true;auth.hidden=false;});
$("#tradeForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/trade",{method:"POST",body:JSON.stringify(formData(e.target))});$("#tradeMsg").style.color="var(--green)";$("#tradeMsg").textContent="Demo order completed.";await loadDashboard();}catch(err){$("#tradeMsg").style.color="#ff9b9b";$("#tradeMsg").textContent=err.message;}});
function updateEstimate(){const f=formData($("#tradeForm"));const total=(market[f.symbol]||0)*Number(f.quantity||0);$("#estimate").textContent=total?`Estimated order value: ${money(total)} · simulated only`:"Select an asset and quantity.";}
$("#tradeForm").addEventListener("input",updateEstimate);
$("#tradeForm").addEventListener("change",updateEstimate);
async function loadDashboard(){
  try{
    const [data,markets]=await Promise.all([api("/api/me"),api("/api/market")]);
    market=Object.fromEntries(markets.map(x=>[x.symbol,x.price]));
    auth.hidden=true;app.hidden=false;$("#userName").textContent=data.user.name;$("#balance").textContent=money(data.user.balance);
    $("#markets").innerHTML=markets.map(x=>`<div class="market"><span class="muted tiny">${x.label}</span><strong class="price">${money(x.price)}</strong><span class="green tiny">Demo reference price</span></div>`).join("");
    $("#holdings").innerHTML=data.holdings.length?data.holdings.map(h=>`<div class="row"><strong>${h.symbol}</strong><span>${Number(h.quantity).toFixed(6)}</span><span>${money(h.quantity*market[h.symbol])}</span></div>`).join(""):"No assets yet.";
    $("#trades").innerHTML=data.trades.length?data.trades.map(t=>`<div class="row"><span><strong>${t.side.toUpperCase()} ${t.symbol}</strong><br><small class="muted">${new Date(t.created_at+"Z").toLocaleString()}</small></span><span>${Number(t.quantity).toFixed(6)}</span><strong>${money(t.total)}</strong></div>`).join(""):"No trades yet.";
    $("#tradeMsg").textContent="";updateEstimate();
    if(data.user.role==="admin"){const admin=await api("/api/admin");$("#adminSection").hidden=false;$("#adminStats").textContent=`${admin.totals.users} registered users · ${money(admin.totals.virtual_balance)} total virtual balances`;$("#adminUsers").innerHTML=admin.users.map(u=>`<div class="row"><span>${u.name}<br><small class="muted">${u.email} · ${u.role}</small></span><strong>${money(u.balance)}</strong></div>`).join("");}
  }catch(err){if(err.message.includes("sign in")){auth.hidden=false;app.hidden=true;}else console.error(err);}
}
(async()=>{try{await loadDashboard();}catch(_){}})();
