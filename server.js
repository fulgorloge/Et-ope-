// server.js
// ... (código existente) ...

function endGame(winnerId) {
    if (!gameActive) return;

    gameActive = false;
    setupPhase = true; // Go back to setup phase for next game
    io.emit('message', `¡El jugador ${players[winnerId].name} ha ganado el juego!`, 'success');
    
    // Update ranking - ASEGÚRATE DE QUE ESTA PARTE ESTÉ ASÍ
    const winnerName = players[winnerId].name;
    if (playerRankings[winnerName]) {
        playerRankings[winnerName] += 1; // 1 point for winning
    } else {
        playerRankings[winnerName] = 1; // First win
    }
    
    sendGameStateToAllClients(); // Send final state and ranking
}

// ... (resto del código) ...
