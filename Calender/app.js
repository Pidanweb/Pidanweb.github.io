// 共通処理: タスクの保存・読み込み
const load = () => JSON.parse(localStorage.getItem('tasks') || '[]');
const save = (tasks) => localStorage.setItem('tasks', JSON.stringify(tasks));

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => ymd(new Date());
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

// 応援キャラ(chara/chara1.png ～ chara10.png からランダム)
const randomChara = () => `chara/chara${1 + Math.floor(Math.random() * 10)}.png`;

const addTask = (title, date, due) => {
  const tasks = load();
  tasks.push({ id: Date.now(), title, date, due });
  save(tasks);
};
const removeTask = (id) => save(load().filter((t) => t.id !== id));

// 「あと◯日」表示
const remain = (due) => {
  const n = daysBetween(today(), due);
  return n < 0 ? '期限切れ!' : n === 0 ? '今日まで!' : `あと${n}日`;
};

// PWA: オフライン対応
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
