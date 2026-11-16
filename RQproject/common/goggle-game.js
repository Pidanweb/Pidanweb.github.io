// =====================================================================
//  ゲーム側のゴーグルモード対応（goggle-game.js）
//  自分で2画面を描くゲーム（sord_boss / sord_slime / gunner_goggle）の </body> の直前に
//    <script src="../common/goggle-game.js"></script>
//  と書く（ゲーム本体の <script> より後ろ）。
//
//  goggle.html の中で開かれた時だけ動いて、
//    ・PC中継に自動でつなぐ（goggle.html で入れたコード）
//    ・ゴーグル表示（2画面・頭の向きで見回す）を自動で始める
//    ・ゴーグルの「✕ 終了」でロビーへ戻る
//  ふつうに開いた時は何もしない。
//  使っている関数：relayConnect(code) / goggleStart() / goggleStop()（ゲーム本体にあるもの）
//
//  もう1つの役目：観戦カメラ（setup/hub.html）用に、ボスの状態をPC中継へ送る（下の spectate）。
//  こちらは goggle.html の外でも、PC中継につながっていて部屋モードの時はいつも動く。
// =====================================================================
window.RQ_GOGGLE = 'self';   // goggle.html に「このページは自分で2画面を描く」と伝える

// ===== 観戦カメラ用：ボスの状態を1秒に20回 PC中継へ送る =====
// 送るもの：ボスの種類・床座標での位置と向きと大きさ（行列）・関節の角度・光り方・攻撃範囲の帯・HP
// 床座標 = PCのメインカメラのキャリブレーションの座標（hub.html と同じ）。部屋モードでない時は送らない
(function spectate(){
  if (typeof THREE === 'undefined' || typeof bossG === 'undefined') return;
  const kind = (typeof J !== 'undefined') && (typeof BM !== 'undefined') ? 'volgram' : (typeof bMat !== 'undefined') && (typeof eyes !== 'undefined') ? 'slime' : null;
  if (!kind) return;
  const NAME = { volgram:'灰牙の獣王 ヴォルグラム', slime:'ジャイアントスライム' }[kind];
  const Gm = new THREE.Matrix4(), M = new THREE.Matrix4(), r3 = v => Math.round(v*1000)/1000;
  function FfromG(){   // ゲーム座標 → 床座標
    if ((typeof bc !== 'undefined') && bc.state === 'locked' && bc.FfromG) return bc.FfromG;                                  // 剣士（sord_boss / sord_slime）
    if ((typeof room !== 'undefined') && room && room.on && room.Ox !== undefined) return Gm.makeRotationY(room.yaw).setPosition(room.Ox, 0, room.Oz);   // ガンナー
    return null;
  }
  const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const keys = kind === 'volgram' ? Object.keys(J) : null;
  setInterval(() => {
    if (!(typeof relay !== 'undefined') || !relay.conn || !relay.conn.open) return;
    const G = FfromG(); if (!G) return;
    bossG.updateMatrixWorld(true);
    const m = { t:'spec', kind, name:NAME, v:bossG.visible, M:M.multiplyMatrices(G, bossG.matrixWorld).elements.map(r3),
                st:(typeof state !== 'undefined') ? state : '', s:B.s, unp:!!B.unp, hp:B.max ? Math.max(0, B.hp/B.max) : 1, stars:!!stars.visible };
    if (kind === 'volgram'){
      const b = bossBody; m.body = [b.position.x, b.position.y, b.position.z, b.rotation.x, b.rotation.y, b.rotation.z, b.scale.x].map(r3);
      m.J = keys.map(k => { const j = J[k]; return [j.position.x, j.position.y, j.position.z, j.rotation.x, j.rotation.y, j.rotation.z].map(r3); });
      m.em = BM.map(o => o.m.emissive.getHex()); m.eye = mEye.color.getHex();
    } else {
      m.em = bMat.emissive.getHex(); m.eye = eyes[0].material.color.getHex(); m.pup = pupils[0].visible;
    }
    if ((typeof lane !== 'undefined') && shown(lane)){ lane.updateMatrixWorld(true); m.lane = { M:M.multiplyMatrices(G, lane.matrixWorld).elements.map(r3), c:lane.material.color.getHex(), o:r3(lane.material.opacity) }; }
    try { relay.conn.send(m); } catch (e){}
  }, 50);
})();

(function(){
  if (!window.RQ || !RQ.gog) return;
  const G = RQ.gog, el = id => document.getElementById(id);
  try { G.release(); } catch (e){}   // 背景カメラとPC中継を枠からゆずってもらう（取り合いを防ぐ）

  const code = G.code();
  if (code.length === 6 && typeof relayConnect === 'function'){
    if (el('rlCode')) el('rlCode').value = code;
    relayConnect(code);
  }
  if (el('xrPass')) el('xrPass').checked = G.pass();
  if (el('xrSbs')) el('xrSbs').checked = true;
  if (el('gogExit')) el('gogExit').onclick = () => { try { goggleStop(); } catch (e){} RQ.go('lobby'); };

  const go = () => { try { goggleStart(); } catch (e){ console.warn('[RQ] goggleStart', e); } };
  // 向きセンサーの許可：タップなしで通ればそのまま始める。iPhone などタップが要る時だけ「タップで開始」を出す
  const DOE = window.DeviceOrientationEvent;
  if (!DOE || typeof DOE.requestPermission !== 'function'){ setTimeout(go, 200); return; }
  DOE.requestPermission().then(r => r === 'granted' ? setTimeout(go, 200) : askTap(), askTap);
  function askTap(){
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:99;display:flex;background:rgba(0,0,0,.75);color:#7ae7ff;font:600 18px sans-serif;cursor:pointer';
  ov.innerHTML = '<div style="flex:1;display:grid;place-items:center;text-align:center">画面をタップ<br>でゴーグル開始</div><div style="flex:1;display:grid;place-items:center;text-align:center">画面をタップ<br>でゴーグル開始</div>';
  ov.addEventListener('click', () => { ov.remove(); go(); }, { once:true });
  document.body.appendChild(ov);
  }
})();
