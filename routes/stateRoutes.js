const express = require("express");
const router = express.Router();
const gameState = require("../gameState");

router.get("/", (req, res) => {

  res.json({
  // 現在のフェーズ
  phase: gameState.phase,
  // 出題番号
  questionId: gameState.questionId,
  
  // 選択肢数データ
  textChoiceCount: gameState.textChoiceCount,
  
  // 制限時間処理
  answerOpenAt: gameState.answerOpenAt,
  answerCloseAt: gameState.answerCloseAt,
  
  // 現在の問題に解答済みのidリスト
  // 解答未解答の処理など
  answeredClientIds: Object.keys(gameState.answersByClientId),
  
  // 参加者全員の解答データ
  answers: gameState.answersByClientId,
  
  // 出題中の問題の正解
  correctAnswer: gameState.correctAnswer,
  
  // 問題ごとの解答データ（詳細→gameState.js）
  questionResults: gameState.questionResults,

  // アンサーチェックのデータ
  answerCounts: gameState.answerCounts,
  });
  
});

module.exports = router;
