/* CPL Poultry apps — sign-in with 3 levels: Viewer, Co-worker, Administrator.
   Passwords live (scrambled) in passwords.js. Make new ones with make-passwords.html.
   NOTE: this is a simple door lock for a website that has no server. It keeps casual users out;
   it is not bank-level security. */
(function(){
  // ---- SHA-256 (small, works on every browser, also without https) ----
  function sha256(ascii){
    function rr(v,a){ return (v>>>a)|(v<<(32-a)); }
    var mp=Math.pow, mw=mp(2,32), i, j, res="", words=[], len=ascii.length*8, hash=[], k=[], pc=0, ic={};
    for(var c=2;pc<64;c++){ if(!ic[c]){ for(i=0;i<313;i+=c) ic[i]=c; hash[pc]=(mp(c,.5)*mw)|0; k[pc++]=(mp(c,1/3)*mw)|0; } }
    ascii+="\x80"; while(ascii.length%64-56) ascii+="\x00";
    for(i=0;i<ascii.length;i++){ j=ascii.charCodeAt(i); if(j>>8) return ""; words[i>>2]|=j<<((3-i)%4)*8; }
    words[words.length]=((len/mw)|0); words[words.length]=(len);
    for(j=0;j<words.length;){
      var w=words.slice(j,j+=16), old=hash; hash=hash.slice(0,8);
      for(i=0;i<64;i++){
        var w15=w[i-15], w2=w[i-2], a=hash[0], e=hash[4];
        var t1=hash[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]+(w[i]=(i<16)?w[i]:(w[i-16]+(rr(w15,7)^rr(w15,18)^(w15>>>3))+w[i-7]+(rr(w2,17)^rr(w2,19)^(w2>>>10)))|0);
        var t2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
        hash=[(t1+t2)|0].concat(hash); hash[4]=(hash[4]+t1)|0;
      }
      for(i=0;i<8;i++) hash[i]=(hash[i]+old[i])|0;
    }
    for(i=0;i<8;i++) for(j=3;j+1;j--){ var b=(hash[i]>>(j*8))&255; res+=((b<16)?0:"")+b.toString(16); }
    return res;
  }
  function hashPw(pw){ return sha256("cpl-poultry|" + unescape(encodeURIComponent(String(pw).trim()))); }

  var NAMES = { viewer:"Viewer", coworker:"Co-worker", admin:"Administrator" };
  var KEY = "cpl_auth";
  var PW = window.CPL_PW || {};
  var AUTH = { role:null, hash:hashPw, names:NAMES };
  window.CPL_AUTH = AUTH;
  AUTH.can = function(what){
    var r = AUTH.role;
    if(what === "edit") return r === "coworker" || r === "admin";
    if(what === "days") return r === "coworker" || r === "admin";   // view individual dates in Monthly Records
    if(what === "backup" || what === "delete") return r === "admin";
    return true;                                                    // view, pdf, cloud connect: everyone
  };
  if(window.CPL_NOGATE) return;

  var stored = null;
  try{ stored = JSON.parse(localStorage.getItem(KEY)); }catch(e){}
  var MAX_AGE = 24*60*60*1000;   // everyone is logged out 24 hours after they signed in
  function fresh(st){ return st && typeof st.t === "number" && (Date.now() - st.t) < MAX_AGE && st.t <= Date.now() + 60000; }
  if(stored && PW[stored.role] && stored.h === PW[stored.role] && fresh(stored)) AUTH.role = stored.role;

  function logout(){ try{ localStorage.removeItem(KEY); }catch(e){} location.reload(); }
  AUTH.logout = logout;

  // ---------------- not signed in: show the password screen ----------------
  if(!AUTH.role){
    var st = document.createElement("style"); st.id = "cpl-gate-style";
    st.textContent = "body>*:not(#cpl-gate){display:none!important} body{background:#2b4127!important}";
    document.documentElement.appendChild(st);
    document.addEventListener("DOMContentLoaded", function(){
      var d = document.createElement("div"); d.id = "cpl-gate";
      d.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#2b4127;z-index:100000;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:16px;";
      d.innerHTML = '<form id="cpl-gate-form" style="background:#f7f5ef;border-radius:12px;padding:22px;max-width:340px;width:100%;text-align:center;border-top:5px solid #c98a2c;">'
        + '<div style="font-size:19px;font-weight:700;color:#2b4127;">CPL Poultry Division</div>'
        + '<div style="font-size:13px;color:#6a6a5e;margin:4px 0 14px;">Enter your password to open the forms</div>'
        + '<input id="cpl-gate-pw" type="password" autocomplete="current-password" placeholder="Password" style="width:100%;font-size:17px;padding:11px;border:1px solid #d8d3c4;border-radius:8px;text-align:center;">'
        + '<div id="cpl-gate-msg" style="color:#b3261e;font-size:13px;min-height:18px;margin:8px 0;"></div>'
        + '<button type="submit" style="width:100%;border:0;border-radius:8px;padding:12px;font-size:15px;font-weight:700;background:#2b4127;color:#fff;cursor:pointer;">Open</button>'
        + '<div style="font-size:11.5px;color:#6a6a5e;margin-top:12px;">Viewer: view &amp; PDF · Co-worker: enter records &amp; PDF · Administrator: everything</div></form>';
      document.body.appendChild(d);
      var inp = document.getElementById("cpl-gate-pw"); setTimeout(function(){ try{ inp.focus(); }catch(e){} }, 50);
      document.getElementById("cpl-gate-form").addEventListener("submit", function(ev){
        ev.preventDefault();
        var h = hashPw(inp.value), role = null;
        ["admin","coworker","viewer"].forEach(function(r){ if(!role && PW[r] && PW[r] === h) role = r; });
        if(!role){ document.getElementById("cpl-gate-msg").textContent = "Wrong password. Try again."; inp.value = ""; return; }
        try{ localStorage.setItem(KEY, JSON.stringify({ role:role, h:h, t:Date.now() })); }catch(e){}
        location.reload();
      });
    });
    return;
  }

  // ---------------- signed in ----------------
  var role = AUTH.role;
  // while a page is left open, check once a minute and when the phone wakes up
  function checkExpiry(){ var st = null; try{ st = JSON.parse(localStorage.getItem(KEY)); }catch(e){} if(!fresh(st)) logout(); }
  setInterval(checkExpiry, 60000);
  document.addEventListener("visibilitychange", function(){ if(!document.hidden) checkExpiry(); });
  document.addEventListener("DOMContentLoaded", function(){
    // small badge with log out
    var b = document.createElement("div");
    b.style.cssText = "position:fixed;top:6px;right:8px;z-index:99999;background:rgba(0,0,0,.55);color:#fff;font:600 11px system-ui,Arial,sans-serif;padding:4px 9px;border-radius:12px;";
    b.innerHTML = NAMES[role] + ' · <a href="#" style="color:#ffd88a;text-decoration:underline;">Log out</a>';
    b.querySelector("a").addEventListener("click", function(e){ e.preventDefault(); logout(); });
    document.body.appendChild(b);

    // admin-only and co-worker-up parts of Monthly Records
    function hideIf(sel, yes){ if(!yes) return; document.querySelectorAll(sel).forEach(function(el){ el.style.display = "none"; }); }
    hideIf("#backup-card", !AUTH.can("backup"));
    hideIf("#days-card", !AUTH.can("days"));

    if(role !== "viewer") return;

    // ---------------- Viewer: look and print only ----------------
    var KEEP_IDS = { "f-date":1, "month":1, "sync-pass":1, "sync-url":1 };
    var HIDE_BTN = /clear|delete|remove|add|scan|photo|signature|sig-|toggle|save|restore|import|backup|reset|cancel|apply|undo|✕|\+/i;
    function lockAll(){
      document.querySelectorAll("input,textarea,select").forEach(function(el){
        if(el.closest("#share-card") || el.closest("#cpl-gate") || KEEP_IDS[el.id]) return;
        if(el.tagName === "SELECT" || el.type === "checkbox" || el.type === "radio" || el.type === "file") el.disabled = true;
        else el.readOnly = true;
      });
      document.querySelectorAll("button, .add-row, .remove-btn, a.btn-danger").forEach(function(el){
        if(el.closest("#share-card") || el.closest("#cpl-gate")) return;
        var t = (el.textContent||"") + " " + (el.getAttribute("onclick")||"") + " " + (el.className||"");
        if(HIDE_BTN.test(t)) el.style.display = "none";
      });
    }
    var tm = null;
    function later(){ clearTimeout(tm); tm = setTimeout(lockAll, 60); }
    lockAll();
    new MutationObserver(later).observe(document.body, { childList:true, subtree:true });

    // nothing a Viewer does can be saved
    if(typeof window.cplDbPut === "function") window.cplDbPut = function(){ return false; };
    var note = document.createElement("div");
    note.style.cssText = "background:#fff4d6;border-bottom:1px solid #e0c98a;color:#6b4a00;font:12.5px system-ui,Arial,sans-serif;padding:6px 12px;text-align:center;";
    note.textContent = "Viewer access — you can look at records and make PDFs, but not change anything.";
    document.body.insertBefore(note, document.body.firstChild);
  });

  if(role === "viewer"){
    var rawSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v){
      if(/^(cpl_records_v1|cpl_sync_cfg|cpl_sync_status|cpl_auth|cpl_seg_last_date|cpl_last_backup)$/.test(k)) return rawSet.call(this, k, v);
      // everything else is a data change: ignore for Viewer
    };
  }
})();
