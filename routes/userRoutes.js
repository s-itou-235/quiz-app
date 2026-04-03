const express = require("express");

module.exports = io => {
  const router = express.Router();
  const gameState = require("../gameState");

  router.post("/answer", (req, res) => {
    if (gameState.phase !== "answering") {
      return res.status(400).json({ error: "not answering" });
    }

    const elapsed =
      (Date.now() - gameState.questionStartTime) / 1000;

    const answer = {
      name: req.body.name,
      choice: req.body.choice,
      time: elapsed
    };

    gameState.answers.push(answer);
    

    console.log("[ANSWER]", answer);

    io.emit("stateChanged");
    res.json({ ok: true });
  });

  return router;
};


