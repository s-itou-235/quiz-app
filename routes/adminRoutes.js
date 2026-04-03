const express = require("express");
const router = express.Router();
const gameState = require("../gameState");

// 出題準備
router.post("/standby", (req, res) => {
  const { questionId } = req.body;

  gameState.phase = "standby";
  gameState.questionId = questionId; // 文字列でOK（後段で数値化）
  gameState.startedAt = null;

  console.log("[ADMIN] standby", questionId);
  res.json(gameState);
});

// 出題開始
router.post("/start", (req, res) => {
  console.log("[ADMIN] start");

  gameState.phase = "question";
  gameState.startedAt = Date.now();

  // ★ 仮：制限時間 10 秒
  const LIMIT_MS = 10 * 1000;

  setTimeout(() => {
    if (gameState.phase === "question") {
      gameState.phase = "result";
      console.log("[SERVER] phase -> result");
    }
  }, LIMIT_MS);

  res.json({ ok: true });
});

module.exports = router;
