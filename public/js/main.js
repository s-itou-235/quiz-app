// HTML要素の取得

// ルール
// 変数もタグのidも同じ名前
// 単語区切りはアンダーバー（user_name）など
// 基本的に小文字で統一

// 変数もタグのclassも同じ名前
// 単語区切りはアンダーバー2つ（user__name）など
// 基本的に小文字で統一


// ヘッダー関連
// 名前登録
const userNameEl = document.getElementById("user_name");
const nameInputEl = document.getElementById("name_input");
const nameUpdateBtn = document.getElementById("name_update_btn");


// モニター表示関連
var monitor_correct_total = document.getElementById("monitor_correct_total")
var monitor_time_total = document.getElementById("monitor_time_total")
var monitor_result = document.getElementById("monitor_result")

// ランプ表示
var answer_lamp = document.getElementById("answer_lamp")
var answer_lamp_num = document.getElementById("answer_lamp_num")
var answer_lamp_info = document.getElementById("answer_lamp_info")


// 解答画面（出題部分）
// 問題文関連
var question_form = document.getElementById("question_form")
var question_text = document.getElementById("question_text")

// 解答時間関連
var time_limit = document.getElementById("time_limit")
var time_limit_count = document.getElementById("time_limit_count")




// 解答選択肢ボタン

var select__button = document.querySelectorAll('.select__button');

var select__button__1 = document.querySelectorAll(".select__button__1");
var select__button__2 = document.querySelectorAll(".select__button__2");
var select__button__3 = document.querySelectorAll(".select__button__3");
var select__button__4 = document.querySelectorAll(".select__button__4");


// アンサーチェック用

var answer__sum = document.querySelectorAll('.answer__sum');

var answer__sum__1 = document.querySelectorAll(".answer__sum__1");
var answer__sum__2 = document.querySelectorAll(".answer__sum__2");
var answer__sum__3 = document.querySelectorAll(".answer__sum__3");
var answer__sum__4 = document.querySelectorAll(".answer__sum__4");



// 管理者画面関連
var question_num = document.getElementById("question_num")
var question_standby = document.getElementById("question_standby")

var question_check = document.getElementById("question_check")
var time_check = document.getElementById("time_check")

var select_check_1 = document.getElementById("select_check_1")
var select_check_2 = document.getElementById("select_check_2")
var select_check_3 = document.getElementById("select_check_3")
var select_check_4 = document.getElementById("select_check_4")


// モードごとに設定してあるclass取得
// 全体
var question = document.querySelectorAll(".question");
var question__default = document.querySelectorAll(".question__default");
// 
var question__text__4text = document.querySelectorAll(".question__text__4text");
var question__text__3text = document.querySelectorAll(".question__text__3text");
var question__text__2text = document.querySelectorAll(".question__text__2text");



// モード選択のボタン（文字ベース）

// 命名法則mode_出題方式_択数と方式 mode_text_4text→文字問題 4択文字
var btn_text_4text = document.getElementById("btn_text_4text")
var btn_text_3text = document.getElementById("btn_text_3text")
var btn_text_2text = document.getElementById("btn_text_2text")

// いずれやりたい
// 画像問題 テキスト4択
// var mode_image_4select = document.getElementById("mode_image_4select")
// テキスト問題 画像4択
// var mode_text_4image = document.getElementById("mode_text_4image")
// 画像問題 画像4択
// var mode_image_4image = document.getElementById("mode_text_4image")
// gif問題問題 テキスト4択
// var mode_image_4image = document.getElementById("mode_text_4image")



var questionStandby = document.getElementById("question_standby");
var questionStart = document.getElementById("question_start");


var user_answer_choice = document.getElementById("user_answer_choice")
var user_answer_time = document.getElementById("user_answer_time")
var user_time = document.getElementById("user_time")

var answer_check_btn = document.getElementById("answer_check_btn")
var question_result = document.getElementById("question_result")




// ユーザーナンバー（ランプの数字）
var userNumber = null;
// 解答入れ
var userAnswer = null;
var answerTime = 0;
// var isQuestionActive = false;


// アンサーチェック用配列（本家であった6択まで対応）
var answer_check_arr = [0,0,0,0,0,0];






// 本番では参加人数に合わせてボタン
  answer_lamp_num.innerHTML = 1;


// 問題ボタンを全部非表示
question.forEach(el =>{
    el.classList.add("none");
});  


// ===============================
// サーバー絡みの部分
// ===============================
// ・サーバーと同期するためのクライアント側ロジック全体
// ・clientId 管理、状態復元、Socketイベント、解答制御を担当


// ===============================
// clientId 管理（永続）
// ===============================
// ・各ブラウザを一意に識別するID
// ・localStorageに保存し、リロードや再接続でも同一人物として扱う
let clientId = localStorage.getItem("clientId");

if (!clientId) {
  if (window.crypto && crypto.randomUUID) {
    clientId = crypto.randomUUID();
  } else {
    // フォールバック（簡易UUID生成）
    clientId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  localStorage.setItem("clientId", clientId);
}

console.log("[CLIENT] clientId =", clientId);

// ===============================
// Socket.io
// ===============================
// ・リアルタイムイベント（出題開始・結果開始）を受信するための接続
const socket = io();
console.log("[CLIENT] socket connected");

// ===============================
// サーバーに clientId を登録
// ===============================
monitor_result.innerHTML = "接続OK";


// ===============================
// RTT(サーバーとの通信ラグを検証)
// ===============================

let rtt = null;
let minRtt = Infinity;

// 複数回測定
function syncTime() {
  const t0 = Date.now();

  socket.emit("sync", { t0 });

  socket.once("sync:response", ({ t0, serverTime }) => {
    const t1 = Date.now();
    const currentRtt = t1 - t0;

    minRtt = Math.min(minRtt, currentRtt);
    rtt = minRtt;
  });
  console.log(rtt);
}

// 接続時に数回実行
for (let i = 0; i < 5; i++) {
  setTimeout(syncTime, i * 200);
}





// ===============================
// 状態管理
// ===============================
// ・現在クイズ中かどうか
// ・どの問題か
// ・タイマー制御用の変数群
let socketQuestionActive = false;
let stableTimer = null;
let currentQuestionId = null;
let timerEndAt = null;

// 解答絡みのフラグ
// ・canAnswer : 今この瞬間に解答してよいか
// ・hasAnswered : すでにこの問題に解答したか（サーバー基準）
let canAnswer = false;
let hasAnswered = false;


let latestState = null;

//問題文有無の状態管理
let questionRendered = false;

// 枠線がついているかの状態管理
let answeredChoiceRendered = false;

// 時間ずれの取得
let timeOffset = 0;

// サーバー時刻との差分を更新
function updateOffset(serverNow) {
  // ① serverNowが不正なら即終了
  if (!Number.isFinite(serverNow)) {
    console.warn("[OFFSET] serverNow invalid:", serverNow);
    return;
  }

  const newOffset = serverNow - Date.now();

  // ② newOffsetがNaN/Infinityなら終了
  if (!Number.isFinite(newOffset)) {
    console.warn("[OFFSET] newOffset invalid:", newOffset);
    return;
  }

  // ③ 異常値カット
  if (Math.abs(newOffset) > 10000) {
    console.warn("[OFFSET] abnormal:", newOffset);
    return;
  }


  if (timeOffset === 0) {
    // 初回は即反映
    timeOffset = newOffset;
  } else {
    // スムージング（ブレ防止）
    const alpha = Math.abs(newOffset - timeOffset) > 100 ? 0.5 : 0.2;
    timeOffset = timeOffset * (1 - alpha) + newOffset * alpha;
  }
  
}

// 時間ずれを考慮したうえで
// 全員が基準とする共通タイム生成
function getNow() {
  if (!Number.isFinite(timeOffset)) {
    return Date.now(); // フォールバック
  }
  return Date.now() + timeOffset;
}


// 時刻更新
setInterval(() => {
  const clientNow = Date.now();
  const syncedNow = getNow();

  
  const offsetEl = document.getElementById("offset_time");

  offsetEl.textContent = Number.isFinite(timeOffset)
    ? `${Math.round(timeOffset)} ms`
    : "OFFSET_ERR";


  //デバッグ用ゾーン
  // const clientEl = document.getElementById("client_time");
  // const serverEl = document.getElementById("server_time");
  
  // if (!clientEl || !serverEl || !offsetEl) return;

  // clientEl.textContent = new Date(clientNow).toLocaleTimeString('ja-JP', {
  //   hour12: false,
  //   minute: '2-digit',
  //   second: '2-digit'
  // });
  // serverEl.textContent = new Date(syncedNow).toLocaleTimeString('ja-JP', {
  //   hour12: false,
  //   minute: '2-digit',
  //   second: '2-digit'
  // });

}, 250);



// 自動スクロール

// 問題文～選択肢まで
function scrollToQuestion() {
  const el = document.getElementById("question_area");

  const y = el.getBoundingClientRect().top + window.pageYOffset;

  window.scrollTo({
    top: y , 
    behavior: "smooth"
  });
}

// ランキング表示部分へ移動
function scrollToRanking() {
  const el = document.getElementById("ranking_area");

  const y = el.getBoundingClientRect().top + window.pageYOffset;

  window.scrollTo({
    top: y ,
    behavior: "smooth"
  });
  
}



// ===============================
// リロード対策
// ===============================
// ・ページ読み込み時に /api/state を取得
// ・サーバーの現在状態を見て画面を復元する

window.addEventListener("load", async () => {
  await syncState();
});

socket.on("connect", async () => {
  console.log("[CLIENT] reconnected");
  await syncState();
});

setInterval(async () => {
  try {
    const res = await fetch("/api/state");
    const state = await res.json();
    updateOffset(state.serverNow);
  } catch {}
}, 15000);


async function syncState() {
  // 枠線も削除
  answeredChoiceRendered = false;
  // 問題データなどを削除
  clearQuestionText();

  const state = await fetch("/api/state").then(r => r.json());
  latestState = state;
  // console.log("[CLIENT] load state", state);
  // タイマー再取得
  updateOffset(state.serverNow); 

    // 共通の復元処理
    // スコア反映など
    socket.emit("client:reload");
    
    // ===== 出題中の復元処理 =====
    if (state.phase === "question") { 
        // 現在クイズ中であることを記録
        socketQuestionActive = true;
        currentQuestionId = state.questionId;

        // サーバーが保持している「解答済みID一覧」を基準に
        // このクライアントが解答済みかどうかを判定
        const myAnswer = state.answers?.[clientId];
        hasAnswered = myAnswer && myAnswer.answer !== "over";

        // タイマーが有効になるまでは解答不可
        canAnswer = false;
        // 出題準備中表示を消す
        question__default.forEach(el =>{
            el.classList.add("none");
        });  
        questionRendered = false; //問題文有無の状態管理

        // サーバー時刻基準でタイマーを再開
        startStableTimer(state);
        scrollToQuestion(); 

         // 出題情報の再反映
        renderQuestion(state);
        // 選んだ選択肢の枠線情報
        restoreAnsweredChoice(state);

        // 解答があるときの表示
        if (hasAnswered) {
          monitor_result.innerHTML = "解答受付済";
          time_limit.classList.remove("time__limit__active");
          answer_lamp.classList.remove("lamp-on");
          answer_lamp.classList.add("lamp-off");
        } else {
          monitor_result.innerHTML = "出題中";
          time_limit.classList.add("time__limit__active");
          answer_lamp.classList.remove("lamp-off");
          answer_lamp.classList.add("lamp-on");
        }
        
    }

    // アンサーチェック前のリロード復元
    if (state.phase === "answer_check_ready") {
   
      // 出題準備中表示を消す
        question__default.forEach(el =>{
            el.classList.add("none");
        }); 

        // 出題情報の再反映
        renderQuestion(state);
        // 選んだ選択肢の枠線情報
        restoreAnsweredChoice(state);
        // 
        monitor_result.innerHTML = "解答受付済";
        
        scrollToQuestion();  
        // 解答状態の反映(後で関数にでもする)
        /// 解答時の処理
        const myAnswer = state.answers?.[clientId];
        // シンプルにタイムオーバー（answer: 'over'） or 途中参加で解答無し
        if(!myAnswer || myAnswer.answer === "over"  ){
            monitor_result.innerHTML = "タイムオーバー";
            // 0表示 タイマー背景灰色 時間切れ ランプ消灯
            time_limit_count.innerHTML = "0";
            time_limit.classList.remove("time__limit__active");
            answer_lamp.classList.remove("lamp-on");
            answer_lamp.classList.add("lamp-off");
            return;
        } else{
            // 解答がある場合
            // 0表示 タイマー背景赤 ランプ点灯（ランプ文字そのまま）
            time_limit_count.innerHTML = "0";
            time_limit.classList.add("time__limit__active");
            answer_lamp.classList.remove("lamp-off");
            answer_lamp.classList.add("lamp-on");
            return;
        }

    }

    // アンサーチェック中のリロード復元
    if (state.phase === "answer_check") {
      scrollToQuestion();  
      // 出題準備中表示を消す
        question__default.forEach(el =>{
            el.classList.add("none");
        }); 

        // 出題情報の再反映
        renderQuestion(state);
        // アンサーチェック情報の反映
        showAnswerCheck(state.answerCounts);
        // 選んだ選択肢の枠線情報
        restoreAnsweredChoice(state);

       

        /// 解答時の処理
        const myAnswer = state.answers?.[clientId];
        // シンプルにタイムオーバー（answer: 'over'） or 途中参加で解答無し
        if(!myAnswer || myAnswer.answer === "over" ){
            monitor_result.innerHTML = "タイムオーバー";
            // 0表示 タイマー背景灰色 時間切れ ランプ消灯（不正解確定のため）
            time_limit_count.innerHTML = "0";
            time_limit.classList.remove("time__limit__active");
            answer_lamp.classList.remove("lamp-on");
            answer_lamp.classList.add("lamp-off");
            return;
        } else{
            // 解答がある場合
            monitor_result.innerHTML = "解答受付済";
            // 0表示 タイマー背景赤 ランプ点灯
            time_limit_count.innerHTML = "0";
            time_limit.classList.add("time__limit__active");
            answer_lamp.classList.remove("lamp-off");
            answer_lamp.classList.add("lamp-on");
            return;
        }

    }

    // result での リロード復元
    if (state.phase === "result") {
        // 出題準備中表示を消す
        question__default.forEach(el =>{
            el.classList.add("none");
        }); 

        // 出題情報の再反映
        renderQuestion(state);
        // アンサーチェック情報の反映
        showAnswerCheck(state.answerCounts);
        // 選んだ選択肢の枠線情報
        restoreAnsweredChoice(state);

        // 正解選択肢の表示
        showCorrectAnswer(state.correctAnswer);
        
        // 解答時の処理
        const myAnswer = state.answers?.[clientId];


        // 正解不正解表示とスコア更新（スコアはサーバー管理）
        console.log(myAnswer);
        console.log(myAnswer.result);
        if (myAnswer && myAnswer.result) {
            quizResultLampAction(myAnswer.result);
        }
        scrollToQuestion();

        // タイムオーバー（answer: 'over'） or 途中参加で解答無し
        if(!myAnswer || myAnswer.answer === "over" ){
            // 0表示 タイマー背景灰色  
            time_limit_count.innerHTML = "0";
            time_limit.classList.remove("time__limit__active");
            return;
        } else{
            // 解答がある場合
            // 0表示 タイマー背景赤
            time_limit_count.innerHTML = "0";
            time_limit.classList.add("time__limit__active");
            return;
        }
    }
};


// ===============================
// 問題文・選択肢描画
// ===============================

// 文章択数UI切替
function applyTextChoiceLayout(choiceCount) {

  // 全文章問題レイアウトを一旦非表示
  question__text__4text.forEach(el => el.classList.add("none"));
  question__text__3text.forEach(el => el.classList.add("none"));
  question__text__2text.forEach(el => el.classList.add("none"));

  // 指定された択数だけ表示
  if (choiceCount === 4) {
    question__text__4text.forEach(el => el.classList.remove("none"));
  }
  if (choiceCount === 3) {
    question__text__3text.forEach(el => el.classList.remove("none"));
  }
  if (choiceCount === 2) {
    question__text__2text.forEach(el => el.classList.remove("none"));
  }
}

// 問題の表示を全て消す
function clearQuestionText() {

    // 出題準備中表示を消す
    question__default.forEach(el =>{
        el.classList.add("none");
    });  

    // 問題文空白
    question_text.innerHTML = "";

    // 全選択肢空白
    select__button.forEach(btn => btn.innerHTML = "");
    
    //全アンサーチェックリセット   
    answer__sum.forEach(btn => {
        // 人数表示
        btn.innerHTML = "";
        // 正解演出
        btn.classList.remove("correct");
    });
}






// ・questionId を元に、問題文と選択肢を画面に反映
function renderQuestion(state) {

  if (!state.questionText || !state.choices) {
    console.log("[RENDER] question data missing");
    return;
  }
  
  // 出題開始前は何もしない
  if (getNow() < state.answerOpenAt) {
    clearQuestionText(); //念のため 
    return;  }

  // 選択肢数
  const choiceCount = state.choices.length;

  // 選択肢数に応じて表示
  applyTextChoiceLayout(choiceCount);

  // 問題文を反映
  question_text.innerHTML = state.questionText;

  // 選択肢の内容を一旦クリア
  select__button.forEach(btn => btn.innerHTML = "");

  // JSONから選択肢反映
  state.choices.forEach((text, index) => {

    const targets = document.querySelectorAll(
      `.select__button__${index + 1}`
    );

    targets.forEach(btn => {
      btn.innerHTML = text;
      btn.value = index; // ★ 0始まり
    });
  });

  // フォント調整
  adjustFont();
}





// ===============================
// Socket：出題開始
// ===============================
// ・サーバーから「出題開始」イベントを受信
// ・最新状態を /api/state から取得して同期
socket.on("questionStarted", () => {
  console.log("[CLIENT] questionStarted");
    // 出題
    socketQuestionActive = false;
    currentQuestionId = null;
    questionRendered = false;
    answeredChoiceRendered = false;
    syncQuestionFromServer();
    area.innerHTML = "";
});




// ===============================
// 状態同期
// ===============================
// ・Socketイベント受信時にサーバー状態を再取得
// ・すでに同じ問題を表示中なら何もしない
function syncQuestionFromServer() {

  fetch("/api/state")
    .then(res => res.json())
    .then(state => {
        latestState = state;
      if (state.phase !== "question") return;

      const id = Number(state.questionId);
      if (Number.isNaN(id)) return;

      if (
        socketQuestionActive && currentQuestionId === id &&
        state.phase === "question"
      ) return;

        
        // 新しい問題なのでクライアント状態をリセット
        hasAnswered = false;
        canAnswer = false;

        // ボタン有効化 & 枠リセット
        select__button.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove("user-ans");
        });

        // 前の問題文削除 （出題時もリロード時も発動だが最終的には上書きされる）
        clearQuestionText();

        socketQuestionActive = true;
        currentQuestionId = id;

        applyTextChoiceLayout(state.textChoiceCount ?? 4);

        // サーバー基準で解答済みか再評価
        const myAnswer = state.answers?.[clientId];
        hasAnswered = !!(myAnswer && myAnswer.answer !== undefined);
            
        canAnswer = false;

        startStableTimer(state);
        scrollToQuestion();
    });
}


// ===============================
// 安定タイマー（サーバー基準）
// ===============================

// ・answerOpenAt / answerCloseAt を基準に状態を判定
// ・setInterval のズレを Date.now() 比較で吸収
function startStableTimer(state) {
  stopStableTimer();

  timerEndAt = state.answerCloseAt;

  stableTimer = setInterval(() => {
    const now = getNow();
    const remainingMs = timerEndAt - now;

    // ===== 時間切れ =====

    // 時間終了0.3秒程度だけ許す
    // （マイナス表示防止済・通称ブザービート→クライアントのブザービート的使い方)
    const UI_GRACE_MS = 300;
    if (now > state.answerCloseAt + UI_GRACE_MS) {
        
        // タイマー停止
        stopStableTimer();
        canAnswer = false;

        // 未解答時の処理
        if (!hasAnswered){
            // 0表示 タイマー背景灰色 時間切れ ランプ消灯
            time_limit_count.innerHTML = "0";
            time_limit.classList.remove("time__limit__active");
            monitor_result.innerHTML = "タイムオーバー";
            answer_lamp.classList.remove("lamp-on");
            answer_lamp.classList.add("lamp-off");
            return;
        }

        // 解答がある場合
        // 0表示 タイマー背景赤 ランプ点灯（ランプ文字そのまま）
        time_limit_count.innerHTML = "0";
        time_limit.classList.add("time__limit__active");
        answer_lamp.classList.remove("lamp-off");
        answer_lamp.classList.add("lamp-on");
        return;
    }

    // ===== 出題準備中 =====
    if (now < state.answerOpenAt) {
        canAnswer = false;

        // 問題文・選択肢は消す
        clearQuestionText();
        questionRendered = false; //問題文有無の状態管理

        // 択数枠は出す
        applyTextChoiceLayout(state.textChoiceCount ?? 4);

        //ボタン無効 
        select__button.forEach(btn => btn.disabled = true);

        time_limit_count.innerHTML = "？";
        time_limit.classList.remove("time__limit__active");
        answer_lamp.classList.add("lamp-on");
        answer_lamp.classList.remove("lamp-off");
        monitor_result.innerHTML = "出題準備中";
        
        return;
    };

    // ===== 出題中（解答可能）=====
        // 最大が０までなので、マイナス表示防止
       const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
        time_limit_count.innerHTML = remainingSec;
        time_limit.classList.add("time__limit__active");
        answer_lamp.classList.add("lamp-on");
        answer_lamp.classList.remove("lamp-off");

        // デバッグ用
        // const msEl = document.getElementById("time_limit_count_millisec_debug");
        // if (msEl) {
        //   const sec = Math.floor(remainingMs / 1000);
        //   const ms = Math.floor(remainingMs % 1000);
        //   msEl.textContent = `${Math.max(0, sec)}.${ms.toString().padStart(3, "0")}s`;
        // }
        

        // 1回だけ問題表示
        if (!questionRendered) {
            renderQuestion(state);
            questionRendered = true;
        }

        // リロードを含めて解答済みなら枠線をつける（1回だけ）
        if (hasAnswered && questionRendered && !answeredChoiceRendered) {
            restoreAnsweredChoice(latestState);
            answeredChoiceRendered = true;
        }

        // 未解答
        if (!hasAnswered) {
            canAnswer = true;
            select__button.forEach(btn => btn.disabled = false);
            monitor_result.innerHTML = "出題中";
        }

        // 解答済
        if (hasAnswered) {
            canAnswer = false;
            select__button.forEach(btn => btn.disabled = true);
            monitor_result.innerHTML = "解答受付済";
        }
  }, 100);//0.1秒ごとに状態更新   
}


// 解答選択肢に枠線をつける処理
// 解答済み状態でのリロード時などにも対応
function restoreAnsweredChoice(state = latestState) {
  if (!state) return;

  const myAnswer = state.answers?.[clientId]?.answer;
  if (myAnswer == null) return;

  const btn = [...document.querySelectorAll(
    `.select__button[value="${myAnswer}"]`
  )].find(b => !b.closest(".none"));

  if (btn) {
    btn.classList.add("user-ans");
  }
}




// ===============================
// タイマー停止
// ===============================
// ・多重起動防止
function stopStableTimer() {
  if (stableTimer) {
    clearInterval(stableTimer);
    stableTimer = null;
  }
}


// ===============================
// 問題終了処理
// ===============================
// ・結果フェーズ移行時に呼ばれる
function endQuestion() {
  if (!socketQuestionActive) return;

  stopStableTimer();

  socketQuestionActive = false;
  currentQuestionId = null;
  timerEndAt = null;
}


// ===============================
// 解答処理
// ===============================

select__button.forEach(btn => {
  btn.addEventListener("click", handleAnswer);
});

// ・ボタンクリック時に呼ばれる
// ・クライアント側でも二重送信を防止
function handleAnswer(event) {
  event.preventDefault();

  if (!canAnswer || hasAnswered) return;

  const selectedIndex = Number(event.currentTarget.value);

  const clientSendTime = getNow();

  socket.emit("client:answer", {
    clientId,
    answer: selectedIndex,
    clientSendTime,
    rtt // 測定結果も送る
  });
}


socket.on("answerAccepted", (payload) => {
  console.log("[CLIENT] answerAccepted", payload);

    // payloadの内容例
    // {
    //     clientId: 'edf2abd2-36dc-483b-83cf-81b86501d0ef',
    //     answer: 2, 
    //     elapsedSecFixed: 3.8
    // }

  // UIロック
  hasAnswered = true;
  canAnswer = false;

  monitor_result.textContent = `解答完了`;

  // 全ボタン無効化
  select__button.forEach(btn => {
    btn.disabled = true;
  });

  // 押したボタンに枠を付ける
    const btn = [...document.querySelectorAll(
    `.select__button[value="${payload.answer}"]`
    )].find(b => !b.closest(".none"));

    if (btn) {
        btn.classList.add("user-ans");
    }
});



// ===============================
// 解答済みUIロック
// ===============================
function lockAnsweredUI() {
  canAnswer = false;// 新規解答不可
  hasAnswered = true;// 解答送信済み
  
  // ランプのメッセージ更新
  answer_lamp_info.innerHTML = "解答受付";
  // 解答受付→リロードなどなしで解答が出来たとき
  // 解答受付済→リロードで解答不能なとき

  //全解答ボタン無効化   
  select__button.forEach(btn => {
    btn.disabled = true;
  }); 

}

// ===============================
// アンサーチェック
// ===============================

socket.on("answerCheckStarted", ({ answerCounts }) => {
  console.log("[CLIENT] answerCheckStarted", answerCounts);
  showAnswerCheck(answerCounts);
  scrollToQuestion();
});


// アンサーチェック表示
function showAnswerCheck(answerCounts) {

  canAnswer = false;
  hasAnswered = true;

  monitor_result.innerHTML = "アンサーチェック";

  select__button.forEach(btn => {
    btn.disabled = true;

    const choiceNumber = Number(btn.value);
    const count = answerCounts?.[choiceNumber] ?? 0;

    const form = btn.closest(".choice-form");
    if (!form) return;

    const sumEl = form.querySelector(".answer__sum");
    if (!sumEl) return;

    // 本番用
    sumEl.textContent = `${count}人`;
    // デバッグ用
    // sumEl.textContent = `77人`;
  });

}


// ===============================
// 正解発表
// ===============================
socket.on("resultStarted", ({ correct }) => {
  console.log("[CLIENT] resultStarted correct =", correct);
  showCorrectAnswer(correct);
  scrollToQuestion();
});

function showCorrectAnswer(correct) {
    
  if (correct == null || correct < 1) {
    console.log("[WARN] invalid correct value:", correct);
    return;
  }
  
  // answer__sum にかかっているものを全てリセット
  document
  .querySelectorAll(".answer__sum")
  .forEach(el => el.classList.remove("correct"));


  // 正解番号に対応する answer__sum を取得
  const cor = document.querySelectorAll(
    `.answer__sum__${correct}`
  );

  console.log("[CORRECT ELEMENTS]", cor);

  let count = 0;

  function Flash() {
    if (count < 10) {
      cor.forEach(el => {
        if (count % 2 === 0) {
          el.classList.add("correct");
        } else {
          el.classList.remove("correct");
        }
      });
      count++;
    } else {
      cor.forEach(el => el.classList.add("correct"));
      clearInterval(secFlash);
    }
  }

  const secFlash = setInterval(Flash, 150);

  // ===== UI制御 =====
  select__button.forEach(btn => btn.disabled = true);
}


// ===============================
// スコア付与関連
// ===============================

// スコアアップデート
// クイズでのスコア付与 リロード 問題取消 再計算 など全てに対して処理 
socket.on("scoresUpdated", ({ scores }) => {
  const my = scores[clientId];
  if (!my) {
    monitor_correct_total.innerHTML = 0;
    monitor_time_total.innerHTML = Number(0.00).toFixed(2);
    return;
  }
  monitor_correct_total.innerHTML = Number(my.correctCount);
  monitor_time_total.innerHTML = Number(my.totalTime).toFixed(2);
});

// クイズでのスコア付与のランプ演出
socket.on("quizResultLamp", ({ result }) => {
 quizResultLampAction(result);
});

// リロードなどで再発動用
function quizResultLampAction(result){
  if (result === "correct") {
    answer_lamp.classList.add("lamp-on");
    answer_lamp.classList.remove("lamp-off");
    monitor_result.innerHTML = "正解";
  } else if (result === "over") {
    answer_lamp.classList.remove("lamp-on");
    answer_lamp.classList.add("lamp-off");
    monitor_result.innerHTML = "未解答";
  } else if (result === "seizure") {
    answer_lamp.classList.remove("lamp-on");
    answer_lamp.classList.add("lamp-off");
    monitor_result.innerHTML = "早押し最下位";
  } else if (result === "event") {
    answer_lamp.classList.add("lamp-on");
    answer_lamp.classList.remove("lamp-off");
    monitor_result.innerHTML = "結果発表";
  }
  else {
    answer_lamp.classList.remove("lamp-on");
    answer_lamp.classList.add("lamp-off");
    monitor_result.innerHTML = "不正解";
  }
};








// ユーザー名の登録
nameUpdateBtn.addEventListener("click", () => {

  const name = nameInputEl.value.trim();
  if (!name) return; 
  socket.emit("client:setName", {
    clientId,
    name
  });
});

socket.on("namesUpdated", ({ names }) => {

  if (clientId in names) {
    userNameEl.textContent = names[clientId];
  }

});

// リロード
socket.on("connect", () => {
  socket.emit("registerClient", { clientId });
});




// ランキング反映関連

// 総合成績
socket.on("ranking:total", ({ ranking }) => {
  
  const area = document.getElementById("index_ranking_area");
  area.innerHTML = ""; // 既存クリア

  if (!ranking || ranking.length === 0) {
    area.textContent = "ランキングデータがありません";
    return;
  }
  // ===== コンテナ =====
  const container = document.createElement("div");
  container.className = "ranking_block";

  // ===== タイトル =====
  const title = document.createElement("h2");
  title.textContent = "総合成績";
  container.appendChild(title);

  // ===== テーブル =====
  const table = document.createElement("table");
  table.className = "ranking_table";

  // ヘッダー
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>順位</th>
      <th>名前</th>
      <th>正解数</th>
      <th>合計タイム</th>
    </tr>
  `;
  table.appendChild(thead);

  // 本体
  const tbody = document.createElement("tbody");

  ranking.forEach((player) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${player.rank}</td>
      <td>${player.name}</td>
      <td>${player.correctCount}問</td>
      <td>${player.totalTime.toFixed(2)}秒</td>
    `;

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
  area.appendChild(container);

  scrollToRanking();
});


// 早押しベスト４
socket.on("ranking:correctBest", ({ ranking }) => {

  const area = document.getElementById("index_ranking_area");
  area.innerHTML = ""; // 既存クリア

  if (!ranking || ranking.length === 0) {
    area.textContent = "ランキングデータがありません";
    return;
  }
  
  // ===== コンテナ =====
  const container = document.createElement("div");
  container.className = "ranking_block";

  // ===== タイトル =====
  const title = document.createElement("h2");
  title.textContent = "早押しベスト４";
  container.appendChild(title);

  // ===== テーブル =====
  const table = document.createElement("table");
  table.className = "ranking_table";

  // ヘッダー
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>順位</th>
      <th>名前</th>
      <th>タイム</th>
    </tr>
  `;
  table.appendChild(thead);

  // 本体
  const tbody = document.createElement("tbody");

  ranking.forEach((player) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${player.rank}</td>
      <td>${player.name}</td>
      <td>${player.time.toFixed(2)}秒</td>
    `;

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
  area.appendChild(container);

  scrollToRanking();
});

// 早押しワースト４
socket.on("ranking:correctWorst", ({ ranking }) => {

  const area = document.getElementById("index_ranking_area");
  area.innerHTML = ""; // 既存クリア

  if (!ranking || ranking.length === 0) {
    area.textContent = "ランキングデータがありません";
    return;
  }
  // ===== コンテナ =====
  const container = document.createElement("div");
  container.className = "ranking_block";

  // ===== タイトル =====
  const title = document.createElement("h2");
  title.textContent = "早押しワースト４";
  container.appendChild(title);

  // ===== テーブル =====
  const table = document.createElement("table");
  table.className = "ranking_table";

  // ヘッダー
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>順位</th>
      <th>名前</th>
      <th>タイム</th>
    </tr>
  `;
  table.appendChild(thead);

  // 本体
  const tbody = document.createElement("tbody");

  ranking.forEach((player) => {

    const tr = document.createElement("tr");
    
    tr.classList.add("worst-row");

    tr.innerHTML = `
      <td>${player.rank}</td>
      <td>${player.name}</td>
      <td>${player.time.toFixed(2)}秒</td>
    `;

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
  area.appendChild(container);

  scrollToRanking();
});


// ハイブリッドルール（減点）
socket.on("ranking:hybridWorst", ({ result }) => {

  scrollToRanking();
  const area = document.getElementById("index_ranking_area");
  area.innerHTML = "";

  const container = document.createElement("div");
  container.className = "ranking_block";

  const title = document.createElement("h2");
  title.textContent = "早押しワースト４";
  container.appendChild(title);

  const table = document.createElement("table");
  table.className = "ranking_table";

  table.innerHTML = `
    <thead>
      <tr>
        <th>順位</th>
        <th>名前</th>
        <th>タイム</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement("tbody");

  result.forEach(player => {

    const tr = document.createElement("tr");

    tr.classList.add("worst-row");

    tr.innerHTML = `
      <td>${player.rank}</td>
      <td>${player.name}</td>
      <td>${player.time.toFixed(2)}秒</td>
    `;

    // ▼ 没収対象だけ強調
    if (player.isSeizure) {
      tr.classList.add("seizure-row");
      tr.innerHTML = `
        <td>没収</td>
        <td>${player.name}</td>
        <td>${player.time.toFixed(2)}秒</td>
      `;
    }

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
  area.appendChild(container);
  
  // 最下位点滅
  flashSeizureRows();
});

function flashSeizureRows() {

  const rows = document.querySelectorAll(".seizure-row");

  if (!rows.length) return;

  let count = 0;

  const interval = setInterval(() => {

    rows.forEach(row => {
      if (count % 2 === 0) {
        row.classList.add("seizure-active");
      } else {
        row.classList.remove("seizure-active");
      }
    });

    count++;

    // 点滅回数（20回）
    if (count >= 20) {
      clearInterval(interval);

      // 最終状態（点灯状態で止める）
      rows.forEach(row => row.classList.add("seizure-active"));
    }

  }, 150);
}


// ランキング非表示
const area = document.getElementById("index_ranking_area");

socket.on("ranking:none", () => {
  area.innerHTML = "";
});


// イレギュラー対応

socket.on("phaseReset", () => {

  console.log("[CLIENT] phaseReset received");

  stopStableTimer();

  socketQuestionActive = false;
  currentQuestionId = null;
  questionRendered = false;
  answeredChoiceRendered = false;

  clearQuestionText();

  // 問題部分非表示
  question.forEach(el =>{
      el.classList.add("none");
  });

  monitor_result.innerHTML = "待機中";

  time_limit_count.innerHTML = "";
  time_limit.classList.remove("time__limit__active");

});

// 問題取消時のメッセージ
// メモ　pointUpdateInfo はいずれ変える
socket.on("pointUpdateInfo", () => {
  stopStableTimer();

  socketQuestionActive = false;
  currentQuestionId = null;
  questionRendered = false;
  answeredChoiceRendered = false;

  clearQuestionText();

  // 問題部分非表示
  question.forEach(el =>{
      el.classList.add("none");
  });

  
  monitor_result.innerHTML = "スコア更新";

  time_limit_count.innerHTML = "";
  time_limit.classList.remove("time__limit__active");

});

// ゲームリセット
socket.on("game:reset", () => {
  console.log("[RESET RECEIVED]");

  location.reload();
});



// 表示モードの分岐
function getDevice() {
  const width = window.innerWidth;

  return {
    isMobile: width <= 428,
    isTablet: width >= 429 && width <= 719,
    isPC: width >= 720
  };
}

function adjustFont() {

  const { isMobile, isTablet, isPC } = getDevice();

  // ----------------------
  // 出題文字サイズの調整（表示保証５０文字）
  // ----------------------

  document.querySelectorAll('#question_text').forEach(el => {
    const textLength = el.textContent.trim().length;
    console.log(textLength);

    if (isMobile) {
    // スマホ（375px表示）
      if (textLength <= 5) el.style.fontSize = '40px';//５文字以下
      else if (textLength <= 7) el.style.fontSize = '30px';//６～７文字
      else if (textLength <= 24) el.style.fontSize = '27px';//８～２４文字
      else el.style.fontSize = '20px';//２５文字以上～  
    } 
    //PC表示 （720px表示）
    else {
      if (textLength <= 7) el.style.fontSize = '60px';//７文字以下
      else if (textLength <= 10) el.style.fontSize = '45px';//８～１０文字
      else if (textLength <= 22) el.style.fontSize = '40px';//１１～２２文字
      else el.style.fontSize = '28px';//２３文字以上～  
    }
  });

  // ----------------------
  // 選択肢文字サイズの調整（表示保証４０文字）
  // ----------------------
  
  // ２択
  document.querySelectorAll('.question__text__2text .select__button').forEach(el => {
    const textLength = el.textContent.trim().length;
    console.log(textLength);

    if (isMobile) {
    // スマホ（375px表示）
      if (textLength <= 5) el.style.fontSize = '45px';//５文字以下
      else if (textLength <= 8) el.style.fontSize = '27px';//６～８文字
      else if (textLength <= 10) el.style.fontSize = '22px';//９～１０文字
      else if (textLength <= 24) el.style.fontSize = '18px';//１１～２４文字
      else el.style.fontSize = '16px';//２５文字以上～  
    } 
    //PC表示 （720px表示）
    else {
      if (textLength <= 5) el.style.fontSize = '80px';//５文字以下
      else if (textLength <= 8) el.style.fontSize = '60px';//６～８文字
      else if (textLength <= 10) el.style.fontSize = '45px';//９～１０文字
      else if (textLength <= 24) el.style.fontSize = '38px';//１１～２４文字
      else el.style.fontSize = '32px';//２５文字以上～
    }
  });

  document.querySelectorAll('.question__text__3text .select__button').forEach(el => {
    const textLength = el.textContent.trim().length;
    console.log(textLength);

    if (isMobile) {
    //スマホ表示 （375px表示）
      if (textLength <= 5) el.style.fontSize = '45px';//５文字以下
      else if (textLength <= 8) el.style.fontSize = '27px';//６～８文字
      else if (textLength <= 10) el.style.fontSize = '22px';//９～１０文字
      else if (textLength <= 24) el.style.fontSize = '18px';//１１～２４文字
      else el.style.fontSize = '16px';//２５文字以上～ 
    } 
    //PC表示 （720px表示）
    else {
      if (textLength <= 8) el.style.fontSize = '60px';//８文字以下
      else if (textLength <= 10) el.style.fontSize = '45px';//９～１０文字
      else if (textLength <= 24) el.style.fontSize = '30px';//１１～２４文字
      else el.style.fontSize = '22px';//２５文字以上～ 
    }
  });

    document.querySelectorAll('.question__text__4text .select__button').forEach(el => {
    const textLength = el.textContent.trim().length;
    console.log(textLength);

    if (isMobile) {
    //スマホ表示 （375px表示）
      if (textLength <= 5) el.style.fontSize = '45px';//５文字以下
      else if (textLength <= 8) el.style.fontSize = '27px';//６～８文字
      else if (textLength <= 20) el.style.fontSize = '22px';//９～２０文字
      else el.style.fontSize = '14px';//２１文字以上
    } 
    //PC表示 （720px表示）
    else {
      if (textLength <= 8) el.style.fontSize = '50px';//８文字以下
      else if (textLength <= 10) el.style.fontSize = '40px';//９～１０文字
      else if (textLength <= 15) el.style.fontSize = '30px';//１１～１５文字
      else el.style.fontSize = '23px';//１６文字以上
    }
  });
}
