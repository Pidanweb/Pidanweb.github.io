// =====================================================================
//  ボス登場の演出（boss-intro.js）
//  スタートを押してから戦闘開始までの約7秒：
//    ① 警報が2回鳴る（画面が赤く点滅）
//    ② 画面中央に「BOSS BATTLE ─ ボスの名前 ─」
//    ③ ボスが上から降ってきて着地（ドスン・画面が揺れる）
//       ふつうの画面：カメラがボスに寄って大きく映す
//    ④ ボスが咆哮
//    ⑤ カメラが自分の視点に戻って、開始の音で戦闘スタート
//  演出中にもう一度スタート（クリック / Ⓐ / ＋）を押すと飛ばせる。
//  ヴォルグラム（sord_boss）は ①② だけ（その後はゲーム本来の「歩いてきて咆哮」）。
//
//  ゴーグル中はカメラを動かさない（頭を動かしていないのに視点が勝手に動くと酔いやすいため）。
//  ボスは正面に降ってくるので、そのまま見ていればOK。
//
//  ゲーム本体の <script> より後ろで読み込む：<script src="../common/boss-intro.js"></script>
//  使うもの：THREE / camera / bossG / B / HOVER / state / reset / setMsg / startBattle / render / head / shake / actx / vol / popCam
//  ボスの名前は window.RQ_BOSS_NAME があればそれ、なければファイル名から決める
// =====================================================================
(function(){
  if (typeof THREE === 'undefined' || typeof bossG === 'undefined' || typeof B === 'undefined' || typeof startBattle !== 'function' || typeof render !== 'function') return;
  const FILE = location.pathname.split('/').pop();
  const NAMES = { 'gun_practice.html':'練習用スライム', 'gun_trial.html':'体験版スライム', 'gun_practice_robot.html':'練習用ロボット', 'sord_boss.html':'灰牙の獣王 ヴォルグラム' };
  const NAME = window.RQ_BOSS_NAME || NAMES[FILE] || 'ジャイアントスライム';
  // 'full' … 警報 → 帯 → 降ってくる → 咆哮 → 開始（全部）
  // 'banner' … 警報 → 帯 → ゲーム本来の登場（ヴォルグラムは自分で歩いてきて咆哮するので、ここまでだけ）
  const MODE = window.RQ_INTRO_MODE || (FILE === 'sord_boss.html' ? 'banner' : 'full');
  const BANNER_END = 3.65;   // banner の時、ここで戦闘（ゲーム本来の登場）へ
  const T = { banner:1.75, drop:3.3, land:3.95, roar:4.45, back:6.1, go:6.8 };   // 秒
  const I = { on:false, t0:0, h:3.6, ev:{} };

  // ---------- 音（ゲームの AudioContext と効果音の音量 vol を使う）----------
  const ctx = () => { try { actx = actx || new AudioContext(); if (actx.state === 'suspended') actx.resume(); return actx; } catch (e){ return null; } };
  const V = () => (typeof vol === 'number' ? vol : .8);
  let nb = null;
  function noiseBuf(a){ if (nb) return nb; nb = a.createBuffer(1, a.sampleRate*2, a.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1; return nb; }
  function env(a, t, peak, atk, dur){ const g = a.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak*V(), t + atk); g.gain.exponentialRampToValueAtTime(.0001, t + dur); g.connect(a.destination); return g; }
  function osc(a, t, type, f, dur, peak, atk = .01, fil){
    const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(f[0], t);
    for (let i = 1; i < f.length; i++) o.frequency.linearRampToValueAtTime(f[i], t + dur*i/(f.length - 1));
    const g = env(a, t, peak, atk, dur);
    if (fil){ const b = a.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = fil; o.connect(b); b.connect(g); } else o.connect(g);
    o.start(t); o.stop(t + dur + .05);
  }
  function noise(a, t, dur, type, freq, peak, atk = .01){
    const s = a.createBufferSource(); s.buffer = noiseBuf(a); const b = a.createBiquadFilter(); b.type = type; b.frequency.value = freq;
    s.connect(b); b.connect(env(a, t, peak, atk, dur)); s.start(t); s.stop(t + dur + .05);
  }
  const SND = {
    alert(){ const a = ctx(); if (!a) return; const t = a.currentTime;   // ウー↑ウー↓ の警報
      osc(a, t, 'square', [620, 1240, 620], .62, .07, .02, 2600); osc(a, t, 'sawtooth', [310, 620, 310], .62, .05, .02, 1400); },
    banner(){ const a = ctx(); if (!a) return; const t = a.currentTime;   // ドーン
      osc(a, t, 'sine', [110, 38], .9, .45, .005); noise(a, t, .5, 'lowpass', 900, .25); osc(a, t + .02, 'sawtooth', [220, 110], .5, .06, .005, 900); },
    whoosh(){ const a = ctx(); if (!a) return; const t = a.currentTime;   // ヒュー（落ちてくる）
      noise(a, t, .7, 'bandpass', 1800, .18, .5); osc(a, t, 'sine', [1400, 300], .65, .05, .3); },
    land(){ const a = ctx(); if (!a) return; const t = a.currentTime;   // ドスン
      osc(a, t, 'sine', [140, 32], .7, .7, .003); noise(a, t, .45, 'lowpass', 500, .5, .003); osc(a, t, 'triangle', [80, 40], .5, .25, .003); },
    roar(){ const a = ctx(); if (!a) return; const t = a.currentTime;   // グオオオ
      osc(a, t, 'sawtooth', [150, 185, 120, 70], 1.5, .32, .12, 1100); osc(a, t, 'sawtooth', [157, 190, 126, 74], 1.5, .26, .12, 900);
      osc(a, t, 'square', [75, 92, 60, 35], 1.5, .12, .12, 500); noise(a, t, 1.4, 'bandpass', 650, .3, .15); },
    start(){ const a = ctx(); if (!a) return; const t = a.currentTime;   // 開始のファンファーレ
      [523, 659, 784].forEach((f, i) => osc(a, t + i*.08, 'triangle', [f, f], .22, .2, .005));
      osc(a, t + .24, 'square', [1047, 1047], .55, .12, .005, 4000); osc(a, t + .24, 'triangle', [1568, 1568], .6, .12, .005); noise(a, t + .24, .3, 'highpass', 5000, .08); },
  };

  // ---------- 画面に付く表示（カメラの前の板。ゴーグルの左右どちらにも見える）----------
  const mkBoard = (w, h, cw, ch, z) => {
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const tex = new THREE.CanvasTexture(cv), m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map:tex, transparent:true, opacity:0, depthTest:false, depthWrite:false }));
    m.position.z = z; m.renderOrder = 998; m.frustumCulled = false; m.visible = false; camera.add(m);
    return { m, cv, x:cv.getContext('2d'), tex };
  };
  const ban = mkBoard(2.6, .975, 1024, 384, -3);
  { const { x, cv } = ban, W = cv.width, H = cv.height;
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(120,0,10,0)'); g.addColorStop(.18, 'rgba(120,0,10,.82)'); g.addColorStop(.82, 'rgba(120,0,10,.82)'); g.addColorStop(1, 'rgba(120,0,10,0)');
    x.fillStyle = g; x.fillRect(0, 40, W, H - 80);
    x.fillStyle = '#ffd35a'; x.fillRect(0, 40, W, 4); x.fillRect(0, H - 44, W, 4);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#ff2a3a'; x.shadowBlur = 24;
    x.fillStyle = '#ffffff'; x.font = 'italic 900 118px sans-serif'; x.fillText('BOSS BATTLE', W/2, H/2 - 40);
    x.shadowBlur = 10; x.fillStyle = '#ffd35a'; x.font = 'bold 54px sans-serif'; x.fillText('─ ' + NAME + ' ─', W/2, H/2 + 70);
    ban.tex.needsUpdate = true; }
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color:0xff1020, transparent:true, opacity:0, depthTest:false, depthWrite:false }));
  fl.position.z = -1; fl.renderOrder = 997; fl.frustumCulled = false; fl.visible = false; camera.add(fl);

  // ---------- 開始・終了 ----------
  function begin(){
    try { reset(); } catch (e){}
    try { setMsg(null); } catch (e){}
    state = 'intro';
    if (MODE === 'banner'){ I.on = true; I.t0 = performance.now(); I.ev = {}; return; }   // ボスは reset() の位置（奥）のまま
    B.x = 0; B.z = HOVER; B.s = 'idle'; B.t = 99;
    bossG.visible = true; bossG.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(bossG); I.h = box.isEmpty() ? 3.6 : Math.max(1, box.max.y - box.min.y);
    I.on = true; I.t0 = performance.now(); I.ev = {};
  }
  function finish(){
    I.on = false; ban.m.visible = fl.visible = false; bossG.visible = true;
    orig();   // ゲーム本来の開始（リセット・state = 'play'・BGM）
    if (MODE === 'banner') return;   // ボスはゲーム本来の登場（歩いてくる → 咆哮）
    B.x = 0; B.z = HOVER; B.s = 'idle'; B.t = 1.2;   // 降ってきた場所から、そのまま戦闘へ
    SND.start();
    try { popCam('BATTLE START!', '#ffd35a', 1, 1.2); } catch (e){}
  }
  const orig = startBattle;
  startBattle = function(){ if (I.on){ finish(); return; } begin(); };   // 演出中にもう一度押したら飛ばす

  // ---------- 毎フレーム：ボスの落下・咆哮、カメラ ----------
  const once = (k, t, at, f) => { if (t >= at && !I.ev[k]){ I.ev[k] = true; f(); } };
  const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u*u*(3 - 2*u);
  const sp = new THREE.Vector3(), sq = new THREE.Quaternion(), ss = new THREE.Vector3(), cp = new THREE.Vector3(), cq = new THREE.Quaternion();
  const tgt = new THREE.Vector3(), eye = new THREE.Vector3(), mat = new THREE.Matrix4(), lq = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  const origRender = render;
  render = function(){
    if (!I.on) return origRender();
    if (state !== 'intro'){ I.on = false; ban.m.visible = fl.visible = false; return origRender(); }   // 演出中に別の画面へ移った
    const t = (performance.now() - I.t0)/1000;
    once('a1', t, 0, SND.alert); once('a2', t, .85, SND.alert);
    once('bn', t, T.banner, SND.banner);
    if (MODE === 'banner'){
      if (t >= BANNER_END){ finish(); return origRender(); }
      let fo = 0; for (const s of [0, .85]) if (t >= s && t < s + .7) fo = Math.max(fo, .32*Math.sin(Math.PI*(t - s)/.7));
      fl.visible = fo > .001; fl.material.opacity = fo;
      const bo = t < T.banner ? 0 : Math.min(1, (t - T.banner)/.15, (BANNER_END - t)/.3);
      ban.m.visible = bo > .001; ban.m.material.opacity = Math.max(0, bo); ban.m.scale.setScalar(1 + .25*Math.max(0, 1 - (t - T.banner)/.15));
      return origRender();
    }
    once('wh', t, T.drop, SND.whoosh);
    once('ld', t, T.land, () => { SND.land(); shake = Math.max(typeof shake === 'number' ? shake : 0, .7); });
    once('ro', t, T.roar, () => { SND.roar(); shake = Math.max(shake || 0, .35); });
    if (t >= T.go){ finish(); return origRender(); }

    // 警報の赤い点滅・タイトルの帯
    let fo = 0; for (const s of [0, .85]) if (t >= s && t < s + .7) fo = Math.max(fo, .32*Math.sin(Math.PI*(t - s)/.7));
    fl.visible = fo > .001; fl.material.opacity = fo;
    const bo = t < T.banner ? 0 : Math.min(1, (t - T.banner)/.15, (T.drop + .25 - t)/.3);
    ban.m.visible = bo > .001; ban.m.material.opacity = Math.max(0, bo); ban.m.scale.setScalar(1 + .25*Math.max(0, 1 - (t - T.banner)/.15));

    // ボス：落下 → 着地でつぶれる → 咆哮で膨らむ
    sp.copy(bossG.position); ss.copy(bossG.scale);
    let dy = 0, ky = 1, kx = 1;
    if (t < T.drop) bossG.visible = false;
    else {
      bossG.visible = true;
      if (t < T.land){ const u = (t - T.drop)/(T.land - T.drop); dy = (I.h*3 + 10)*(1 - u*u); ky = 1.15; kx = .9; }
      else { const u = t - T.land; ky = 1 - .32*Math.exp(-u*5)*Math.cos(u*16); kx = 1/Math.sqrt(Math.max(.3, ky)); }
      if (t >= T.roar && t < T.roar + 1.5){ const u = (t - T.roar)/1.5, e = Math.sin(Math.PI*Math.min(1, u*1.6))*(1 - u*.4); kx *= 1 + .14*e + .03*Math.sin(t*60)*e; ky *= 1 + .1*e; }
    }
    bossG.position.y += dy; bossG.scale.set(ss.x*kx, ss.y*ky, ss.z*kx);

    // カメラ：ボスに寄る → 戻る（ゴーグル中は動かさない）
    const ck = head.on ? 0 : t < T.drop ? 0 : t < T.land ? ease((t - T.drop)/(T.land - T.drop)) : t < T.back ? 1 : 1 - ease((t - T.back)/(T.go - T.back));
    const camOK = ck > 0 && (!camera.parent || camera.parent.type === 'Scene');
    if (camOK){
      cp.copy(camera.position); cq.copy(camera.quaternion);
      tgt.set(sp.x, I.h*.5, sp.z);
      eye.set(cp.x - sp.x, 0, cp.z - sp.z); if (eye.lengthSq() < 1e-4) eye.set(0, 0, 1); eye.normalize();
      eye.multiplyScalar(I.h*1.15 + 2.2).add(tgt); eye.y = I.h*.42 + 1;
      mat.lookAt(eye, tgt, UP); lq.setFromRotationMatrix(mat);
      camera.position.lerpVectors(cp, eye, ck); camera.quaternion.slerpQuaternions(cq, lq, ck); camera.updateMatrixWorld();
    }
    // 手に持った剣・銃（カメラに付いている物）は演出の間だけ隠す。カメラ映像の板（vplane）と演出の板は残す
    const hid = [];
    for (const c of camera.children) if (c.visible && c !== ban.m && c !== fl && !(typeof vplane !== 'undefined' && c === vplane)){ c.visible = false; hid.push(c); }
    origRender();
    for (const c of hid) c.visible = true;
    bossG.position.copy(sp); bossG.scale.copy(ss);
    if (camOK){ camera.position.copy(cp); camera.quaternion.copy(cq); camera.updateMatrixWorld(); }
  };
})();
