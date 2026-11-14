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
// =====================================================================
window.RQ_GOGGLE = 'self';   // goggle.html に「このページは自分で2画面を描く」と伝える
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
