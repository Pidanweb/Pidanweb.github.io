// =====================================================================
//  ゴーグル表示の「円の窓」と、左右の目の位置（goggle-lens.js）
//
//  YouTube（Google Cardboard）と同じ考え方：
//    左右の映像の中心を「ゴーグルのレンズの中心」に合わせる。
//    レンズの間隔は実際の長さ（Cardboard の標準は 63.9mm）で決まっているので、
//    画面の 1/4・3/4 ではなく「画面の中央 ± レンズ間隔の半分（mm → 画面の点に換算）」に置く。
//    （大きいスマホで 1/4・3/4 に置くと、映像の間隔がレンズより広くなり、左右がうまく重ならない）
//
//  mm → 画面の点（CSS px）の換算は、goggle.html の「画面の大きさ合わせ」で測った値（rq_px_mm）。
//  まだ測っていなければ、スマホの平均（1インチ ≒ 152 点）で計算する。
//  レンズの間隔は rq_lens_mm（goggle.html で選ぶ。既定 63.9mm）。
//
//  使い方：
//    <script src="../common/goggle-lens.js"></script>
//    rqLens(true) で表示 / rqLens(false) で消す（毎フレーム呼んでも軽い）
//    rqLensRect() … 片目の円 [{cx, cy, r}, {cx, cy, r}]（画面のピクセル。cx = レンズの中心）
//    RQ_LENS_K … 画面に付く表示（HUD・メッセージ）を円の中に収めるための縮小倍率
//    data-eye="0" / "1" を付けた要素は、左目 / 右目の中心の真下に自動で並べる
// =====================================================================
(function(){
  const DEF_PX_MM = 152/25.4, DEF_LENS_MM = 63.9;
  const num = (k, lo, hi, d) => { try { const v = +localStorage.getItem(k); return v >= lo && v <= hi ? v : d; } catch (e){ return d; } };
  window.rqPxPerMM = () => num('rq_px_mm', 3, 12, DEF_PX_MM);
  window.rqLensMM = () => num('rq_lens_mm', 50, 80, DEF_LENS_MM);
  window.rqLensRect = () => {
    const W = innerWidth, H = innerHeight;
    const sep = Math.min(rqLensMM()*rqPxPerMM(), W*.9), cl = W/2 - sep/2, cr = W/2 + sep/2;
    const r = Math.max(40, Math.min(sep/2, H/2, cl));
    return [{ cx:cl, cy:H/2, r }, { cx:cr, cy:H/2, r }];
  };

  let el = null, L = null, Rt = null, key = '';
  function make(){
    el = document.createElement('div'); el.id = 'rqLens';
    el.style.cssText = 'position:fixed;inset:0;z-index:25;pointer-events:none;display:none';
    el.innerHTML = '<div style="position:absolute;left:0;top:0;width:50%;height:100%"></div><div style="position:absolute;right:0;top:0;width:50%;height:100%"></div>' +
      '<div style="position:absolute;left:50%;top:0;bottom:0;width:2px;margin-left:-1px;background:rgba(255,255,255,.35)"></div>';
    document.body.appendChild(el); L = el.children[0]; Rt = el.children[1]; key = '';   // 作り直したら必ず描き直す
  }
  function layout(force){
    const [a, b] = rqLensRect(), W = innerWidth, k = [W, innerHeight, a.cx, a.r].join();
    if (!force && k === key) return; key = k;
    const hole = (x, c) => `radial-gradient(circle ${c.r}px at ${x}px ${c.cy}px,transparent ${c.r - 6}px,rgba(170,205,255,.4) ${c.r - 3}px,#000 ${c.r}px)`;
    if (L){ L.style.background = hole(a.cx, a); Rt.style.background = hole(b.cx - W/2, b); }
    document.querySelectorAll('[data-eye]').forEach(e => { e.style.left = (e.dataset.eye === '1' ? b.cx : a.cx) + 'px'; e.style.maxWidth = (a.r*1.7) + 'px'; });
  }
  addEventListener('resize', () => layout(true));
  window.rqLensLayout = () => layout(true);
  window.rqLens = on => {
    if (!el){ if (!on || !document.body) return; make(); }
    if (on) layout(false);
    const d = on ? 'block' : 'none'; if (el.style.display !== d) el.style.display = d;
  };
  window.RQ_LENS_K = .72;
  // 3Dゲームの2画面：片目の映像の中心（＝投影の中心）をレンズの中心に置き、はみ出しはその目の半分の画面で切る
  // view(x, y, w, h) はゲームの setViewport＋setScissor。renderer は three.js の WebGLRenderer
  window.rqEyeView = (renderer, e, W, H, vw, vh) => {
    const c = rqLensRect()[e < 0 ? 0 : 1];
    renderer.setViewport(Math.round(c.cx - vw/2), Math.round((H - vh)/2), Math.round(vw), Math.round(vh));
    renderer.setScissor(e < 0 ? 0 : Math.round(W/2), 0, Math.round(W/2), H);
  };
  if (document.readyState !== 'loading') layout(true); else addEventListener('DOMContentLoaded', () => layout(true));
})();
