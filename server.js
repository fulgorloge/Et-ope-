// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const port = process.env.PORT || 4000
const app = express();
const server = http.createServer(app);

// Configuración de CORS para Socket.IO
// *** ¡IMPORTANTE: REEMPLAZA "https://etiop.netlify.app" con la URL REAL de tu frontend en Netlify! ***
const io = socketIo(server, {
    cors: {
        origin: "https://etiop.netlify.app", // <--- ¡TU URL DE NETLIFY AQUÍ!
        methods: ["GET", "POST"]
    }
});

// Sirve los archivos estáticos de tu frontend desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Lógica mínima del juego (tu código de servidor principal irá aquí) ---
let players = {};
let playerRankings = {};

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    socket.on('setPlayerInfo', (data) => {
        players[socket.id] = { id: socket.id, name: data.playerName, avatarUrl: data.avatarUrl, hand: [], faceUp: [], faceDown: [], handCount: 0, faceDownCount: 0, readyForPlay: false };
        console.log(`Player ${data.playerName} (${socket.id}) joined.`);
        io.emit('message', `${data.playerName} se ha unido al juego.`);
        sendGameStateToAllClients();
    });

    socket.on('chatMessage', (message) => {
        const sender = players[socket.id];
        if (sender) {
            io.emit('chatMessage', { senderName: sender.name, text: message, senderId: socket.id });
        }
    });

    socket.on('swapCardsRequest', (data) => {
        console.log(`Swap request from ${socket.id}:`, data);
        if (players[socket.id]) {
            players[socket.id].readyForPlay = true;
        }
        sendGameStateToAllClients();
        io.emit('message', `${players[socket.id].name} está listo para el juego.`);
    });

    socket.on('gameStartRequest', () => {
        const allReady = Object.values(players).every(p => p.readyForPlay);
        if (Object.keys(players).length >= 2 && allReady) {
            io.emit('message', '¡El juego ha comenzado!', 'success');
            // Aquí iría tu lógica real de inicio de juego
            // Para el ejemplo, repartimos cartas dummy
            Object.values(players).forEach(p => {
                p.hand = [{suit: 'clubs', rank: '7'}, {suit: 'hearts', rank: 'A'}];
                p.handCount = p.hand.length;
                p.faceUp = [{suit: 'diamonds', rank: 'K'}];
            });
        } else {
            io.emit('message', 'Se necesitan al menos 2 jugadores y todos deben estar listos para iniciar.', 'warning');
        }
        sendGameStateToAllClients();
    });

    socket.on('playCardRequest', (data) => {
        console.log(`Player ${socket.id} wants to play card: ${data.cardId}`);
        io.emit('message', `${players[socket.id].name} jugó una carta.`);
        sendGameStateToAllClients();
    });

    socket.on('takePileRequest', () => {
        console.log(`Player ${socket.id} wants to take the pile.`);
        io.emit('message', `${players[socket.id].name} tomó el descarte.`);
        sendGameStateToAllClients();
    });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
        const disconnectedPlayer = players[socket.id];
        if (disconnectedPlayer) {
            io.emit('message', `${disconnectedPlayer.name} ha dejado el juego.`, 'error');
            delete players[socket.id];
        }
        sendGameStateToAllClients();
    });

    function sendGameStateToAllClients() {
        const publicPlayerStates = {};
        for (const id in players) {
            publicPlayerStates[id] = {
                name: players[id].name,
                avatarUrl: players[id].avatarUrl,
                handCount: players[id].hand.length,
                faceUp: players[id].faceUp,
                faceDownCount: players[id].faceDown.length,
                readyForPlay: players[id].readyForPlay
            };
        }

        const dummyDeckCount = 50;
        const dummyDiscardCount = 5;
        const dummyDiscardTopCard = { suit: 'hearts', rank: '7' };
        const dummyCurrentPlayerTurnId = Object.keys(players)[0] || null;
        const dummyGameActive = Object.keys(players).length > 1 && Object.values(players).every(p => p.readyForPlay);
        const dummySetupPhase = !Object.keys(players).length || !Object.values(players).every(p => p.readyForPlay);
        const dummyRanking = Object.entries(playerRankings).map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score);


        // Para cada cliente, se envía un 'gameState' general y un 'playerStateUpdate' con sus cartas privadas
        Object.keys(players).forEach(playerId => {
            io.to(playerId).emit('gameState', {
                players: publicPlayerStates,
                myPlayerId: playerId, // Importante para que el cliente sepa quién es
                discardTopCard: dummyDiscardTopCard,
                deckCount: dummyDeckCount,
                discardCount: dummyDiscardCount,
                currentPlayerTurnId: dummyCurrentPlayerTurnId,
                gameActive: dummyGameActive,
                setupPhase: dummySetupPhase,
                ranking: dummyRanking
            });

            // Enviar las cartas privadas del jugador actual solo a ese jugador
            io.to(playerId).emit('playerStateUpdate', {
                myHand: players[playerId].hand,
                myFaceUp: players[playerId].faceUp, // Solo las que realmente están boca arriba
                myFaceDown: players[playerId].faceDown
            });
        });
    }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000; // Heroku u otros servicios usarán process.env.PORT
server.listen(PORT, () => {
    console.log(`Servidor Socket.IO escuchando en el puerto ${PORT}`);
});
