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
//    RQ.go('raid', { start: 1 }, 'sword', 'volgram');// 剣士・ヴォルグラム戦を自動スタート
// =====================================================================
(function(){
  // このファイル自身の場所から RQ_project のフォルダを割り出す
  // （common/routes.js の1つ上 = RQ_project）。だから呼び出し元がどこでも迷わない
  const me = document.currentScript && document.currentScript.src;
  const BASE = me ? new URL('../', me).href : new URL('./', location.href).href;

  // ---------------- ページ一覧 ----------------
  const PAGES = {
    title:     'RQ_index.html',
    jobSelect: 'RQ_index.html?jobs=1',          // タイトルの演出を飛ばして、ジョブ選択から
    lobby:     'lobby.html',
    hp:        'RQ_HP_site/RQ_HP.html',
    // 準備（PC側で開くもの・カメラ）
    hub:       'setup/hub.html',                // 剣・ガンナー共通の中継（PCで開く）
    calibrate: 'setup/calibrate.html',          // カメラ2台の位置合わせ（PCで開く）
    goggle:    'goggle.html',                   // ゴーグルモードの入口（スマホで開く）
  };

  // ---------------- ジョブごとの行き先 ----------------
  // ok:false にするとロビーで「準備中」表示になります
  // bgm を書くと、そのジョブのロビーで曲が流れます
  // quests はクエスト選択画面に並ぶ順。1件書き足すだけで画面に増えます
  //   rank: 難しさ（★の数 1〜5）  needsCal: カメラ調整が要るクエスト
  //   goggle:true … ゴーグルモード（goggle.html）でも遊べるクエスト（ゲームが common/goggle-game.js を読んでいる）
  //   locked:true にすると「準備中」の枠として表示（url はなくてよい）
  const SLIME = {
    boss:'ジャイアントスライム', bossEn:'GIANT SLIME', hp:800, rank:1,
    desc:'攻撃は突進だけ。体が赤く光ったらはじき、紫に光ったらガードで受け止める。',
  };
  const JOBS = {
    sword: {
      jp:'剣士', en:'SWORDSMAN', ok:true,
      bgm: 'sounds/battle.mp3',            // ロビーで流す曲（なしなら消す）
      practice: 'sord/sord_demo.html',
      quests: [
        { id:'slime', jp:'巨大スライム討伐', ...SLIME,
          view:'一人称', device:'スマホ ＋ Wiiリモコン', goggle:true, url:'sord/sord_slime.html' },
        { id:'volgram', jp:'灰牙の獣王 討伐', boss:'灰牙の獣王 ヴォルグラム', bossEn:'VOLGRAM', hp:1000, rank:3,
          view:'俯瞰', device:'ゴーグル ＋ カメラ2台', needsCal:true, goggle:true,
          desc:'縦斬りは横へ回避、横薙ぎははじくかガード。黄色く光る攻撃ははじけない。',
          url:'sord/sord_boss.html' },
        { id:'next', locked:true },
      ],
    },
    wiz: {
      jp:'魔法使い', en:'WIZARD', ok:true,
      bgm: 'sounds/battle.mp3',
      practice: null,
      quests: [
        { id:'slime', jp:'巨大スライム討伐', ...SLIME,
          view:'一人称', device:'スマホ ＋ Wiiリモコン', url:'wiz/RQ_project_wizard.html' },
      ],
    },
    gun: {
      jp:'ガンナー', en:'GUNNER', ok:true,
      bgm: 'sounds/battle_gun.mp3',
      practice: null,
      quests: [
        { id:'slime', jp:'巨大スライム討伐', ...SLIME,
          view:'一人称', device:'スマホ ＋ Wiiリモコン', url:'gun/RQ_project_gunner.html' },
        { id:'slime-goggle', jp:'巨大スライム討伐（ゴーグル）', ...SLIME,
          view:'ゴーグル', device:'ゴーグル ＋ Wiiリモコン', goggle:true, url:'gun/RQ_project_gunner_goggle.html' },
      ],
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
      if (name === 'raid' && j){   // view にはクエストの id を渡す（省略すると最初のクエスト）
        const qs = j.quests.filter(q => q.url), q = qs.find(q => q.id === view) || qs[0]; p = q && q.url; }
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

  // ゴーグルモードの枠（goggle.html）の中で開かれていれば、その窓口。ふつうに開いた時は null
  //   RQ.gog.wii   … PC中継の仮想Wiiリモコン（openWii(RQ.gog.wii) で本物と同じように使える）
  //   RQ.gog.cam() … 背景カメラの映像（Promise<MediaStream>。背景カメラがオフなら null）
  //   RQ.gog.exit()… ゴーグルモードを終わって、今のページをふつうに開き直す
  let gog = null;
  try { if (window.parent !== window && window.parent.RQG) gog = window.parent.RQG; } catch (e){}

  window.RQ = { BASE, PAGES, JOBS, job, url, go, abs, ls, gog };
})();
