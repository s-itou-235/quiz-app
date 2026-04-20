require("dotenv").config();

// 起動チェック
console.log("=== THIS SERVER.JS IS RUNNING ===");

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();

app.use(cors({
  // このURLからだけアクセス許可
  origin: ["http://localhost:3000","https://mou-fan-zu-feng-kuizutsuru.onrender.com/"],
  // HTTPメソッド制限
  methods: ["GET", "POST", "DELETE"],
  // Cookieや認証情報を許可
  credentials: true
}));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分
  max: 100, // 100回まで
  message: "ログイン試行が多すぎます。少し待ってください"
});

app.use(express.json());
app.use(express.static("public"));

// ログイン系だけ制限
app.use("/api/admin", apiLimiter);

const gameState = require("./gameState");

// ===============================
// 管理者認証
// ===============================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD is not set");
}

let currentAdminSocketId = null;

const loginAttempts = new Map();

// admin過剰操作防止
// function requireAdmin(socket, actionName) {
//   if (socket.id !== currentAdminSocketId) {
//     console.log("[SECURITY BLOCKED]", actionName, socket.id);
//     return false;
//   }
//   return true;
// }




// ===============================
// 問題データ保存用
// ===============================
const fs = require("fs");
const path = require("path");

const QUESTION_DATA_FILE = path.join(__dirname, "questions.json");
console.log("QUESTION FILE PATH:", QUESTION_DATA_FILE);
// ファイルが無ければ作る（初回起動対策）
if (!fs.existsSync(QUESTION_DATA_FILE)) {
  fs.writeFileSync(QUESTION_DATA_FILE, "[]");
}

// 問題取得
let questionBank = {};

function loadQuestions() {
  const raw = fs.readFileSync(QUESTION_DATA_FILE, "utf-8");
  const arr = JSON.parse(raw);
  questionBank = {};
  arr.forEach(q => {
    questionBank[q.id] = q;
  });

  
}

loadQuestions();



app.use("/admin", require("./routes/adminRoutes"));
// app.use("/api/state", require("./routes/stateRoutes"));

// ===============================
// 問題データAPI
// ===============================

// 問題一覧取得
app.get("/questions", (req, res) => {
  try {
    let raw = fs.readFileSync(QUESTION_DATA_FILE, "utf-8");

    // 空ファイル対策
    if (!raw.trim()) {
      raw = "[]";
      fs.writeFileSync(QUESTION_DATA_FILE, raw);
    }

    const questions = JSON.parse(raw);
    console.log("[GET] returning count:", questions.length);
    res.json(questions);

  } catch (err) {
    console.error("[GET /questions] error:", err);

    // 壊れていた場合は初期化
    fs.writeFileSync(QUESTION_DATA_FILE, "[]");

    res.json([]);
  }
});

// 問題保存（追加）
app.post("/questions", (req, res) => {
  try {
    const newQuestion = req.body;

    const raw = fs.readFileSync(QUESTION_DATA_FILE, "utf-8");
    const questions = JSON.parse(raw);

    // 同じIDがあれば削除（上書き保存）
    const filtered = questions.filter(q => q.id !== newQuestion.id);
    filtered.push(newQuestion);

   fs.writeFileSync(
      QUESTION_DATA_FILE,
      JSON.stringify(filtered, null, 2)  // ← ここを変更
    );

    loadQuestions(); 
    console.log("AFTER SAVE FILE CONTENT:");
    console.log(fs.readFileSync(QUESTION_DATA_FILE, "utf-8"));

    console.log("[SAVE] question saved:", newQuestion.id);
    console.log("保存後データ:", filtered);

    res.json({ status: "saved" });

  } catch (err) {
    console.error("[POST /questions] error:", err);
    res.status(500).json({ error: "保存失敗" });
  }
});

// 問題削除
app.delete("/questions/:id", (req, res) => {
  try {
    const id = req.params.id; // 数値化しない

    const raw = fs.readFileSync(QUESTION_DATA_FILE, "utf-8");
    const questions = JSON.parse(raw);

    const filtered = questions.filter(q => String(q.id) !== String(id));

    if (filtered.length === questions.length) {
      return res.status(404).json({ error: "問題が見つかりません" });
    }

    fs.writeFileSync(
      QUESTION_DATA_FILE,
      JSON.stringify(filtered, null, 2)
    );

    console.log("[DELETE] question removed:", id);

    res.json({ status: "deleted", id });
    loadQuestions();

  } catch (err) {
    console.error("[DELETE /questions/:id] error:", err);
    res.status(500).json({ error: "削除失敗" });
  }
});


// ===============================
// 管理者用ランキングAPI
// ===============================
app.get("/api/admin/ranking", (req, res) => {

  // -------------------------
  // 総合成績ランキング
  // -------------------------

  const playerNames = gameState.playerNames || {};
  const totalData = gameState.scores || {};

  const totalRanking = Object.keys(playerNames)
    .map(clientId => {

      const data = totalData[clientId];

      return {
        clientId,
        name: playerNames[clientId] || "未登録",
        correctCount: data?.correctCount ?? 0,
        totalTime: data?.totalTime ?? 0
      };
    })
    .sort((a, b) => {
      if (b.correctCount !== a.correctCount) {
        return b.correctCount - a.correctCount;
      }
      return a.totalTime - b.totalTime;
    });


  // -------------------------
  // 問題ランキング(全員/正解者のみ)
  // -------------------------

  const qid = gameState.questionId ;  
  
  let questionData;
  if (gameState.questionResults?.[qid]) {
    questionData = gameState.questionResults[qid].answers;
  } else {
    questionData = gameState.answersByClientId;
  }


  let allAnswersRanking = [];
  let correctOnlyRanking = [];

  if (questionData) {

    const answerArray = Object.entries(questionData)
      .map(([clientId, ans]) => ({
        name: gameState.playerNames[clientId] || "未登録",
        answer: ans.answer,
        time: ans.time,
        result: ans.result
      }))
      .sort((a, b) => {
        if (a.time == null) return 1;
        if (b.time == null) return -1;
        return a.time - b.time;
      });

    allAnswersRanking = answerArray;
    correctOnlyRanking = answerArray.filter(
      p => (p.result === "correct" || p.result === "seizure") && p.time != null
);
  }

  res.json({
    totalRanking,
    allAnswersRanking,
    correctOnlyRanking
  });

});


app.get("/api/state", (req, res) => {

  const qid = Number(gameState.questionId);
  const question = questionBank[qid];

  // 🔥 ここが核心
  let answersToSend = gameState.answersByClientId ?? {};

  if (
    gameState.phase === "result" &&
    gameState.questionResults[qid]
  ) {
    answersToSend = gameState.questionResults[qid].answers;
  }

  res.json({
    phase: gameState.phase,
    questionId: qid,
    
    // サーバーで取得した絶対的な時刻
    // →main.jsでの const timeOffset = state.serverNow - Date.now();（〇〇行目あたり）参照
    serverNow: Date.now(),

    // ===== 問題データ =====
    questionText: question?.questionText ?? "",
    choices: question?.choices ?? [],
    textChoiceCount: question?.choices?.length ?? 4,
    correctAnswer: (question?.correctIndex ?? 0) + 1,

    // ===== タイミング =====
    answerOpenAt: gameState.answerOpenAt,
    answerCloseAt: gameState.answerCloseAt,

    // ===== 解答状況 =====
    answers: answersToSend,   // ★ ここを差し替え
    answerCounts: gameState.answerCounts ?? {}
  });
});

// ゲームリセット処理
app.post("/api/admin/reset", (req, res) => {

  // 🔒 簡易認証
  if (req.query.password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Forbidden" });
  }

  resetGameState();

  // 🔥 全員に通知（重要）
  io.emit("game:reset");

  console.log("[RESET] game state reset");

  res.json({ status: "reset done" });
});


const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // このURLのみ許可
    origin: ["http://localhost:3000","https://mou-fan-zu-feng-kuizutsuru.onrender.com/"],
    // HTTPメソッド制限
    methods: ["GET", "POST"]
  }
});

// ===============================
// 関数など
// ===============================

function collectResultAnswers() {
  return Object.entries(gameState.answersByClientId).map(
    ([clientId, data]) => ({
      clientId,
      answer: data.answer,
      time: data.elapsedSecFixed
    })
  );
}

// 解答データやスコアデータの保存関数
function finalizeQuestionResult(qid) {
  // 二重加算防止
  if (gameState.questionResults[qid]) return;

  const question = questionBank[qid];
  if (!question) {
    console.log("[FINALIZE] question not found:", qid);
    return;
  }

  // 各問題の正解番号と正解時のポイント
  const correct = 
    gameState.correctAnswer !== undefined
        ? gameState.correctAnswer
        : question.correctIndex;
  const pointCorrect = question.point?.correct ?? 1;
  const pointWrong = question.point?.wrong ?? 0;
  
  // イベントモード
  const isEvent = question.category === "event";

  // questionResults[qid].answersに入れる用のオブジェクトデータ
  const finalizedAnswers = {
    // 入るデータのイメージ
      // {
      //    clientId: {
      //    answer: 2 | "over"（タイムオーバー）,
      //    time: 3.61 | null（タイムオーバーでタイム無し）,
      //    result: "correct" | "wrong" | "over"（タイムオーバー）
      //   }
      // }
  };

  // 参加者リストの確定
  const participants = new Set([
    // 解答した人の一時データ
    ...Object.keys(gameState.answersByClientId),
    // 上記一時データからClientIdを検索
    // 1問以上参加している人のスコアデータがあればそれを入れる
    // 無い場合はスコアデータを生成
    ...Object.keys(gameState.playerNames ?? {})
  ]);

  // この問題に解答した人全員を1人ずつ処理
  for (const clientId of participants) {
    // それぞれ解答データ
    const src = gameState.answersByClientId[clientId];

    // 未解答or時間切れ状態の場合は 以下の解答扱い
    if (!src || src.answer === "over") {
      finalizedAnswers[clientId] = {
        answer: "over",
        time: null,
        result: "over"
      };
      continue;
    }

    // 解答がある場合
    // ここで正誤判定を行う
    // src.answer（ユーザーの解答） === correct（この問題の正解）;
    let result;
    if (correct === -1) {
      // 正解なし問題（アンケートなど）
      // 未解答時はそれで上書きされる
      result = "event";
    } else if (src.answer === correct) {
      // 正解処理
      result = "correct";
    } else {
      // 不正解処理
      result = "wrong";
    }

    finalizedAnswers[clientId] = {
      answer: src.answer,
      time: src.time,
      result
    };
  }
  
  //問題単位で保存する 
  gameState.questionResults[qid] = {
    correctAnswer: correct,
    pointCorrect,   // ★ 正解ポイント
    pointWrong,     // ★ 不正解ポイント
    isEvent, // イベントモードの有無
    answers: finalizedAnswers
  };

  //  questionResults [0]: {　→ 問題番号
  //  correctAnswer: 2,　問題の正解
  //  point: 1,　問題の正解ポイント
  //  answers: {
  //     clientId: {
  //       answer: 2 ,　→ clientIdの解答データ
  //      time: 3.61 ,　→ clientIdのタイムデータ
  //      result: "correct" → clientIdの正解不正解データ
  //   }
  console.log("[FINALIZE] questionResults saved:", gameState.questionResults);
  console.log("[FINALIZE] questionResults saved:", finalizedAnswers);
  console.log("[FINALIZE] questionResults saved:", qid);
}


// スコア計算
function recomputeScoresFromQuestionResults() {
  console.log("[DEBUG questionResults]", gameState.questionResults);
  const newScores = {};

  for (const qid in gameState.questionResults) {
    const question = gameState.questionResults[qid];

    const pointCorrect = question.pointCorrect ?? 1;
    const pointWrong = question.pointWrong ?? 0;
    const isEvent = question.isEvent;

    for (const clientId in question.answers) {
      const answerData = question.answers[clientId];

      if (!newScores[clientId]) {
        newScores[clientId] = {
          correctCount: 0,
          totalTime: 0,
          answerResult: null
        };
      }

      if (answerData.result === "correct") {
        newScores[clientId].correctCount += pointCorrect;

        // タイム加算条件
        // イベントモードの場合
        // もしくは正解ポイント０以下に設定した場合はタイム加算しない
        if (!isEvent && pointCorrect > 0) {
          newScores[clientId].totalTime += answerData.time ?? 0;
        }
      }

      if (answerData.result === "wrong") {
        newScores[clientId].correctCount += pointWrong;
      }
    }
  }

  gameState.scores = newScores;
  console.log("[RECOMPUTE] recalculated:", newScores);
}

// 正解発表後の正解変更に対応
// function refinalizeQuestion(qid){
//   delete gameState.questionResults[qid];

//   finalizeQuestionResult(qid);
//   recomputeScoresFromQuestionResults();
//   emitAdminState();
// }



// 管理者へフェーズ情報を送信
function emitAdminState() {
  io.emit("admin:state", {
    // リアルタイム情報用
    phase: gameState.phase, // フェーズ
    questionId: gameState.questionId, // 出題ID 
    players: gameState.players,  // 
    answers: gameState.answersByClientId, //
    askedQuestionIds: gameState.askedQuestionIds
  });

  // フェーズによって実行有無を決める
  // questionでは解答が大量に来るのでそのたび更新は負荷
  if (gameState.phase === "question")return;

  // 正解ナビ
  io.emit("admin:correctAnswerInfo", {
    correctAnswer: gameState.correctAnswer,
    choices: gameState.currentQuestion?.choices ?? [],
    questionId: gameState.questionId
  });

}

// エラーメッセージ表示用
// 使用例
// emitAdminError("メッセージ",変数)
// emitAdminError("フェーズが違います phase =",gameState.phase); など
function emitAdminError(message, detail = "") {
  io.emit("admin:error", {
    message,
    detail
  });
}

// ゲームリセット
function resetGameState() {
  gameState.phase = "idle";
  gameState.questionId = 0;
  gameState.answersByClientId = {};
  gameState.answerCounts = {};
  gameState.scores = {};
  gameState.playerNames = {};
  gameState.questionResults = {};
  gameState.askedQuestionIds = [];
}


// ===============================
// 接続と同時に行うものなど
// ===============================

// ===== 問題設定（★サーバーが唯一保持）=====
// 不変
const ANSWER_BUFFER_MS = 2000; // 出題～解答開始まで




io.on("connection", (socket) => {
//聖域 
  console.log("[SOCKET] connected",socket.id);
  
  // 管理者ログイン
  socket.on("admin:login", (password) => {

    const ip = socket.handshake.address;
    const now = Date.now();
    const windowMs = 60 * 1000;

    if (!loginAttempts.has(ip)) {
      loginAttempts.set(ip, []);
    }

    const attempts = loginAttempts.get(ip);

    const recentAttempts = attempts.filter(t => now - t < windowMs);

    if (recentAttempts.length >= 5) {
      socket.emit("admin:login_failed");
      console.log("[RATE LIMIT BLOCKED]", ip);
      return;
    }

    recentAttempts.push(now);
    loginAttempts.set(ip, recentAttempts);

    if (password !== ADMIN_PASSWORD) {
      socket.emit("admin:login_failed");
      console.log("[ADMIN LOGIN FAILED]", socket.id);
      return;
    }

    if (currentAdminSocketId && currentAdminSocketId !== socket.id) {

      const oldSocket = io.sockets.sockets.get(currentAdminSocketId);

      if (oldSocket) {
        oldSocket.leave("admin"); // ★これが重要
        oldSocket.emit("admin:force_logout");
      }
    }

    currentAdminSocketId = socket.id;
    socket.join("admin");
    socket.emit("admin:login_success");

    console.log("[ADMIN LOGIN SUCCESS]", socket.id);
    emitAdminState();
  });



  // 切断時に削除
  socket.on("disconnect", () => {
    if (socket.id === currentAdminSocketId) {
      console.log("[ADMIN DISCONNECTED]");
      currentAdminSocketId = null;
    }

    socket.leave("admin"); // 念のため
  });

  // 管理者側の初期フェーズ送信
  socket.emit("admin:state", {
    phase: "idle",
    questionId: gameState.questionId
  });

  // 接続時に現在の名前一覧を送信
  socket.emit("namesUpdated", {
    names: gameState.playerNames
  });
  
  // それぞれのユーザーデータ取得
  socket.on("registerClient", ({ clientId }) => {
    socket.join(clientId); 

    if (!gameState.playerNames) {
      gameState.playerNames = {};
    }

    if (!gameState.playerNames[clientId]) {
      gameState.playerNames[clientId] = "未登録";
      // ランキング更新
      io.to("admin").emit("scoresUpdated");
    }

    console.log(`[ROOM] socket ${socket.id} joined room ${clientId}`);
  });

  // ユーザーネーム取得
  socket.on("client:setName", ({ clientId, name }) => {
    if (!clientId || !name) return;

    gameState.playerNames[clientId] = name;
    console.log("[NAME UPDATE]", clientId, "ユーザー名",name);

    // １。ユーザーに名前反映（実行順大事）
    io.emit("namesUpdated", {
      names: gameState.playerNames
    });

    // ２。その名前をスコア表示に即反映（実行順大事）
    io.to("admin").emit("scoresUpdated");

  });

  // RTT取得
  socket.on("sync", ({ t0 }) => {
    socket.emit("sync:response", {
      t0,
      serverTime: Date.now()
    });
  });

  

  


  // ===============================
  // 出題開始関連
  // ===============================
  
  // 出題準備
  socket.on("admin:standby", ({ questionId }) => {
    // フェーズブロック
    // 押していいタイミングを記述
    // 「idle → gameState.jsの初期」 「standby → 出題準備（→問題変更）」 
    // 「result → 問題終了」など
    if (!["idle","standby", "result"].includes(gameState.phase)) {
      console.log("[ADMIN] standby blocked. phase =", gameState.phase);
      emitAdminError("[ADMIN] standby blocked. phase =", gameState.phase);
      return;
    }

    gameState.phase = "standby";
    gameState.questionId = questionId;


    const q = questionBank[questionId];

  
    gameState.currentQuestion = q;


    // 解答リセット
    gameState.answersByClientId = {};
    gameState.answerCounts = {};
    // 設定した正解のリセット
    gameState.correctAnswer = questionBank[questionId]?.correctIndex ?? undefined;

    emitAdminState();
    

    console.log("[ADMIN] qid set", gameState.questionId);

    socket.emit("admin:standby:ok", {
      phase: gameState.phase,
      questionId
    });

    // 正解ナビ
    io.emit("admin:correctAnswerInfo", {
      correctAnswer: gameState.correctAnswer,
      choices: gameState.currentQuestion?.choices ?? [],
      questionId: gameState.questionId
    });

  });

  // 出題開始
  socket.on("admin:startQuestion", () => {

    if (gameState.phase !== "standby") {
      console.log("[SERVER]startQuestion BLOCKED(フェーズ違い)", gameState.phase);
      emitAdminError("このボタンはstandbyフェーズ専用です! （現在のフェーズ）→", gameState.phase);
      return
    };

    const now = Date.now();
    const qid = Number(gameState.questionId);

    // ===== 出題済みチェック =====
    if (gameState.askedQuestionIds.includes(qid)) {
      gameState.phase = "idle";
      emitAdminState();
      console.log("[SERVER] startQuestion BLOCKED (出題済み問題)", qid);
      emitAdminError("この問題は出題済です！ 問題を再セットしてください！ (出題済み問題一覧)→", gameState.askedQuestionIds);
      return;
    }

    // ===== 出題済みとして登録 =====
    gameState.askedQuestionIds.push(qid);
    emitAdminState();
  
   

    // 問題取得
    loadQuestions(); 
    const question = questionBank[qid];

    if (!question) {
      console.log("[SERVER] question not found:", qid);
      emitAdminError("[SERVER] question not found:", qid);
      return;
    }

    gameState.currentQuestion = question;
    
    const questionTimeSec = question.timeLimitSec ?? 10;
    const textChoiceCount = question.choices?.length ?? 4;

    gameState.correctAnswer = question?.correctIndex ?? 0;
    gameState.pointCorrect = question?.point?.correct ?? 1;
    gameState.pointWrong = question?.point?.wrong ?? 0;

    console.log(
      "[SERVER] startQuestion id→",qid,
      "time:", questionTimeSec,
      "choices:", textChoiceCount,
    );

    // クイズ情報を送信
    gameState.phase = "question";
    emitAdminState();
    gameState.startedAt = now;
    gameState.answerOpenAt = now + ANSWER_BUFFER_MS;
    gameState.answerCloseAt = now + ANSWER_BUFFER_MS + questionTimeSec * 1000;
    
    // 選択肢数データ（択数別のUI変更など）
    gameState.textChoiceCount = textChoiceCount;

    // ===== 前問データの完全リセット =====
    gameState.answersByClientId = {}; // ★ 解答（必須）
    gameState.answerCounts = {};       // ★ アンサーチェック
    // gameState.scoredQuestionId = null; // ★ 二重加算防止解除
     

    console.log("[SERVER] startQuestion", gameState.questionId);
    io.emit("questionStarted", {
      id: question.id,
      category: question.category,
      questionText: question.questionText,
      choices: question.choices,
      timeLimitSec: question.timeLimitSec
    });
    
    // 正解ナビ
    io.emit("admin:correctAnswerInfo", {
      correctAnswer: gameState.correctAnswer,
      choices: gameState.currentQuestion?.choices ?? [],
      questionId: gameState.questionId
    });

  });

  // 強制結果遷移
  socket.on("admin:forceResult", () => {
    gameState.phase = "result";
    emitAdminState();

    const resultAnswers = collectResultAnswers();

    console.log("[SERVER] force result", resultAnswers);

    io.emit("resultStarted", {
      questionId: gameState.questionId,
      answers: resultAnswers
    });
  });

  // ===============================
  // 解答取得関連
  // ===============================

  socket.on("client:answer", ({ clientId, answer, clientSendTime, rtt }) => {
    
    // 解答した瞬間の時間(サーバー基準)
    const serverNow = Date.now();

    // 解答無効処理
    // フェーズがquestion以外
    if (gameState.phase !== "question") return;
    // 解答有効時間前（フライング）
    if (serverNow < gameState.answerOpenAt) return;
    // 解答済み
    if (gameState.answersByClientId[clientId]) return;
  

    // 制限時間
    const limitMs = gameState.answerCloseAt - gameState.answerOpenAt;

    // RTTがない or 異常値ならフォールバック
    // 通信往復時間（概算ラグ指標）
    const MAX_RTT = 10000; // 10秒以上は異常
    const safeRtt = (rtt && rtt > 0 && rtt < MAX_RTT) ? rtt : null;

    // ① サーバー基準の解答タイム（絶対安全）
    const serverElapsed = serverNow - gameState.answerOpenAt;

    // ② RTT補正
    let correctedElapsed = serverElapsed;

    if (safeRtt) {
      correctedElapsed = Math.max(0, serverElapsed - (safeRtt * 0.4));
    }
    
    // ③ クライアント時刻からの解答タイム
    // 不正チェックが全部クリアすればこのタイムを採用
    let clientElapsed = null;
    if (Number.isFinite(clientSendTime)) {
      clientElapsed = clientSendTime - gameState.answerOpenAt;
    }

    // 未来押しを判定
    if (clientElapsed !== null) {
      
      const OFFSET_ALLOW = 2000;

      const maxAdvance = Math.max(
        800,
        safeRtt ? safeRtt * 4 : 800,
        OFFSET_ALLOW
      );

      // サーバーより「速すぎる」＝未来押しを判定（チート or 不正同期）
      if (clientElapsed < serverElapsed - maxAdvance) {
          console.warn("[FUTURE INPUT DETECTED]", {
            clientElapsed,
            serverElapsed,
            maxAdvance
          });
          clientElapsed = null;
      }
    }

    // RTT整合性チェック
    // サーバー基準解答タイムとクライアント基準解答タイムの差と
    // 通信ラグのRTTに整合性があるか
    if (clientElapsed !== null && safeRtt) {
      const delay = serverElapsed - clientElapsed;

      // サーバー基準解答タイムとクライアント基準解答タイムの差と
      // クライアント側解答→サーバー到達までの時間を比較
      // クライアント側解答→サーバー到達までの時間の2倍（最大0.3秒まで）
      // 概念的説明
      // クライアント基準2秒 サーバー基準4秒 誤差2秒
      // クライアント送信2秒 サーバー受信4秒 誤差2秒
      // それぞれの誤差に整合性があるかどうか？

      const DELAY_ALLOW = Math.max(2000, safeRtt * 4);

      if (delay > DELAY_ALLOW) {
        console.warn("[DELAY NOT EXPLAINED BY RTT]", {
          delay,
          safeRtt
        });
        clientElapsed = null;
      }

    }

    // 異常値チェック
    // 通信ラグを考慮しつつチート検知
    if (clientElapsed !== null) {
      if (
          clientElapsed < -1000 || // フライングしすぎ(開始前１秒以上)
          clientElapsed > limitMs + 1000  // 制限時間超えすぎ（時間後１秒以上）
        ) {
          console.warn("[CHEAT DETECTED] clientElapsed invalid:", clientElapsed);
          clientElapsed = null;
        }
    }

    // =========================
    // ▼ 判定ロジック
    // =========================
    const MAX_TRUST_RTT = 7000; 

    let finalElapsed = serverElapsed;
    let source = "SERVER_RAW";

    if (clientElapsed !== null) {

      const diff = Math.abs(clientElapsed - serverElapsed);

      // RTTによって判定の厳しさを変える
      const isHighLatency = safeRtt && safeRtt > 1500;
      const MAX_DIFF_CAP = 2000;

      let allowDiff;

      if (isHighLatency) {
        // 高遅延時は上限キャップを外す
        allowDiff = Math.max(500, safeRtt * 1.2);
      } else {
        const allowDiffRaw = Math.max(250, safeRtt ? safeRtt * 1.5 : 250);
        allowDiff = Math.min(MAX_DIFF_CAP, allowDiffRaw);
      }

      if (diff < allowDiff) {
        finalElapsed = clientElapsed;
        source = "CLIENT";

      } else if (safeRtt) {
        finalElapsed = correctedElapsed;
        source = "RTT_CORRECTED";
      }

    } else if (safeRtt && safeRtt < MAX_TRUST_RTT) {
      // client使えないがRTTは許容範囲
      finalElapsed = correctedElapsed;
      source = "RTT_CORRECTED";
    }

    // フライング防止
    if (finalElapsed < 0) finalElapsed = 0;

    // 最終防御
    // NaN / Infinity などの防止
    if (!Number.isFinite(finalElapsed)) {
      finalElapsed = serverElapsed;
      source = "FALLBACK_INVALID";
    }

    // サーバー受付（実際に有効な範囲）
    // 時間終了0.5秒程度だけ許す
    // （マイナス表示防止済・通称ブザービート→解答受付のブザービート的使い方)
    
    // サーバー側のブザービートは0.3秒まで許容
    // RTT値によって増減 （最大1秒）
    // / 判定用（締切）
    const ACCEPT_GRACE_MS = Math.min(1000,Math.max(300, safeRtt ? safeRtt * 0.5 : 300));
    // ↑可読性重視であえてMath.min~ で表記

    if (finalElapsed > limitMs + ACCEPT_GRACE_MS) return;

    // ▼ 保険（通信事故防止）
    if (serverNow > gameState.answerCloseAt + 2000) return;


    
    //解答タイム計算
    const elapsedSecRaw = finalElapsed / 1000;
    
    //制限時間10秒の問題で
    //10.01や10.00というタイムの場合 は 9.99扱い
    //サーバーとのラグなどで起きうる
    const maxDisplaySec = (limitMs - 1) / 1000;

    // 端数を小数点第2位まで切捨て
    let elapsedSecFixed = Math.min(
      Math.floor(elapsedSecRaw * 100) / 100,
      Math.floor(maxDisplaySec * 100) / 100,
    );

    // ここに最低解答タイム判定（0.00防止→最速は0.01）
    if (elapsedSecFixed < 0.01) {
      elapsedSecFixed = 0.01;
    }

    // ユーザーデータに反映
    gameState.answersByClientId[clientId] = {
      answer,
      answeredAt: serverNow,
      elapsedMs: finalElapsed,
      // elapsedSecRaw : 実測値（ログ・分析用）
      elapsedSecRaw,
      // elapsedSecFixed : 表示・順位判定用（最大値で丸め）
      elapsedSecFixed,
      time: elapsedSecFixed // ★ 追加（スコア計算用）
    };

    console.log("[ANSWER FIXED]", clientId, elapsedSecFixed);
    // 解答を管理者側でのみアップデート
    io.to("admin").emit("admin:answerUpdated");



    // ▼ デバッグログ
    console.log("==== ANSWER DEBUG ====");
    console.log("[INPUT]", { clientSendTime, rtt });

    console.log("[SERVER]", {
      serverNow,
      serverElapsed
    });

    console.log("[RTT]", {
      safeRtt,
      correctedElapsed
    });

    console.log("[CLIENT]", {
      clientElapsed
    });


    console.log("[FINAL]", {
      finalElapsed,
      source,
      serverElapsed,
      clientElapsed,
      correctedElapsed
    });

    console.log("======================");

    console.log("[ANSWER FIXED]", clientId, elapsedSecFixed);

    // 解答者した人のみに
    // 解答 解答タイムを answerAccepted という名前で送信
    // クライアント側ではボタンロックや選択ボタンのデータとして反映
    io.to(clientId).emit("answerAccepted", {
      clientId, //現状不要と思われるが、リロードでの再描写などで使う可能性を検討してから削除 
      answer,
      elapsedSecFixed
    });
  });


  // ===============================
  // アンサーチェック表示（管理者トリガー）
  // ===============================
  socket.on("admin:answerCheck", () => {
    // 自動集計完了後のみ許可
    if (gameState.phase !== "answer_check_ready") {
      console.log("[ANSWER CHECK] ignored:", gameState.phase);
      emitAdminError("[ANSWER CHECK] ignored:", gameState.phase);
      return;
    }

    // ===== フェーズ遷移 =====
    gameState.phase = "answer_check";
    emitAdminState();

    console.log("[ANSWER CHECK] show", gameState.answerCounts);
    console.log("[ANSWER CHECK] phase :", gameState.phase);

    io.emit("answerCheckStarted", {
      answerCounts: gameState.answerCounts,
      textChoiceCount: gameState.textChoiceCount
    });
  });

  // ===============================
  // 正解発表（＋スコア確定）
  // ===============================
  socket.on("admin:showResult", () => {
    if (gameState.phase !== "answer_check") return;

    const qid = gameState.questionId;

    // ★ ① 確定保存（ここで1回だけ）
    // 解答データ保存
    finalizeQuestionResult(qid);
    // スコア計算
    recomputeScoresFromQuestionResults();

    // ★ フェーズ遷移
    gameState.phase = "result";
    emitAdminState();

    // 正解発表の演出
    io.emit("resultStarted", { correct: gameState.correctAnswer + 1 });

    // 累積スコアの反映
    io.emit("scoresUpdated", { scores: gameState.scores});

    // ランプ演出（結果だけ送る）
    const answers = gameState.questionResults[qid].answers;

    for (const clientId in answers) {

      const serverResult = answers[clientId].result;

      let displayResult = serverResult;

      // eventモード + 正解ポイントなし → 結果発表
      if (gameState.pointCorrect === 0) {
        displayResult = "event";
      }

      io.to(clientId).emit("quizResultLamp", {
        result: displayResult
      });
    }
    
  });

  // ===============================
  // ランキング反映
  // ===============================
  // 総合成績
  socket.on("admin:showTotalRanking", () => {

  const totalData = gameState.scores || {};

  const totalRanking = Object.entries(totalData)
      .map(([clientId, data]) => ({
        clientId,
        name: gameState.playerNames[clientId] || "未登録",
        correctCount: data.correctCount ?? 0,
        totalTime: data.totalTime ?? 0
      }))
      .sort((a, b) => {
        if (b.correctCount !== a.correctCount) {
          return b.correctCount - a.correctCount;
        }
        return a.totalTime - b.totalTime;
      });

      // 競技順位付与（1224方式）
      let currentRank = 0;
      let previous = null;

      const ranked = totalRanking.map((player, index) => {

        if (
          !previous ||
          player.correctCount !== previous.correctCount ||
          player.totalTime !== previous.totalTime
        ) {
          currentRank = index + 1;
        }

        previous = player;

        return {
          ...player,
          rank: currentRank
        };
      });

    io.emit("ranking:total", { ranking: ranked });
  });

  // 早押しベスト４（境界同率拡張方式）
  socket.on("admin:showCorrectBest", () => {

    if (gameState.phase !== "result") return;

    const BASE = 4; // 本番は 4

    const qid = gameState.questionId;
    const questionData = gameState.questionResults?.[qid];
    if (!questionData) return;

    // ① 昇順ソート（速い順）
    const sorted = Object.entries(questionData.answers)
      .filter(([_, ans]) => ans.result === "correct" && ans.time != null)
      .map(([clientId, ans]) => ({
        name: gameState.playerNames[clientId] || "未登録",
        time: ans.time
      }))
      .sort((a, b) => a.time - b.time);

    if (sorted.length === 0) return;

    // ② 競技順位付与（1224方式）
    let currentRank = 0;
    let previousTime = null;

    const ranked = sorted.map((player, index) => {

      if (previousTime === null || player.time !== previousTime) {
        currentRank = index + 1;
      }

      previousTime = player.time;

      return { ...player, rank: currentRank };
    });

    // ③ 先頭BASE人取得
    const baseSlice = ranked.slice(0, BASE);

    const boundaryTime = baseSlice[baseSlice.length - 1].time;

    // ④ 境界タイム以下を全取得（拡張）
    const result = ranked.filter(p => p.time <= boundaryTime);

    console.log("[RANKING] correct best", result);

    io.emit("ranking:correctBest", { ranking: result });
  });

  
  // 早押しワースト４ (境界同率拡張方式）
  socket.on("admin:showCorrectWorst", () => {

    if (gameState.phase !== "result") return;

    const BASE = 4; // 本番は4に変更

    const qid = gameState.questionId;
    const questionData = gameState.questionResults?.[qid];
    if (!questionData) return;

    // ① 昇順ソート
    const sorted = Object.entries(questionData.answers)
      .filter(([_, ans]) => ans.result === "correct" && ans.time != null)
      .map(([clientId, ans]) => ({
        name: gameState.playerNames[clientId] || "未登録",
        time: ans.time
      }))
      .sort((a, b) => a.time - b.time);

    if (sorted.length === 0) return;

    // ② 競技順位付与（1224方式）
    let currentRank = 0;
    let previousTime = null;

    const ranked = sorted.map((player, index) => {

      if (previousTime === null || player.time !== previousTime) {
        currentRank = index + 1;
      }

      previousTime = player.time;

      return { ...player, rank: currentRank };
    });

    // ③ ワースト BASE 人取得
    const baseSlice = ranked.slice(-BASE);
    const boundaryTime = baseSlice[0].time;

    // ④ 境界タイム以上を全取得（拡張）
    const result = ranked.filter(p => p.time >= boundaryTime);

    console.log("[RANKING] correct worst", result);

    io.emit("ranking:correctWorst", { ranking: result });
    emitAdminState();
  });

  
  // ハイブリッドルール（早押しワースト４＋最下位没収）
  socket.on("admin:hybridCorrectWorst", () => {

    if (gameState.phase !== "result") return;
    
    const BASE = 4; // 本番は4

    const qid = gameState.questionId;
    const questionData = gameState.questionResults?.[qid];
    if (!questionData) return;


    // ① 正解者抽出（seizure含める：表示維持のため）
    const sorted = Object.entries(questionData.answers)
      .filter(([_, ans]) =>
        (ans.result === "correct" || ans.result === "seizure")
        && ans.time != null
      )
      .map(([clientId, ans]) => ({
        clientId,
        name: gameState.playerNames[clientId] || "未登録",
        time: ans.time
      }))
      .sort((a, b) => a.time - b.time);
    
    // 正解者1人以下時は未実行
    if (sorted.length <= 1) {
      emitAdminError("正解者１人以下のため未実行 正解者→", sorted.length);
      return
    };

    // ② 1224順位付与
    let currentRank = 0;
    let previousTime = null;

    const ranked = sorted.map((player, index) => {

      if (previousTime === null || player.time !== previousTime) {
        currentRank = index + 1;
      }

      previousTime = player.time;

      return { ...player, rank: currentRank };
    });


    // ③ 表示ブロック（既存ワースト4方式）
    const baseSlice = ranked.slice(-BASE);
    const boundaryTime = baseSlice[0]?.time;

    const displayTargets = ranked.filter(p => p.time >= boundaryTime);

    console.log("[HYBRID] 表示対象:", displayTargets);


    // ④ 没収ブロック（表示結果から最下位取得）
    const maxRank = Math.max(...ranked.map(p => p.rank));

    const seizureTargets = ranked.filter(p => p.rank === maxRank);

    console.log("[HYBRID] 没収対象:", seizureTargets);

    seizureTargets.forEach(player => {

      const ans = questionData.answers[player.clientId];
      if (!ans) return;

      // 二重適用防止
      if (ans.result === "seizure") return;

      ans.result = "seizure";   // timeは消さない
    });


    // ⑤ 得点再計算
    recomputeScoresFromQuestionResults();

    io.emit("scoresUpdated", {
      scores: gameState.scores
    });


    // ⑥ ランプ処理
    const answers = gameState.questionResults[qid].answers;

    for (const clientId in answers) {

      const serverResult = answers[clientId].result;

      let displayResult = serverResult;

      // eventモード + 正解ポイントなし → 結果発表
      if (gameState.pointCorrect === 0) {
        displayResult = "event";
      }

      io.to(clientId).emit("quizResultLamp", {
        result: displayResult
      });
    }


    // ⑦ ランキング表示（変更なし）
    io.emit("ranking:hybridWorst", { result: displayTargets });
    emitAdminState();
  });

  // 表示終了
  socket.on("admin:noneRanking", () => {
    console.log("[RANKING] cleared");
    io.emit("ranking:none");
    emitAdminState();
  });

  

  // ===============================
  // イレギュラー対応系
  // ===============================
  
  // 問題の取り消し
  socket.on("admin:deleteQuestion", ({ qid }) => {
    console.log("[ADMIN] deleteQuestion:", qid);

    // 存在チェック
    if (!gameState.questionResults[qid]) {
      console.log("[DELETE] question not found:", qid);
      emitAdminError("[DELETE] question not found:", qid);
      return;
    }

    // ===== ① 問題データ削除 =====
    delete gameState.questionResults[qid];

    // ② 出題済み履歴からも削除
    gameState.askedQuestionIds =
      gameState.askedQuestionIds.filter(id => id !== qid);

    console.log("[DELETE] questionResults removed:", qid);
    emitAdminError("[DELETE] questionResults removed:", qid);

    gameState.phase = "idle";
    gameState.questionId = null;
    emitAdminState();

    // ===== ② スコア再計算 =====
    recomputeScoresFromQuestionResults();

    // ===== ③ 全クライアントへ反映 =====
    io.emit("scoresUpdated", {
      scores: gameState.scores
    });

    // ポイント更新のメッセージ表示
    io.emit("pointUpdateInfo");
    console.log("[DELETE] scores recalculated and broadcasted");
    emitAdminError("[DELETE] scores recalculated and broadcasted");
    emitAdminState();
  });

  // リロードをトリガーにサーバーから取得するもの
  // どんな状況のリロードでも必ず反映されるタイプのものを入れること
  socket.on("client:reload", () => {
    
    // スコア再計算
    // recomputeScoresFromQuestionResults();

    // =====  全クライアントへ反映 =====
    // 本当は全員にやる必要はないが
    // 可読性＆スコアがリアルタイムで損はしないためこのまま
    io.emit("scoresUpdated", {
      scores: gameState.scores
    });

    console.log("[RELOAD] score update");
  });

  // フェーズの強制変更
  socket.on("admin:phase_reset", () => {

    console.log("[ADMIN] FORCE PHASE RESET");


    // 状態初期化
    gameState.phase = "idle";
    gameState.questionId = null;
    gameState.answerOpenAt = null;
    gameState.answerCloseAt = null;

    io.emit("phaseReset");
    emitAdminState();
  });

  // 正解変更ボタン
  socket.on("admin:setCorrectAnswer", ({ qid, answer }) => {
    // アンサーチェックorリザルトのみ可能
    if (!["answer_check", "result"].includes(gameState.phase)) {
      console.log("[BLOCK] setCorrectAnswer invalid phase:", gameState.phase);
      return;
    }
    
    // 過去の問題の正解変更は理屈上可能だがブロック
    //（実装が超高コストでイレギュラー寄り機能）
    if (gameState.questionId !== qid) {
      console.log("[ERROR] not current question");
      return;
    }


    console.log("[ADMIN] setCorrectAnswer", qid, answer);
    

    // 管理者側で 0 を設定 = 正解なし
    if (answer === 0) {
      // server.js上での正解無し扱いである -1 に変更
      gameState.correctAnswer = -1;
    } else {
      gameState.correctAnswer = answer - 1;
    }

    console.log("[ADMIN] correctAnswer updated:", gameState.correctAnswer);
    
    // 正解ナビ
    io.emit("admin:correctAnswerInfo", {
      correctAnswer: gameState.correctAnswer,
      choices: gameState.currentQuestion?.choices ?? [],
      questionId: gameState.questionId
    });

    // 一度削除
    delete gameState.questionResults[qid];
    // 正誤判定を再度行う
    finalizeQuestionResult(qid);
    // スコアの再計算
    recomputeScoresFromQuestionResults();

    // ★ フェーズ遷移
    // 正解の再発表などのため
    gameState.phase = "answer_check";
    emitAdminState();

    // 正解発表時に反映のためコメント化デバッグ的に使うことあり
    // io.emit("score_update", gameState.scores);

  });

//聖域 
});



// 締め切り処理
// 問題時間終了７秒までは通信ラグ的受付時間として有効
// クライアント側でのタイムオーバーはタイムオーバー待機中のような状態として
// 正式なタイムオーバー処理は、問題時間終了７秒後に行う
const COLLECT_GRACE_MS = 7000;

setInterval(() => {
  if (gameState.phase !== "question") return;

  // 問題時間終了７秒までは通信ラグ的受付時間として有効
  const deadline = gameState.answerCloseAt + COLLECT_GRACE_MS;
  if (Date.now() < deadline) return;

  console.log("[AUTO] Time up detected");

  // 二重防止
  if (gameState.phase !== "question") return;

  // 未回答補完
  for (const clientId in gameState.playerNames) {
    if (gameState.answersByClientId[clientId]) continue;

    gameState.answersByClientId[clientId] = {
      answer: "over", 
      answeredAt: null,
      elapsedMs: null,
      elapsedSecRaw: null, 
      elapsedSecFixed: null, 
      time: null, 
      result: "over" 
    };
  }

  // 解答数カウント（アンサーチェック用）
  const counts = {};
  for (const clientId in gameState.answersByClientId) {
    const key = gameState.answersByClientId[clientId].answer ?? "over";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  // 解答データ取得
  const qid = gameState.questionId;
  if (qid == null) return;

  // 既に作成済みなら何もしない（二重作成防止）
  if (!gameState.questionResults[qid]) {

    const question = questionBank[qid];
    const correct = question.correctIndex;

    const tempAnswers = {};

    for (const clientId in gameState.answersByClientId) {
      const src = gameState.answersByClientId[clientId];

      let result;
      if (src.answer === "over") result = "over";
      else if (src.answer === correct) result = "correct";
      else result = "wrong";

      tempAnswers[clientId] = {
        answer: src.answer,
        time: src.time,
        result
      };
    }

    gameState.questionResults[qid] = {
    correctAnswer: correct,
    
    pointCorrect: question.pointCorrect ?? 1,
    pointWrong: question.pointWrong ?? 0,
    isEvent: question.isEvent ?? false,

    answers: tempAnswers
    };
  }

  // アンサーチェック用のデータまとめ
  gameState.answerCounts = counts;
  // フェーズ移行処理
  gameState.phase = "answer_check_ready";

  emitAdminState();

}, 300);



  


// テスト用
// server.listen(3000, () => {
//    console.log("Server running on http://localhost:3000");
// });


// 本番用（サーバー公開用）
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



// 本番用(ローカル使用)

// server.listen(3000, '0.0.0.0', () => {
//   console.log("Server running on 0.0.0.0 3000");
// });

// 使用方法
// ①使用時のコマンド（Windows）
// node server.js
// 以下のログが出ればOK
// Server running on 0.0.0.0 3000 

// ②ipconfigで調べる 
// 例IPv4 アドレス . . . . . . . . . . . .: 192.168.??.?

// ③アドレス案内
// ②で調べたもののうち
// 参加者に
// Wireless LAN adapter Wi-Fi:
// IPv4 アドレス . . . . . . . . . . . .: 192.168.??.? 
// http://192.168.??.?:3000/index.html のようなアドレスを案内


