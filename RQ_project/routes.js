// =====================================================================
//  RQ_project 共通の行き先リスト（routes.js）
//  ファイル名や置き場所を変えたら、ここだけ直せば全ページに反映されます。
//  パスはすべて「RQ_project フォルダから見た場所」で書きます。
//
//  使い方（どのフォルダのHTMLからでも同じ）:
//    <script src="../common/routes.js"></script>   ← sord/ や gun/ の中から
//    <script src="common/routes.js"></script>      ← RQ_project 直下から
//    location.href = RQ.url('lobby');               // ロビーへ
//    RQ.go('lobby');                                // ↑と同じ
//    RQ.go('raid', { start: 1 }, 'sword', 'goggle');// 剣士・ゴーグルのレイドを自動スタート
// =====================================================================
(function(){
  // このファイル自身の場所から RQ_project のフォルダを割り出す
  // （common/routes.js の1つ上 = RQ_project）。だから呼び出し元がどこでも迷わない
  const me = document.currentScript && document.currentScript.src;
  const BASE = me ? new URL('../', me).href : new URL('./', location.href).href;

  // ---------------- ページ一覧 ----------------
  const PAGES = {
    title:     'RQ_index.html',
    lobby:     'lobby.html',
    hp:        'RQ_HP_site/RQ_HP.html',
    // 準備（PC側で開くもの・カメラ）
    hub:       'sord/sord_hub.html',            // 剣・ガンナー共通の中継
    calibrate: 'sord/sord_calibrate.html',      // setup/ に移したらここを変える
  };

  // ---------------- ジョブごとの行き先 ----------------
  // ok:false にするとロビーで「準備中」表示になります
  // bgm を書くと、そのジョブのロビーで曲が流れます
  // raid は視点ごと。1つしかないジョブは1つだけ書けばOK
  const JOBS = {
    sword: {
      jp:'剣士', en:'SWORDSMAN', ok:true,
      bgm: 'sord/sounds/battle.mp3',            // ロビーで流す曲（なしなら消す）
      practice: 'sord/sord_demo.html',
      raid: {
        first:  { jp:'ジャイアントスライム', note:'一人称・スマホの画面で遊ぶ',        url:'sord/sord_slime.html' },
        goggle: { jp:'獣王ヴォルグラム',     note:'俯瞰・ゴーグルとカメラ2台で遊ぶ',  url:'sord/sord_boss.html', needsCal:true },
      },
    },
    wiz: {
      jp:'魔法使い', en:'WIZARD', ok:false,
      practice: null,
      raid: {
        first:  { jp:'一人称', note:'スマホの画面で遊ぶ', url:'wiz/RQ_project_wizard.html' },
      },
    },
    gun: {
      jp:'ガンナー', en:'GUNNER', ok:false,
      practice: null,
      raid: {
        first:  { jp:'一人称',       note:'スマホの画面で遊ぶ',  url:'gun/RQ_project_gunner.html' },
        goggle: { jp:'ゴーグル',     note:'ゴーグルで遊ぶ',      url:'gun/RQ_project_gunner_goggle.html' },
      },
    },
  };

  // ---------------- 便利関数 ----------------
  const ls = {
    get(k){ try { return localStorage.getItem(k); } catch (e){ return null; } },
    set(k, v){ try { localStorage.setItem(k, v); } catch (e){} },
  };
  const abs = p => new URL(p, BASE).href;

  // 今選んでいるジョブ（RQ_index のジョブ選択で保存される rq_job）
  function job(){
    const q = new URLSearchParams(location.search).get('job');
    const id = (q && JOBS[q]) ? q : ls.get('rq_job');
    return JOBS[id] ? id : 'sword';
  }

  // 名前 → URL。params は ?start=1 などのクエリ
  // url('lobby') / url('practice') / url('raid', {start:1}, 'sword', 'goggle')
  function url(name, params, jobId, view){
    let p = PAGES[name];
    if (!p){
      const j = JOBS[jobId || job()];
      if (name === 'practice') p = j && j.practice;
      if (name === 'raid' && j){ const v = j.raid[view] || Object.values(j.raid)[0]; p = v && v.url; }
    }
    if (!p) return null;
    const u = new URL(abs(p));
    for (const [k, v] of Object.entries(params || {})) if (v != null) u.searchParams.set(k, v);
    return u.href;
  }
  function go(name, params, jobId, view){
    const u = url(name, params, jobId, view);
    if (u) location.href = u; else console.warn('[RQ] 行き先が見つかりません:', name, jobId, view);
  }

  window.RQ = { BASE, PAGES, JOBS, job, url, go, abs, ls };
})();
