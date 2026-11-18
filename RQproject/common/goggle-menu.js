// =====================================================================
//  ゴーグル中のメニュー（goggle-menu.js）
//  ゴーグルに入れている間は画面をタッチできないので、Wiiリモコンだけで操作できるメニューを出す。
//    HOME … メニューを開く／閉じる
//    十字キー … 項目を選ぶ　　A … 決定　　B … 閉じる
//  メニューは3Dの板としてカメラの前に出すので、左右どちらの目にも同じように見える。
//  開いている間はゲームを止める（ゲームの menuOn を使う。画面の☰メニューは出さない）。
//
//  ゲーム本体（自分で2画面を描くゲーム）の <script> より後ろで読み込む：
//    <script src="../common/goggle-menu.js"></script>
//  使うもの：THREE / camera / head / fakeWii / menuOn / startGame / headRecenter / placeBoss / goggleStop
//
//  もう1つ：ログ表示の設定（localStorage の rq_show_log。既定は OFF）。RQLog.on() / RQLog.set(v)
// =====================================================================
window.RQLog = {
  on(){ try { return localStorage.getItem('rq_show_log') === '1'; } catch (e){ return false; } },
  set(v){
    try { localStorage.setItem('rq_show_log', v ? '1' : '0'); } catch (e){}
    const c = document.getElementById('skDbg');   // 剣士：設定パネルの「判定ログを表示」も合わせる
    if (c && c.checked !== !!v){ c.checked = !!v; c.dispatchEvent(new Event('change')); }
  },
};
(function(){
  if (typeof THREE === 'undefined' || typeof camera === 'undefined' || typeof head === 'undefined' || typeof fakeWii === 'undefined') return;
  const has = n => { try { return typeof eval(n) === 'function'; } catch (e){ return false; } };   // ゲームによって無い関数もある
  const inFrame = !!(window.RQ && RQ.gog);
  const M = { open:false, mask:false, sel:0, items:[], b0:0, b1:0, d:0 };

  function items(){
    const L = [{ t:'▶ ゲームに戻る', run:close }];
    if (typeof state !== 'undefined' && state !== 'title' && has('startGame')) L.push({ t:'🔄 最初からやり直す', run:() => { close(); startGame(); } });
    if (has('headRecenter')) L.push({ t:'🧭 向き合わせ（正面をリセット）', run:() => { close(); headRecenter(); } });
    if (has('placeBoss') && document.getElementById('gogPlace')) L.push({ t:'📍 ボスを置く（照準の先の床へ）', run:() => { close(); placeBoss(); } });
    L.push({ t:'📋 ログ表示：' + (RQLog.on() ? 'ON' : 'OFF'), run:() => { RQLog.set(!RQLog.on()); M.items = items(); draw(); } });
    L.push(inFrame ? { t:'🏠 ロビーへ戻る', run:() => { close(); try { goggleStop(); } catch (e){} RQ.go('lobby'); } }
                   : { t:'✕ ゴーグルを終わる', run:() => { close(); try { goggleStop(); } catch (e){} } });
    return L;
  }

  // ---- 表示（キャンバスに描いて、カメラの前の板に貼る）----
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 768;
  const cx = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.5), new THREE.MeshBasicMaterial({ map:tex, transparent:true, depthTest:false, depthWrite:false }));
  board.position.set(0, 0, -2.6); board.renderOrder = 999; board.frustumCulled = false; board.visible = false; camera.add(board);
  function draw(){
    const W = cv.width, H = cv.height, n = M.items.length, rh = Math.min(96, (H - 200)/n), y0 = 150;
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = 'rgba(4,12,22,.96)'; cx.strokeStyle = 'rgba(122,231,255,.7)'; cx.lineWidth = 4;
    cx.beginPath(); cx.roundRect ? cx.roundRect(8, 8, W - 16, H - 16, 36) : cx.rect(8, 8, W - 16, H - 16); cx.fill(); cx.stroke();
    cx.fillStyle = '#ffd35a'; cx.font = 'bold 56px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('MENU', W/2, 80);
    cx.font = 'bold 44px sans-serif';
    M.items.forEach((it, i) => {
      const y = y0 + i*rh + rh/2, s = i === M.sel;
      if (s){ cx.fillStyle = 'rgba(122,231,255,.25)'; cx.fillRect(60, y - rh/2 + 6, W - 120, rh - 12); cx.fillStyle = '#7ae7ff'; cx.fillText('▶', 100, y); }
      cx.fillStyle = s ? '#ffffff' : '#9fb4c8'; cx.fillText(it.t, W/2 + 20, y);
    });
    cx.fillStyle = '#9fb4c8'; cx.font = '30px sans-serif';
    cx.fillText('十字キー：選ぶ　Ⓐ：決定　Ⓑ / HOME：閉じる', W/2, H - 50);
    tex.needsUpdate = true;
  }
  function open(){
    if (M.open) return; M.open = true; M.sel = 0; M.items = items(); draw();
    board.visible = true; window.RQ_GMENU_OPEN = true; menuOn = true;
  }
  function close(){
    if (!M.open) return; M.open = false; M.mask = true; board.visible = false; window.RQ_GMENU_OPEN = false; menuOn = false;
  }
  window.rqGogMenu = { open, close, isOpen:() => M.open };
  let wasOn = head.on;
  setInterval(() => {
    if (M.open && !head.on) close();   // ゴーグルを終えたら閉じる
    if (wasOn !== head.on){
      wasOn = head.on; try { if (has('dbgDraw')) dbgDraw(); } catch (e){}   // ログの出し分け（ゴーグル中は画面左上のログを消す）
      if (head.on) setTimeout(() => { try { if (has('popCam')) popCam('Wii の HOME でメニュー', '#7ae7ff', .5, 3); } catch (e){} }, 2500);   // メニューがあることを知らせる
    }
  }, 300);

  // ---- Wiiリモコンの入力を横取り：ゴーグル中の HOME はこのメニュー、開いている間のボタンはゲームに渡さない ----
  function noButtons(e, keepAll){
    const a = new Uint8Array(e.data.buffer.slice(e.data.byteOffset, e.data.byteOffset + e.data.byteLength));
    if (keepAll){ a[1] &= ~0x80; } else { a[0] &= 0x60; a[1] &= 0x60; }   // 0x60 は加速度の下位ビットなので残す
    return { reportId:e.reportId, data:new DataView(a.buffer), timeStamp:e.timeStamp, device:e.device };
  }
  function wrap(h){
    return e => {
      if (head.on && e.reportId >= 0x30 && e.reportId <= 0x3f && e.data && e.data.byteLength >= 2){
        const b0 = e.data.getUint8(0), b1 = e.data.getUint8(1), d = b0 & 0x0f;
        const pd = d & ~M.d, home = (b1 & 0x80) && !(M.b1 & 0x80), A = (b1 & 0x08) && !(M.b1 & 0x08), B = (b1 & 0x04) && !(M.b1 & 0x04);
        M.b0 = b0; M.b1 = b1; M.d = d;
        if (M.mask && !(b0 & 0x1f) && !(b1 & 0x9f)) M.mask = false;   // 閉じた後、ボタンを全部離すまではゲームに渡さない
        if (M.open){
          if (pd & 0x09) M.sel = (M.sel - 1 + M.items.length) % M.items.length;   // 上・左（縦持ち・横持ちどちらでも）
          if (pd & 0x06) M.sel = (M.sel + 1) % M.items.length;                    // 下・右
          if (pd) draw();
          if (A){ const it = M.items[M.sel]; if (it) it.run(); }
          else if (B || home) close();
          e = noButtons(e, false);
        } else if (home){ open(); e = noButtons(e, false); }
        else if (M.mask) e = noButtons(e, false);
        else e = noButtons(e, true);   // HOME だけ消す（ゲームの☰メニューは開かない）
      }
      return h(e);
    };
  }
  let raw = fakeWii.oninputreport || null, wrapped = raw ? wrap(raw) : null;
  Object.defineProperty(fakeWii, 'oninputreport', {
    configurable:true,
    get(){ return wrapped; },
    set(f){ raw = f; wrapped = f ? wrap(f) : null; },
  });
})();
