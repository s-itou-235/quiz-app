const gameState = {

  
  playerNames: {},

  // フェーズ制御
  phase: "idle",     // idle | standby | question | answer_check | result
  questionId: null,


  // ===== 出題制御 =====
  askedQuestionIds: [], // ★ 出題済みID
  textChoiceCount: 4, // 2 / 3 / 4
  answerOpenAt: null, //出題開始 
  answerCloseAt: null, //出題終了時刻
  startedAt: null, //役割を忘れたが変に消すより保持

  
  // ===== 解答管理（誰が何番を何秒で押した）=====
  // 元データと同じプロパティ名
  // 解答データを一時的に入れるもの
  answersByClientId: {
    // clientId: {
    // 　answer: Number, 
    // 　time: Number
    // }
  },

  // ===== アンサーチェック結果 =====
  answerCounts: {
    // choiceNumber: count
    // { 1: 3, 2: 5, 3: 1 } のような形
    //  { 選択肢1: 3人, 選択肢2: 5人, 選択肢3: 1人 } のような内容
  },  

  // ===== 正解情報 =====
  // 一応の仮置き
  correctAnswer: 2, // 仮（後で問題マスタ参照）


  // ===== 問題ごとの解答データ =====
  questionResults : {
    // 入るデータのイメージ

    // [qid]: {　→ 問題番号
    // correctAnswer: 2,　問題の正解
    // point: 1,　問題のポイント
    // answers: {
    //   clientId: {
    //     answer: 2 | "over",　→ clientIdの解答データ
    //     time: 3.61 | null,　→ clientIdのタイムデータ
    //     result: "correct" | "wrong" | "over"　→ clientIdの正解不正解データ
    //   }
    //  clientId2: {
    //     answer: 3 | "over",　→ clientId2の解答データ
    //     time: 3.61 | null,　→ clientId2のタイムデータ
    //     result: "correct" | "wrong" | "over"　→ clientId2の正解不正解データ
    //   }
    // }

     // [qid]: {　→問題番号その2
    // correctAnswer: 4,　問題の正解
    // point: 2,　問題のポイント
    // answers: {
    //   clientId: {
    //     answer: 4 | "over",　→ clientIdの解答データ
    //     time: 3.61 | null,　→ clientIdのタイムデータ
    //     result: "correct" | "wrong" | "over"　→ clientIdの正解不正解データ
    //   }
    //  clientId2: {
    //     answer: 1 | "over",　→ clientId2の解答データ
    //     time: 2.61 | null,　→ clientId2のタイムデータ
    //     result: "correct" | "wrong" | "over"　→ clientId2の正解不正解データ
    //   }
    // }
  },
  
  scores : {
     // clientId: {
    //   correctCount: Number, → 正解ポイント
    //   totalTime: Number, → 合計解答時間
    //   }
  },

  // ===== 二重加算防止 =====
  scoredQuestionId : null, // 二重加算防止

};

module.exports = gameState;

