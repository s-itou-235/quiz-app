const socket = io();
console.log("[ADMIN] socket created");

const questionStandby = document.getElementById("question_standby");
const questionStart = document.getElementById("question_start");
const questionDelete = document.getElementById("question_delete");
const question_num = document.getElementById("question_num");
const system_log_phase = document.getElementById("system_log_phase");
const system_log_message = document.getElementById("system_log_message");


// 管理者ログイン関連

document.getElementById("admin_panel").style.display = "none";

document.getElementById("login_btn").onclick = () => {
  const pw = admin_pw.value;
  socket.emit("admin:login", pw);
};


socket.on("admin:login_success", () => {
  document.getElementById("login_screen").style.display = "none";
  document.getElementById("admin_panel").style.display = "block";
});

socket.on("admin:login_failed", () => {
  alert("パスワードが違います");
});



// フェーズ情報の取得
let adminState = {
  phase: null,
  questionId: null
};

// 更新（server.js側でのフェーズ遷移とセット）

socket.on("admin:state", (state) => {
  
  // 元のフェーズ保存
  const oldPhase = adminState.phase;
  const oldQuestionId = adminState.questionId;

  // 下記関数の元データのため変更不可
  adminState = state;

  console.log("[ADMIN] phase:", adminState.phase);

  system_log_phase.innerHTML = `現在のフェーズは${adminState.phase}`;
  system_log_message.textContent ="";

  // リロード判定
  const firstLoad =
  oldPhase === undefined &&
  oldQuestionId === undefined;

  // リアルタイムに更新したいもの
  // （解答のたび更新されていいもの）
  loadAdminRanking();
  updatePhaseNav(adminState.phase);
  updateQuestionId(adminState.questionId);
  updateAskedQuestions();
  
  // リロード時　
  // フェーズが変わったとき
  // 出題をいじったとき
  // （解答のたび更新されたくないもの）
  if(firstLoad ||oldPhase !== adminState.phase || oldQuestionId !== adminState.questionId){
    updateSystemLog();
  }

});


// エラーメッセージ
socket.on("admin:error", (payload) => {

  const { message, detail } = payload;

  system_log_message.textContent =
    `${message} ${detail ?? ""}`;
});

socket.on("scoresUpdated", () => {
  loadAdminRanking();
});


// 出題準備
questionStandby.onclick = async () => {

  // フェーズブロック
  // 押していいタイミングを記述
  // 「idle → gameState.jsの初期」 「standby → 出題準備（→問題変更）」 
  // 「result → 問題終了」など
  const allowStandbyPhases = ["idle","standby" , "result"];
  if (!allowStandbyPhases.includes(adminState.phase)) {
  alert(`現在は出題準備できません（状態: ${adminState.phase}）`);
  return;
  }
  console.log("[ADMIN] standby clicked");

  const questionId = Number(question_num.value);
  
  socket.emit("admin:standby", { questionId });

  socket.once("admin:standby:ok", () => {
    refresh();
    loadAdminRanking();
    
  });
  
};

// 出題開始（★時間は送らない）
questionStart.onclick = () => {
  console.log("[ADMIN] start clicked");
  socket.emit("admin:startQuestion");
  refresh();
  
};

// 出題取消
questionDelete.onclick = () => {
  const questionId = Number(question_num.value);

  if (Number.isNaN(questionId )) {
    alert("問題番号が不正です");
    return;
  }

  let warning = "";

  if (
    adminState.phase === "question" &&
    adminState.questionId === questionId
  ) {
    warning = "⚠ 出題中！！";
  } else if (
    adminState.phase === "answer_check" &&
    adminState.questionId === questionId
  ) {
    warning = "⚠ 回答集計中！！";
  } else if (
    adminState.phase === "result" &&
    adminState.questionId === questionId
  ) {
    warning = "⚠ 結果表示中！！";
  }

  const check = confirm(
    `${warning}\n
    問題番号 ${questionId} を削除しますがよろしいですか？`
  );
  if (!check) return;

  console.log("[ADMIN] delete clicked:", questionId);

  socket.emit("admin:deleteQuestion", { qid: questionId});
  
};


// 状態確認
async function refresh() {
  const state = await fetch("/api/state").then(r => r.json());
  console.log("[ADMIN STATE]", state);
  system_log_phase.innerHTML = `現在のフェーズは${adminState.phase}`;
}


//アンサーチェックボタン 
document.getElementById("answer_check_btn")
  .addEventListener("click", () => {    
    socket.emit("admin:answerCheck");
    system_log_phase.innerHTML = `現在のフェーズは${adminState.phase}`;
});

//正解発表ボタン 
document.getElementById("question_result")
  .addEventListener("click", () => {
    socket.emit("admin:showResult");
    system_log_phase.innerHTML = `現在のフェーズは${adminState.phase}`;
  });  


refresh();



// -------------------------
// 問題登録関連
// ------------------------

// -------------------------
// 問題登録用のフォームなどの取得
// -------------------------

// フォームのデータ
const qidInput = document.getElementById("qid");
const categoryInput = document.getElementById("category");
const memoInput = document.getElementById("memo");
const questionTextInput = document.getElementById("questionText");
const timeLimitInput = document.getElementById("timeLimitSec");
const choice1Input = document.getElementById("choice1");
const choice2Input = document.getElementById("choice2");
const choice3Input = document.getElementById("choice3");
const choice4Input = document.getElementById("choice4");
const correctIndexInput = document.getElementById("correctIndex");
const pointCorrectInput = document.getElementById("pointCorrect");
const pointWrongInput = document.getElementById("pointWrong");
const explanationInput = document.getElementById("explanation");

// Excel一括貼り付けのフォームのデータ入れ
let bulkQueue = [];

// 登録済み問題に入れるデータ入れ
let questionBank = {};


// -------------------------
// 問題登録関連の関数
// -------------------------

// 問題データをサーバーへ保存する関数
async function saveQuestionToServer(question) {
  await fetch("/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(question)
  });
}

// サーバーの問題データを反映する関数
// リロード時などは再反映の動きも可能
async function loadQuestionsFromServer() {
  try {
    const res = await fetch("/questions");
    if (!res.ok) throw new Error("取得失敗");

    const data = await res.json();
    console.log("取得データ:", data);
    
    questionBank = {};

    data.forEach(q => {
      questionBank[q.id] = q;
    });

    
    renderQuestionList();

  } catch (err) {
    console.error("問題取得エラー:", err);
  }
}


// -------------------------
// 問題登録関連の動きなど
// -------------------------

// リロード時に問題データ再反映
window.addEventListener("load", () => {
  loadQuestionsFromServer();
});



// Excel一括貼り付け → 登録フォームへ反映
document.getElementById("bulkPreviewBtn")
.addEventListener("click", () => {

  const text = document.getElementById("bulkInput").value.trim();
  if (!text) return;

  bulkQueue = text
    .split("\n")
    .map(r => r.trim())
    .filter(r => r.length > 0);

  if (bulkQueue.length === 0) {
    alert("データがありません");
    return;
  }

  // 先頭行を登録フォームへ
  loadNextBulkRow();
});

// Excel一括貼り付けの先頭行を登録フォームへ
function loadNextBulkRow() {

  if (bulkQueue.length === 0) {
    alert("全て登録されました");
    return;
  }

  const cols = bulkQueue[0].split("\t");

  const [
    qid,
    category,
    memo,
    questionText,
    timeLimitSec,
    choice1,
    choice2,
    choice3,
    choice4,
    correctInput,
    pointCorrect,
    pointWrong,
    explanation
  ] = cols;

  document.getElementById("qid").value = qid || "";
  document.getElementById("category").value = category || "normal";
  document.getElementById("memo").value = memo || "";
  document.getElementById("questionText").value = questionText || "";
  document.getElementById("timeLimitSec").value = timeLimitSec || "";
  document.getElementById("choice1").value = choice1 || "";
  document.getElementById("choice2").value = choice2 || "";
  document.getElementById("choice3").value = choice3 || "";
  document.getElementById("choice4").value = choice4 || "";
  document.getElementById("correctIndex").value = correctInput || "";
  document.getElementById("pointCorrect").value = pointCorrect || "";
  document.getElementById("pointWrong").value = pointWrong || "";
  document.getElementById("explanation").value = explanation || "";
}


// 問題登録処理
// 問題登録処理
document.getElementById("registerBtn")
.addEventListener("click", async () => {

  const qid = Number(qidInput.value);
  const questionText = questionTextInput.value;
  const timeLimitSec = Number(timeLimitInput.value);
  const choice1 = choice1Input.value;
  const choice2 = choice2Input.value;
  const correctIndex = Number(correctIndexInput.value);

  if (
    Number.isNaN(qid) ||
    questionText.trim() === "" ||
    Number.isNaN(timeLimitSec) ||
    choice1.trim() === "" ||
    choice2.trim() === "" ||
    Number.isNaN(correctIndex)
  ) {
    alert("必須項目不足");
    return;
  }

  const choices = [
    choice1Input.value,
    choice2Input.value,
    choice3Input.value,
    choice4Input.value
  ].filter(c => c && c.trim() !== "");

  // 🔵 ここでオブジェクト化
  const question = {
    id: qid,
    category: categoryInput.value,
    memo: memoInput.value,
    questionText,
    timeLimitSec,
    choices,
    correctIndex: correctIndex - 1,
    explanation: explanationInput.value,
    point: {
      correct: Number(pointCorrectInput.value),
      wrong: Number(pointWrongInput.value)
    }
  };

  questionBank[qid] = question;

  // ここを追加（サーバー保存）
  await saveQuestionToServer(question);

  // サーバーを正として再取得
  await loadQuestionsFromServer();

  updateAskedQuestions();

  // ▼ Excel由来なら削除
  if (bulkQueue.length > 0) {
    bulkQueue.shift();
    document.getElementById("bulkInput").value =
      bulkQueue.join("\n");

    loadNextBulkRow();
  }

});

// 登録フォームの内容を全削除
document.getElementById("excelDeleteBtn")
.addEventListener("click", () => {

});

// テーブル作成
function td(value) {
  const cell = document.createElement("td");
  cell.textContent = value ?? "";
  return cell;
}

// エラーチェック
function validateQuestion(q) {

  if (Number.isNaN(q.id)) return "Qid未設定";
  if (!q.questionText) return "問題文未入力";
  if (Number.isNaN(q.timeLimitSec)) return "制限時間未設定";
  if (!q.choices || q.choices.length < 2) return "選択肢不足";
  if (Number.isNaN(q.correctIndex)) return "正解未設定";

  if (q.correctIndex >= q.choices.length)
    return "正解番号不正";

  return "";
}



// 登録済み問題として反映
function renderQuestionList() {

  const tbody = document.getElementById("questionListBody");
  tbody.innerHTML = "";

  const sortedKeys = Object.keys(questionBank)
    .map(k => Number(k))
    .sort((a, b) => a - b);

  sortedKeys.forEach(qid => {

    const q = questionBank[qid];
    const tr = document.createElement("tr");

    // =========================
    // 出題登録ボタン
    // =========================
    const tdStart = document.createElement("td");
    const startBtn = document.createElement("button");
    startBtn.textContent = "出題登録";

    startBtn.onclick = () => {
      question_num.value = qid;
      questionStandby.click(); // 既存処理をそのまま使用
      window.scroll({
        top: 0,
        behavior: "smooth",
      });
    };

    tdStart.appendChild(startBtn);

    // =========================
    // 修正ボタン
    // =========================
    const tdEdit = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.textContent = "修正";

    editBtn.onclick = () => {
      loadQuestionToForm(q);
    };

    tdEdit.appendChild(editBtn);

    // =========================
    // 削除ボタン
    // =========================
    const tdDelete = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "削除";

    deleteBtn.onclick = async () => {
      if (!confirm(`Q${qid}を削除しますか？`)) return;

      await deleteQuestion(qid);
    };

    tdDelete.appendChild(deleteBtn);

    // =========================
    // エラー判定
    // =========================
    const errorMsg = validateQuestion(q);
    const tdError = td(errorMsg);

    if (errorMsg) {
      tdError.style.color = "red";
    } else {
      tdError.textContent = "OK";
      tdError.style.color = "green";
    }

    // =========================
    // データ列
    // =========================
    const rowData = [
      q.id,
      q.category,
      q.memo,
      q.questionText,
      q.timeLimitSec,
      q.choices[0] || "",
      q.choices[1] || "",
      q.choices[2] || "",
      q.choices[3] || "",
      q.correctIndex + 1,
      q.point.correct,
      q.point.wrong,
      q.explanation
    ];

    tr.append(tdStart, tdEdit, tdDelete, tdError);
    rowData.forEach(v => tr.append(td(v)));

    tbody.appendChild(tr);
  });
}

// 登録済み問題一覧→登録フォームへ（修正作業用）
function loadQuestionToForm(q) {

  qidInput.value = q.id;
  categoryInput.value = q.category;
  memoInput.value = q.memo;
  questionTextInput.value = q.questionText;
  timeLimitInput.value = q.timeLimitSec;

  choice1Input.value = q.choices[0] || "";
  choice2Input.value = q.choices[1] || "";
  choice3Input.value = q.choices[2] || "";
  choice4Input.value = q.choices[3] || "";

  correctIndexInput.value = q.correctIndex + 1;
  pointCorrectInput.value = q.point.correct;
  pointWrongInput.value = q.point.wrong;
  explanationInput.value = q.explanation;

  document.getElementById("bulkInput")
  .classList.add("preview-row");
}

async function deleteQuestion(id) {
  const res = await fetch(`/questions/${id}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    alert("削除に失敗しました");
    return;
  }

  await loadQuestionsFromServer();
  updateAskedQuestions();
}




window.addEventListener("load", () => {
  loadAdminRanking();
});


async function loadAdminRanking() {

  const res = await fetch("/api/admin/ranking");
  const data = await res.json();

  renderAdminTotal(data.totalRanking);
  renderAdminAllAnswers(data.allAnswersRanking);
  renderAdminCorrectOnly(data.correctOnlyRanking);

  updateRealtimeAnswerStats();
}

function renderAdminTotal(ranking) {

  const el = document.getElementById("admin_total_ranking");

  if (!ranking.length) {
    el.textContent = "データなし";
    return;
  }

  let text = "";

  ranking.forEach((p, index) => {
    text += `${index + 1}位 ${p.name} ${p.correctCount}問正解 ${p.totalTime.toFixed(2)}秒\n`;
  });

  el.textContent = text;
}



function renderAdminAllAnswers(ranking) {

  const el = document.getElementById("admin_question_all");

  if (!ranking.length) {
    el.textContent = "データなし";
    return;
  }

  let text = "";

  ranking.forEach((p, index) => {

  if (p.result === "over") {
    text += `${index + 1}位 ${p.name} タイムオーバー\n`;
    return;
  }

  const timeText = p.time != null ? `${p.time.toFixed(2)}秒` : "-秒";

  text += `${index + 1}位 ${p.name} 解答「${p.answer + 1}」 ${timeText}\n`;
});

  el.textContent = text;
}

function renderAdminCorrectOnly(ranking) {

  const el = document.getElementById("admin_question_correct");

  if (!ranking.length) {
    el.textContent = "データなし";
    return;
  }

  let text = "";

  ranking.forEach((p, index) => {
    text += `${index + 1}位 ${p.name}  ${p.time != null ? p.time.toFixed(2) : "-"}秒${p.result === "seizure" ? "（点数没収）" : ""}\n`;
  });

  el.textContent = text;
}



total_ranking_btn.addEventListener("click", () => {
  socket.emit("admin:showTotalRanking");
});

correct_best_btn.addEventListener("click", () => {
  socket.emit("admin:showCorrectBest");
});

correct_worst_btn.addEventListener("click", () => {
  socket.emit("admin:showCorrectWorst");
});


// ハイブリッドルールの実装
hybrid_worst_btn.addEventListener("click", () => {
  // プッシュ確認はいずれ入れる
  const check = confirm("早押し最下位の点数を没収するボタンです！");
  if(!check)return;

  socket.emit("admin:hybridCorrectWorst");
});

ranking_none_btn.addEventListener("click", () => {
  socket.emit("admin:noneRanking");
});


// 強制的にidle状態にするボタンを作成しておく
// なにか起きたとき専用のボタンというのは明示
// ボタン名は「エラー解除」？
phase_reset.onclick = () => {
  const check = confirm("フェーズを強制変更するボタンです！");
  if(!check)return;

  socket.emit("admin:phase_reset");
}


// 解答人数のリアルタイム取得
function updateRealtimeAnswerStats(){

  const container = document.getElementById("answer_counts");
  if(!container) return;

  const qid = adminState.questionId;
  const q = questionBank[qid];

  // Qidがnull かつ Qidが0ではない（0 null防止）
  // 本番で ０は テスト問題扱い
  if(qid == null && qid != 0){
    container.textContent = "";
    return;
  }
  // 未登録問題（）
  if(!q){
    container.textContent = `Qid ${qid} の 問題は未登録です。`;
    return;
  }

  const counts = Array(10).fill(0);

  const el = document.getElementById("admin_question_all");
  if(!el) return;

  // =====================
  // 解答ログから人数集計
  // =====================

  const lines = el.textContent.split("\n");

  lines.forEach(line => {

    const match = line.match(/解答「(\d)」/);

    if(match){
      const num = Number(match[1]) - 1; // 表示1〜4 → 内部0〜3
      if(counts[num] !== undefined){
        counts[num]++;
      }
    }

  });

  // =====================
  // 選択肢データ取得
  // =====================


  const choices = q?.choices ?? [];
  

  // =====================
  // 表示更新
  // =====================

  const numMarks = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩"];

  container.textContent = "";

  choices.forEach((choice,i)=>{

    if(!choice) return;

    const line = document.createElement("div");

    line.textContent =
      `${numMarks[i]} 「${choice}」${counts[i]}人`;

    container.appendChild(line);

  });

}


// ナビ
function updatePhaseNav(phase){
  // シンプルQidを使うことを懸念してこの名前
  const Qid_input = document.getElementById("question_num");
  const standby = document.getElementById("question_standby"); //①
  const start = document.getElementById("question_start");     //②
  const check = document.getElementById("answer_check_btn");   //③
  const result = document.getElementById("question_result");   //④

  const best = document.getElementById("correct_best_btn");    //⑤
  const worst = document.getElementById("correct_worst_btn");  //⑤
  const hybrid = document.getElementById("hybrid_worst_btn");  //⑤
  const none = document.getElementById("ranking_none_btn");    //⑥


  const allButtons = [
    Qid_input, standby,start,check,result,
    best,worst,hybrid,none
  ];

  // 全解除
  allButtons.forEach(btn=>{
    if(btn) btn.classList.remove("phase-active");
  });


  // フェーズごとの推奨操作

  if(phase === "idle"){
    standby.classList.add("phase-active");   //①
    Qid_input.classList.add("phase-active"); 
  }

  if(phase === "standby"){
    start.classList.add("phase-active");     //②
    const qid = adminState.questionId;

    if(qid != null){
      system_log_message.textContent =
        `セットされた問題番号 → qid ${qid}`;
    }else{
      system_log_message.textContent = "";
    }
  }

  if(phase === "question"){
    system_log_message.textContent = "解答受付中";
  }

  if(phase === "answer_check_ready"){
    system_log_message.textContent = "集計完了しました";
    check.classList.add("phase-active");     //③
  }

  if(phase === "answer_check"){
    result.classList.add("phase-active");    //④
    system_log_message.textContent = "ユーザーにそれぞれの解答人数を表示しています。（正解発表はされていません）";
  }

  if(phase === "result"){
    standby.classList.add("phase-active");   //①
    Qid_input.classList.add("phase-active"); 
    system_log_message.textContent = "「次の問題を出題してください」（早押しランキング表示も可能です）";

    // ランキング系も推奨操作
    best.classList.add("phase-active");
    worst.classList.add("phase-active");
    hybrid.classList.add("phase-active");
    none.classList.add("phase-active");
  }

}

function updateQuestionId(qid){

  const els = document.querySelectorAll(".now_Qid");

  els.forEach(el=>{
    el.textContent = qid ?? "-";
  });

  // ここに問題番号もセットされた問題番号に上書きする
  document.getElementById("question_num").value = qid;
}


let logCountdownTimer = null;

function updateSystemLog(){

  const qid = adminState.questionId;
  const phase = adminState.phase;

  const infoEl = document.getElementById("system_log_info");

  // question以外はタイマー停止
  if(phase !== "question" && logCountdownTimer){
    clearInterval(logCountdownTimer);
    logCountdownTimer = null;
  }

  infoEl.textContent = "";

  // 未登録の問題番号
  if(qid == null){
    return;
  }

  const q = questionBank[qid];

  if(!q){
    infoEl.textContent = `Qid ${qid} の 問題は未登録です`;
    return;
  }

  if(phase === "standby"){
    infoEl.textContent =
    `この問題のメモ（前フリ） → ${q.memo ?? "メモなし"}\n` +
    `この問題の問題文 → ${q.questionText ?? "問題文なし"}`;
    
  }

  else if(phase === "question"){
    if(!logCountdownTimer){
      startLogCountdown(q.timeLimitSec);
    }
  }

  else if(phase === "result"){
    infoEl.textContent = `この問題の解説 → ${q.explanation ?? "解説データなし"}`;;
  }

  else{
    infoEl.textContent = "";
  }

}

function startLogCountdown(sec){

  const infoEl = document.getElementById("system_log_info");

  // 既存タイマー停止
  if(adminState.phase !== "question" && logCountdownTimer){
    clearInterval(logCountdownTimer);
    logCountdownTimer = null;
  }

  // ＋２は 出題から受付までのラグ
  let remain = sec + 2;

  infoEl.textContent = `解答受付 残り ${remain} 秒（目安）`;

  logCountdownTimer = setInterval(()=>{

    remain--;

    if(remain <= 0){
      infoEl.textContent = "時間終了";
      clearInterval(logCountdownTimer);
      logCountdownTimer = null;
      return;
    }

    infoEl.textContent = `解答受付 残り ${remain} 秒（目安）`;

  },1000);

}


function updateAskedQuestions(){

  const infoEl = document.getElementById("question_info");
  if(!infoEl) return;

  const asked = adminState.askedQuestionIds || [];

  if(asked.length === 0){
    infoEl.textContent = "出題済み問題なし";
  } else {
    infoEl.textContent =
      "出題済み問題(出題準備で解答一覧を閲覧可能)\n" +
      asked.map(q => `${q}`).join(" / ");
  }

  // =========================
  // 問題一覧のOK → 済 に変更
  // =========================

  const tbody = document.getElementById("questionListBody");
  if(!tbody) return;

  const rows = tbody.querySelectorAll("tr");

  rows.forEach(row => {

    const cells = row.querySelectorAll("td");

    // rowData の並びから qid の位置
    const qidCell = cells[4];
     // rowData の並びから 確認 の位置
    const statusCell = cells[3];

    if(!qidCell || !statusCell) return;

    const qid = Number(qidCell.textContent);

    if(asked.includes(qid)){
      statusCell.textContent = "出題済";
      statusCell.style.color = "red";
      statusCell.style.fontWeight = "bold";
    }

  });

}

// 正解変更機能
const answerNum = document.getElementById("answer_num");
const answerNumSet = document.getElementById("answer_num_set");

answerNumSet.onclick = () => {

  const answer = Number(answerNum.value);

  if (Number.isNaN(answer)) {
    alert("正解番号を入力してください");
    return;
  }

  const qid = adminState.questionId;

  socket.emit("admin:setCorrectAnswer", {
    qid,
    answer
  });

};

socket.on("admin:correctAnswerInfo", (data) => {

  const el = document.getElementById("answer_info");

  const correctAnswer = data.correctAnswer;
  const choices = data.choices ?? [];
  const qid = adminState.questionId;

  // Qidがnull かつ Qidが0ではない（0 null防止）
  // 本番で ０は テスト問題扱い
  if(qid == null && qid != 0){
    el.textContent = "";
    return;
  }

  // 未登録問題
  // 存在しないQidの場合はanswer_infoにも同内容
  const q = questionBank[qid];
  if(!q){
    el.textContent = `Qid ${qid} の 問題は未登録です。`;
    return;
  }

  console.log("correctAnswerInfo", correctAnswer, choices);

  if (correctAnswer === undefined || correctAnswer === -1) {
    el.textContent = 
    `この問題は正解を設定していません\n
    （正解の選択肢番号を設定可能です）`;
    return;
  }

  const choiceText = choices[correctAnswer] ?? "選択肢不明";

  el.textContent =
  `この問題の正解設定
  ${correctAnswer + 1} 「${choiceText}」
  （正解無しにする場合は正解を0に変更）`;
});