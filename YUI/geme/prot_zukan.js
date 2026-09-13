import { useState, useRef, useEffect } from "react";

/* =========================================================
   モノバケ — フェーズ1: スキャン・図鑑・相棒管理システム
   ========================================================= */

// 1. 固定パラメータ (3属性ルール)
const TYPE_CHART = {
  火: { strong: "風", weak: "水", color: "#FF6B4A" },
  水: { strong: "火", weak: "風", color: "#3EC6E0" },
  風: { strong: "水", weak: "火", color: "#7ED957" },
};

const RARITY_BASE = {
  C: { hp: 35, atk: 8, def: 6, spd: 10 },
  B: { hp: 45, atk: 11, def: 8, spd: 12 },
  A: { hp: 58, atk: 15, def: 11, spd: 14 },
  S: { hp: 72, atk: 19, def: 14, spd: 16 },
};

// 2. 改訂版 SYSTEM_PROMPT (3属性限定・厳密フォーマット)
const SYSTEM_PROMPT = `あなたは「撮影された日常の物体をモンスター（敵）化するゲーム」のエンジンです。
渡された画像の中心的な物体を1つ選び、以下のJSON形式のみで返してください。コードブロックや説明文は一切禁止です。

フィールド定義:
- name: 物体の特徴を活かした日本語モンスター名(12文字以内)
- attribute: 次の3つのうち必ず1つだけを選ぶ: "火", "水", "風"
  * 熱・電化製品・赤/オレンジ系のもの -> "火"
  * 液体・洗剤・青/水色系のもの -> "水"
  * 植物・紙・文具・軽くて風に舞いそうなもの・緑/その他 -> "風"
- rarity: 物体の珍しさ・複雑さから1つ: "C","B","A","S"
- description: 特徴を表す一言(30文字以内)
- moves: 3つの技オブジェクト(costは技消費コスト)。
  - normal: 基本攻撃 (cost: 1, name: 10文字以内, flavor: 20文字以内)
  - strong: 大技 (cost: 3, name: 10文字以内, flavor: 20文字以内)
  - utility: とくいわざ/補助 (cost: 2, name: 10文字以内, flavor: 20文字以内)

出力例:
{"name":"熱血マグカップ","attribute":"火","rarity":"B","description":"いつもあつあつの湯気を上げる頼れるやつ","moves":{"normal":{"cost":1,"name":"湯気アタック","flavor":"あつい湯気で突撃！"},"strong":{"cost":3,"name":"沸騰ブレイク","flavor":"グラグラ煮立つ全開攻撃！"},"utility":{"cost":2,"name":"保温ガード","flavor":"温かさで防具を固める"}`;

// ハッシュによるステータス分散
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function buildStats(rarity, name) {
  const base = RARITY_BASE[rarity] || RARITY_BASE.C;
  const h = hashStr(name || "monster");
  const variance = (shift) => 1 + (((h >> shift) % 21) - 10) / 100;
  return {
    hp: Math.round(base.hp * variance(0)),
    atk: Math.round(base.atk * variance(3)),
    def: Math.round(base.def * variance(6)),
    spd: Math.round(base.spd * variance(9)),
  };
}

// 永続化ストレージ
const STORAGE_KEY = "monobake-save-v2";

async function loadSaveData() {
  try {
    const res = await window.storage.get(STORAGE_KEY, false);
    if (res && res.value) return JSON.parse(res.value);
  } catch (e) {}
  // 初期データ (相棒おともAIのデフォルト値)
  return {
    partner: {
      name: "ナビモン",
      attribute: "風",
      level: 1,
      exp: 0,
      stats: { hp: 50, atk: 12, def: 8, spd: 12 },
      moves: {
        normal: { cost: 1, name: "体当たり", flavor: "元気よくぶつかる" },
        strong: { cost: 3, name: "相棒ストライク", flavor: "絆を込めた強力な一撃" },
        utility: { cost: 2, name: "応急手当", flavor: "気持ちを落ち着かせて回復" },
      },
    },
    badges: 0, // ジムバッジ所持数（今後のレベル制限用）
    zukan: [], // 遭遇・捕獲した敵モンスターのデータ一覧
  };
}

async function saveGameData(data) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(data), false);
  } catch (e) {
    console.error("保存失敗", e);
  }
}

// 画像圧縮ユーティリティ
function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 400;
        let w = img.width, h = img.height;
        if (w > h) { if (w > max) { h = Math.round(h * (max / w)); w = max; } }
        else { if (h > max) { w = Math.round(w * (max / h)); h = max; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// AI画像解析 API通信
async function analyzeImage(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
          { type: "text", text: "解析して敵モンスターのJSONのみを出力してください。" }
        ]
      }]
    })
  });
  if (!res.ok) throw new Error("通信エラーが発生しました");
  const data = await res.json();
  const rawText = data.content?.find(b => b.type === "text")?.text || "";
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  const json = JSON.parse(cleaned.match(/\{[\s\S]*\}/)[0]);
  
  // バリデーションとステータス確定
  if (!TYPE_CHART[json.attribute]) json.attribute = "風";
  if (!RARITY_BASE[json.rarity]) json.rarity = "C";
  json.stats = buildStats(json.rarity, json.name);
  return json;
}

// =========================================================
// UI メインコンポーネント (スキャン・図鑑・準備画面)
// =========================================================
export default function CharacterManagerApp() {
  const [gameData, setGameData] = useState(null);
  const [tab, setTab] = useState("partner"); // partner | scan | zukan
  const [loading, setLoading] = useState(false);
  const [previewEnemy, setPreviewEnemy] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadSaveData().then(setGameData);
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const dataUrl = await resizeImage(file);
      const enemyJson = await analyzeImage(dataUrl);
      
      const newEnemy = {
        ...enemyJson,
        id: `enemy_${Date.now()}`,
        photo: dataUrl,
        createdAt: new Date().toLocaleDateString()
      };

      setPreviewEnemy(newEnemy);
      
      // 図鑑に自動追加して保存
      const updatedZukan = [newEnemy, ...gameData.zukan.filter(z => z.name !== newEnemy.name)];
      const updatedData = { ...gameData, zukan: updatedZukan };
      setGameData(updatedData);
      await saveGameData(updatedData);

    } catch (err) {
      alert("解析に失敗しました: " + err.message);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  if (!gameData) return <div className="p-4 text-center">データを読み込み中...</div>;

  const partner = gameData.partner;

  return (
    <div className="main-container">
      <style>{`
        .main-container { max-width: 420px; margin: 0 auto; background: #12142B; color: #F3F1E7; min-height: 560px; padding: 16px; border-radius: 16px; font-family: sans-serif; }
        .nav-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .tab-btn { flex: 1; padding: 10px; border: none; background: #1B1E3D; color: #9A9CC0; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .tab-btn.active { background: #23E0C4; color: #08221E; }
        .card { background: #1F2347; border-radius: 12px; padding: 16px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.1); }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-right: 6px; }
        .btn-action { width: 100%; padding: 14px; background: #23E0C4; color: #08221E; border: none; border-radius: 10px; font-weight: bold; font-size: 15px; cursor: pointer; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 12px 0; text-align: center; }
        .stat-box { background: #12142B; padding: 6px; border-radius: 6px; }
        .stat-box .lbl { font-size: 10px; color: #9A9CC0; }
        .stat-box .val { font-size: 14px; font-weight: bold; }
      `}</style>

      {/* タブナビゲーション */}
      <div className="nav-tabs">
        <button className={`tab-btn ${tab === "partner" ? "active" : ""}`} onClick={() => setTab("partner")}>
          相棒AI
        </button>
        <button className={`tab-btn ${tab === "scan" ? "active" : ""}`} onClick={() => setTab("scan")}>
          スキャン(出現)
        </button>
        <button className={`tab-btn ${tab === "zukan" ? "active" : ""}`} onClick={() => setTab("zukan")}>
          敵図鑑 ({gameData.zukan.length})
        </button>
      </div>

      {/* 1. 相棒AI 育成・確認画面 */}
      {tab === "partner" && (
        <div>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>{partner.name}</h2>
              <span className="tag" style={{ background: TYPE_CHART[partner.attribute].color, color: "#000" }}>
                {partner.attribute}属性
              </span>
            </div>
            <p style={{ color: "#23E0C4", fontWeight: "bold", margin: "4px 0" }}>Lv. {partner.level}</p>
            
            <div className="stat-grid">
              <div className="stat-box"><div className="lbl">HP</div><div className="val">{partner.stats.hp}</div></div>
              <div className="stat-box"><div className="lbl">攻撃</div><div className="val">{partner.stats.atk}</div></div>
              <div className="stat-box"><div className="lbl">防御</div><div className="val">{partner.stats.def}</div></div>
              <div className="stat-box"><div className="lbl">素早さ</div><div className="val">{partner.stats.spd}</div></div>
            </div>

            <h4 style={{ margin: "12px 0 6px", fontSize: "13px" }}>修得技リスト</h4>
            {Object.keys(partner.moves).map(k => (
              <div key={k} style={{ fontSize: "12px", background: "#12142B", padding: "8px", borderRadius: "6px", marginBottom: "4px" }}>
                <span style={{ color: "#F2B84B" }}>[コスト{partner.moves[k].cost}]</span> <strong>{partner.moves[k].name}</strong>
                <div style={{ color: "#9A9CC0", fontSize: "11px" }}>{partner.moves[k].flavor}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. 日常の物体スキャン（敵生成）画面 */}
      {tab === "scan" && (
        <div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          
          {!previewEnemy ? (
            <div className="card" style={{ textAlign: "center", padding: "40px 16px" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📸</div>
              <h3>身の回りのものを敵に変換</h3>
              <p style={{ color: "#9A9CC0", fontSize: "12px", marginBottom: "20px" }}>
                身近な物品をカメラで撮ると、AIが属性・ステータスを持つ敵モノバケを生成します。
              </p>
              <button className="btn-action" disabled={loading} onClick={() => fileInputRef.current?.click()}>
                {loading ? "AI解析中..." : "カメラを起動してスキャン"}
              </button>
            </div>
          ) : (
            <div className="card">
              <h3 style={{ color: "#FF5D73", marginBottom: "8px" }}>⚠️ 敵出現！</h3>
              <img src={previewEnemy.photo} alt={previewEnemy.name} style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "8px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                <h4>{previewEnemy.name}</h4>
                <span className="tag" style={{ background: TYPE_CHART[previewEnemy.attribute].color, color: "#000" }}>
                  {previewEnemy.attribute}
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "#9A9CC0" }}>{previewEnemy.description}</p>
              
              <div className="stat-grid">
                <div className="stat-box"><div className="lbl">HP</div><div className="val">{previewEnemy.stats.hp}</div></div>
                <div className="stat-box"><div className="lbl">攻撃</div><div className="val">{previewEnemy.stats.atk}</div></div>
                <div className="stat-box"><div className="lbl">防御</div><div className="val">{previewEnemy.stats.def}</div></div>
                <div className="stat-box"><div className="lbl">SPD</div><div className="val">{previewEnemy.stats.spd}</div></div>
              </div>

              <button className="btn-action" style={{ background: "#FF5D73", color: "#fff", marginTop: "8px" }} onClick={() => alert("※ここでバトル画面に移行します！")}>
                ⚔️ 相棒（Lv.{partner.level}）でバトル開始
              </button>
              <button
                className="btn-action"
                style={{ background: "transparent", color: "#9A9CC0", border: "1px solid rgba(255,255,255,0.2)", marginTop: "6px" }}
                onClick={() => setPreviewEnemy(null)}
              >
                別のものをスキャン
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. 図鑑（過去にスキャンした敵・再戦可能） */}
      {tab === "zukan" && (
        <div>
          {gameData.zukan.length === 0 ? (
            <div className="card" style={{ textAlign: "center", color: "#9A9CC0" }}>
              まだスキャンした敵がいません。
            </div>
          ) : (
            gameData.zukan.map(item => (
              <div key={item.id} className="card" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <img src={item.photo} alt={item.name} style={{ width: "60px", height: "60px", borderRadius: "8px", objectFit: "cover" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{item.name}</strong>
                    <span className="tag" style={{ background: TYPE_CHART[item.attribute]?.color || "#ccc", color: "#000" }}>
                      {item.attribute}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#9A9CC0", marginTop: "2px" }}>
                    HP:{item.stats.hp} / ATK:{item.stats.atk} / SPD:{item.stats.spd}
                  </div>
                  <button
                    style={{ marginTop: "6px", background: "#1B1E3D", color: "#23E0C4", border: "1px solid #23E0C4", borderRadius: "4px", padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
                    onClick={() => alert(`${item.name} との再戦画面へ移行します`)}
                  >
                    ⚔️ 再戦する
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}