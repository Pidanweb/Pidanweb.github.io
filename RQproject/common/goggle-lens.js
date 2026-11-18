// =====================================================================
//  ゴーグル表示の「円の窓」（goggle-lens.js）
//  YouTube の VR（Cardboard）表示と同じように、画面を左右半分ずつ使い、
//  それぞれの目の映像を円の窓で切り抜く（円の外は黒、真ん中に区切り線）。
//  左右の間隔・大きさは固定（目の中心 = 画面の 1/4 と 3/4、円の直径 = 縦の長さ or 横幅の半分の短い方）。
//
//  使い方：
//    <script src="../common/goggle-lens.js"></script>
//    rqLens(true) で表示 / rqLens(false) で消す（毎フレーム呼んでも軽い）
//    rqLensRect() … 片目の円 [{cx, cy, r}, {cx, cy, r}]（画面のピクセル）
//    RQ_LENS_K … 画面に付く表示（HUD・メッセージ）を円の中に収めるための縮小倍率
// =====================================================================
(function(){
  let el = null;
  function make(){
    el = document.createElement('div'); el.id = 'rqLens';
    el.style.cssText = 'position:fixed;inset:0;z-index:25;pointer-events:none;display:none';
    const hole = 'radial-gradient(circle closest-side,transparent 96.5%,rgba(170,205,255,.4) 97.6%,#000 99%)';   // 円のふちに細い線
    el.innerHTML =
      `<div style="position:absolute;left:0;top:0;width:50%;height:100%;background:${hole}"></div>` +
      `<div style="position:absolute;right:0;top:0;width:50%;height:100%;background:${hole}"></div>` +
      '<div style="position:absolute;left:50%;top:0;bottom:0;width:2px;margin-left:-1px;background:rgba(255,255,255,.35)"></div>';
    document.body.appendChild(el);
  }
  window.rqLens = on => {
    if (!el){ if (!on || !document.body) return; make(); }
    const d = on ? 'block' : 'none'; if (el.style.display !== d) el.style.display = d;
  };
  window.rqLensRect = () => {
    const W = innerWidth, H = innerHeight, r = Math.min(W/4, H/2);
    return [{ cx:W/4, cy:H/2, r }, { cx:W*3/4, cy:H/2, r }];
  };
  window.RQ_LENS_K = .72;
})();
