// server.js
/**
 * @file server.js
 * @description Lógica del servidor para el juego de cartas multijugador usando Node.js y Socket.IO.
 * @author Diego Santiago Cobo Agreda
 * @copyright © 2024 Fulgor. Todos los derechos reservados.
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Permite conexiones desde cualquier origen. En producción, especifica tu dominio.
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname)); // Sirve tus archivos estáticos (HTML, CSS, JS del juego)

// --- Game State (Ahora en el servidor) ---
// Almacena info de los jugadores conectados: { socketId: { name: "", avatarUrl: "", hand: [], faceUp: [], faceDown: [], readyForPlay: false } }
let players = {}; 
let gameActive = false;
let deck = [];
let discardPile = [];
let currentPlayerTurnId = null; // ID del socket del jugador actual
let currentTurnIndex = 0; // Índice para recorrer los turnos de los jugadores

// --- NUEVO: Almacenamiento del Ranking ---
// Este es un ranking simple en memoria. Para persistencia real, usarías una base de datos.
let playerRankings = {}; // { playerName: score }
const WIN_POINTS = 1; // Puntos por ganar
// --- FIN NUEVO ---

const DEFAULT_AVATAR_URL = 'https://via.placeholder.com/50?text=Jugador'; // URL de un avatar por defecto

// --- Card Class (Mantenemos la clase Card en el servidor para gestionar las cartas) ---
class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.value = this.getCardValue();
        this.id = `${suit}-${rank}`; // Unique ID for DOM manipulation
    }

    getSuitSymbol() {
        switch (this.suit) {
            case 'hearts': return '♥';
            case 'diamonds': return '♦';
            case 'clubs': return '♣';
            case 'spades': return '♠';
            default: return '';
        }
    }

    getCardValue() {
        if (this.rank === 'A') return 14;
        if (this.rank === 'K') return 13;
        if (this.rank === 'Q') return 12;
        if (this.rank === 'J') return 11;
        if (this.rank === '2') return 15; // Dos es la carta más alta
        if (this.rank === '10') return 16; // Diez quema la pila
        return parseInt(this.rank);
    }
}

// --- Game Functions (Ahora ejecutadas en el servidor) ---

function createDeck(numPlayers) {
    console.log(`[SERVER] Creating deck(s) for ${numPlayers} players...`);
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let newDeck = [];
    
    // Ajuste: usar 1 mazo por cada 2 jugadores, mínimo 1
    const numberOfDecks = Math.max(1, Math.ceil(numPlayers / 2)); 

    console.log(`[SERVER] Using ${numberOfDecks} deck(s) for ${numPlayers} players.`);

    for (let i = 0; i < numberOfDecks; i++) {
        for (const suit of suits) {
            for (const rank of ranks) {
                newDeck.push(new Card(suit, rank));
            }
        }
    }
    console.log(`[SERVER] Deck created with ${newDeck.length} cards.`);
    return newDeck;
}

function shuffleDeck(array) {
    console.log('[SERVER] Shuffling deck...');
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    console.log('[SERVER] Deck shuffled.');
}

function dealInitialCards() {
    console.log('[SERVER] Dealing initial cards to players...');
    const playerIds = Object.keys(players);
    // 3 face-down, 3 face-up, 3 hand = 9 cards per player
    if (deck.length < playerIds.length * 9) { 
        console.error("[SERVER] Not enough cards in deck to deal to all players!");
        io.emit('message', 'Error: No hay suficientes cartas para iniciar el juego con todos los jugadores.', 'error');
        gameActive = false; // El juego no se puede iniciar
        return;
    }

    playerIds.forEach(id => {
        players[id].hand = [];
        players[id].faceUp = [];
        players[id].faceDown = [];
        players[id].readyForPlay = false; // Reinicia el estado de listo al repartir

        for (let i = 0; i < 3; i++) {
            players[id].faceDown.push(deck.pop());
        }
        for (let i = 0; i < 3; i++) {
            players[id].faceUp.push(deck.pop());
        }
        for (let i = 0; i < 3; i++) {
            players[id].hand.push(deck.pop());
        }
        console.log(`[SERVER] Player ${players[id].name} (${id.substring(0,4)}) dealt: Hand(${players[id].hand.length}) FU(${players[id].faceUp.length}) FD(${players[id].faceDown.length})`);
    });
    console.log('[SERVER] All players dealt initial cards.');
}

// Roba cartas del mazo hasta que el jugador tenga 3 en mano (o el mazo se vacíe)
function drawCards(player) {
    while (player.hand.length < 3 && deck.length > 0) {
        player.hand.push(deck.pop());
    }
}

// Envía el estado del juego a todos los clientes (o a clientes específicos)
function sendGameStateToAllClients() {
    //console.log('[SERVER] Sending game state to all connected clients...');
    const playerIds = Object.keys(players);
    const publicPlayerStates = {};

    // Preparar estado público de los oponentes
    playerIds.forEach(id => {
        publicPlayerStates[id] = {
            name: players[id].name,
            avatarUrl: players[id].avatarUrl, // Incluir el avatar del jugador
            handCount: players[id].hand.length,
            faceUp: players[id].faceUp, 
            faceDownCount: players[id].faceDown.length 
        };
    });

    Object.keys(players).forEach(socketId => {
        const player = players[socketId];
        io.to(socketId).emit('currentGameState', {
            playerName: player.name, 
            playerAvatarUrl: player.avatarUrl, // Enviar también el avatar del jugador a sí mismo
            playerHand: player.hand,
            playerFaceUp: player.faceUp,
            playerFaceDown: player.faceDown, 
            deckCount: deck.length,
            discardTopCard: discardPile.length > 0 ? discardPile[discardPile.length - 1] : null,
            discardCount: discardPile.length,
            currentPlayerTurnId: currentPlayerTurnId,
            gameActive: gameActive,
            setupPhase: !gameActive && playerIds.length >= 2 && !playerIds.every(id => players[id].readyForPlay),
            publicPlayerStates: publicPlayerStates,
            ranking: getSortedRanking() // Incluir el ranking en cada actualización
        });
    });
    io.emit('publicGameState', {
        numPlayers: playerIds.length,
        deckCount: deck.length,
        discardTopCard: discardPile.length > 0 ? discardPile[discardPile.length - 1] : null,
        discardCount: discardPile.length,
        currentPlayerTurnId: currentPlayerTurnId,
        gameActive: gameActive,
        publicPlayerStates: publicPlayerStates,
        ranking: getSortedRanking() // Incluir el ranking en la actualización pública
    });
}

function startGame() {
    console.log('[SERVER] Attempting to start game...');
    const playerIds = Object.keys(players);
    const numPlayers = playerIds.length;

    if (numPlayers < 2) {
        io.emit('message', 'Se necesitan al menos 2 jugadores para iniciar el juego.', 'warning');
        return;
    }
    if (!gameActive && !playerIds.every(id => players[id].readyForPlay)) {
        io.emit('message', 'Esperando a que todos los jugadores terminen de preparar sus cartas.', 'info');
        sendGameStateToAllClients(); 
        return;
    }
    if (gameActive) {
        io.emit('message', 'El juego ya está activo.', 'warning');
        return;
    }

    gameActive = true; 
    deck = createDeck(numPlayers);
    shuffleDeck(deck);
    discardPile = []; 

    dealInitialCards();
    if (!gameActive) { 
        return; 
    }

    if (playerIds.length > 0) {
        currentPlayerTurnId = playerIds[Math.floor(Math.random() * playerIds.length)];
        currentTurnIndex = playerIds.indexOf(currentPlayerTurnId);
        io.emit('message', `¡El juego ha comenzado con ${numPlayers} jugadores!`, 'success');
        io.emit('message', `Es el turno de ${players[currentPlayerTurnId].name}.`, 'info');
    } else {
        gameActive = false;
        io.emit('message', 'No hay jugadores conectados para iniciar el juego.', 'error');
    }
    
    sendGameStateToAllClients();
    console.log('[SERVER] Game started and initial state sent.');
}

function handlePlayerSwap(socketId, handCardId, faceUpCardId, faceDownCardId) {
    const player = players[socketId];
    if (!player || gameActive) {
        io.to(socketId).emit('message', 'No puedes intercambiar cartas ahora.', 'error');
        return;
    }

    let cardInHand = player.hand.find(c => c.id === handCardId);
    let cardInFaceUp = player.faceUp.find(c => c.id === faceUpCardId);
    let cardInFaceDown = player.faceDown.find(c => c.id === faceDownCardId);

    let selectedCards = [];
    if (cardInHand) selectedCards.push({ card: cardInHand, array: player.hand, id: handCardId });
    if (cardInFaceUp) selectedCards.push({ card: cardInFaceUp, array: player.faceUp, id: faceUpCardId });
    if (cardInFaceDown) selectedCards.push({ card: cardInFaceDown, array: player.faceDown, id: faceDownCardId });
    
    if (selectedCards.length === 2 && selectedCards[0].card.id === selectedCards[1].card.id) {
         io.to(socket.id).emit('message', 'No puedes seleccionar la misma carta dos veces para el intercambio.', 'error');
         return;
    }

    if (selectedCards.length !== 2) {
        io.to(socket.id).emit('message', 'Debes seleccionar exactamente dos cartas para intercambiar, cada una de un área diferente (mano, boca arriba, o boca abajo).', 'error');
        return;
    }

    const card1 = selectedCards[0].card;
    const array1 = selectedCards[0].array;
    const idx1 = array1.findIndex(c => c.id === card1.id);

    const card2 = selectedCards[1].card;
    const array2 = selectedCards[1].array;
    const idx2 = array2.findIndex(c => c.id === card2.id);

    if (idx1 !== -1 && idx2 !== -1) {
        array1[idx1] = card2;
        array2[idx2] = card1;
        player.readyForPlay = true; 
        io.emit('message', `Jugador ${player.name} ha terminado de preparar sus cartas.`, 'info');
        io.to(socket.id).emit('swapSuccessful');
        sendGameStateToAllClients(); 
        startGame(); 
    } else {
        io.to(socket.id).emit('message', 'Error al procesar el intercambio de cartas: cartas no encontradas o selección inválida.', 'error');
    }
}

function advanceTurn() {
    const playerIds = Object.keys(players);
    if (playerIds.length === 0) {
        currentPlayerTurnId = null;
        currentTurnIndex = 0;
        return;
    }
    currentTurnIndex = (currentTurnIndex + 1) % playerIds.length;
    currentPlayerTurnId = playerIds[currentTurnIndex];
    io.emit('message', `Es el turno de ${players[currentPlayerTurnId].name}.`, 'info');
    sendGameStateToAllClients();
}

// --- NUEVO: Funciones de Ranking ---
function updateRanking(winnerName) {
    if (playerRankings[winnerName]) {
        playerRankings[winnerName] += WIN_POINTS;
    } else {
        playerRankings[winnerName] = WIN_POINTS;
    }
    console.log(`[RANKING] ${winnerName} ha ganado y tiene ${playerRankings[winnerName]} puntos.`);
}

function getSortedRanking() {
    // Convierte el objeto de ranking a un array, lo ordena y lo devuelve
    return Object.entries(playerRankings)
        .sort(([, scoreA], [, scoreB]) => scoreB - scoreA) // Ordena de mayor a menor puntuación
        .map(([name, score]) => ({ name, score }));
}
// --- FIN NUEVO ---


// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
    console.log(`[SERVER] ¡Un usuario se ha conectado! ID: ${socket.id}`);
    
    // Añade el nuevo jugador a la lista con un nombre temporal y avatar por defecto
    players[socket.id] = {
        hand: [],
        faceUp: [],
        faceDown: [],
        isConnected: true,
        name: `Jugador ${socket.id.substring(0,4)}`, 
        avatarUrl: DEFAULT_AVATAR_URL, // Avatar por defecto
        readyForPlay: false 
    };

    io.emit('message', `¡Un nuevo jugador (${players[socket.id].name}) se ha unido! Total: ${Object.keys(players).length} jugadores.`, 'info');
    sendGameStateToAllClients(); 

    // Evento para que el cliente envíe su nombre y avatar
    socket.on('setPlayerInfo', (data) => {
        if (players[socket.id]) {
            const oldName = players[socket.id].name;
            const newName = data.playerName.trim().substring(0, 15) || `Jugador ${socket.id.substring(0,4)}`;
            let newAvatarUrl = data.avatarUrl.trim();

            // Validación simple de la URL (puedes hacerla más robusta si es necesario)
            // Esto es solo para asegurar que la URL tiene un formato básico de imagen.
            // En un entorno de producción, considera un servicio de carga de imágenes o validaciones más estrictas.
            const urlPattern = /^https?:\/\/.+\.(png|jpg|jpeg|gif|svg|webp)(\?.+)?$/i; // Añadido webp
            if (!urlPattern.test(newAvatarUrl)) {
                console.warn(`[SERVER] Invalid or empty avatar URL provided by ${newName}: ${newAvatarUrl}. Using default.`);
                newAvatarUrl = DEFAULT_AVATAR_URL;
            } else if (!newAvatarUrl) {
                 // Si la URL es una cadena vacía, usar el avatar por defecto
                newAvatarUrl = DEFAULT_AVATAR_URL;
            }

            players[socket.id].name = newName;
            players[socket.id].avatarUrl = newAvatarUrl;
            
            // Si el jugador no estaba en el ranking, inicialízalo con 0 puntos
            if (!playerRankings[newName]) {
                playerRankings[newName] = 0;
            }

            io.emit('message', `${oldName} ahora se llama ${newName}.`, 'info');
            sendGameStateToAllClients(); 
        }
    });

    // Manejo de mensajes de chat
    socket.on('chatMessage', (message) => {
        if (players[socket.id]) {
            // Emitir el mensaje a todos los clientes, incluyendo el nombre del remitente
            io.emit('chatMessage', {
                senderId: socket.id,
                senderName: players[socket.id].name,
                text: message
            });
            console.log(`[CHAT] ${players[socket.id].name}: ${message}`);
        }
    });

    // --- Eventos que el cliente puede enviar ---

    socket.on('gameStartRequest', () => {
        console.log(`[SERVER] ${players[socket.id].name} (${socket.id.substring(0, 4)}) ha solicitado iniciar el juego.`);
        startGame(); 
    });

    socket.on('swapCardsRequest', (data) => {
        handlePlayerSwap(socket.id, data.handCardId, data.faceUpCardId, data.faceDownCardId);
    });

    socket.on('playCardRequest', (data) => {
        const player = players[socket.id];
        if (!player) {
            io.to(socket.id).emit('message', 'Error: Tu sesión de jugador no es válida.', 'error');
            return;
        }
        if (!gameActive || socket.id !== currentPlayerTurnId) {
            io.to(socket.id).emit('message', 'No es tu turno o el juego no está activo.', 'error');
            return;
        }

        const cardId = data.cardId;
        let cardToPlay = null;
        let cardSourceArray = null; 

        const handIndex = player.hand.findIndex(c => c.id === cardId);
        if (handIndex !== -1) {
            cardToPlay = player.hand[handIndex];
            cardSourceArray = player.hand;
        } else {
            const faceUpIndex = player.faceUp.findIndex(c => c.id === cardId);
            if (faceUpIndex !== -1) {
                cardToPlay = player.faceUp[faceUpIndex];
                cardSourceArray = player.faceUp;
            } else {
                if (player.hand.length === 0 && player.faceUp.length === 0) {
                    const faceDownIndex = player.faceDown.findIndex(c => c.id === cardId);
                    if (faceDownIndex !== -1) {
                        cardToPlay = player.faceDown[faceDownIndex];
                        cardSourceArray = player.faceDown;
                    }
                }
            }
        }

        if (!cardToPlay) {
            io.to(socket.id).emit('message', 'La carta que intentas jugar no se encontró en tus cartas disponibles (mano, boca arriba, o boca abajo si no te quedan más).', 'error');
            return;
        }
        
        if (player.hand.length > 0 && cardSourceArray !== player.hand) {
            io.to(socket.id).emit('message', 'Debes jugar las cartas de tu mano antes de usar las cartas boca arriba o boca abajo.', 'warning');
            return;
        }

        const discardTopCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

        let isValidPlay = false;
        if (!discardTopCard) {
            isValidPlay = true; 
        } else if (cardToPlay.value === 15) { 
            isValidPlay = true;
        } else if (cardToPlay.value === 16) { 
            isValidPlay = true;
        } else if (cardToPlay.value >= discardTopCard.value) {
            isValidPlay = true;
        }

        if (!isValidPlay) {
            io.to(socket.id).emit('message', `No puedes jugar un ${cardToPlay.rank} sobre un ${discardTopCard.rank}. Debes jugar una carta de valor igual o superior.`, 'warning');
            return;
        }

        cardSourceArray.splice(cardSourceArray.findIndex(c => c.id === cardToPlay.id), 1);
        discardPile.push(cardToPlay);
        io.emit('message', `${players[socket.id].name} jugó un ${cardToPlay.rank} de ${cardToPlay.getSuitSymbol()}.`, 'info');
        console.log(`[SERVER] Player ${players[socket.id].name} played ${cardToPlay.id}. Discard Pile: ${discardPile.length}`);

        if (cardToPlay.value === 16) { 
            discardPile = []; 
            io.emit('message', `${players[socket.id].name} jugó un 10 y quemó la pila de descarte!`, 'success');
        }

        if (cardSourceArray === player.hand) { 
            drawCards(player);
        } 
        
        // Comprobar si el jugador ha ganado
        if (player.hand.length === 0 && player.faceUp.length === 0 && player.faceDown.length === 0) {
            io.emit('message', `¡${players[socket.id].name} ha ganado el juego!`, 'success');
            // --- NUEVO: Actualizar ranking ---
            updateRanking(player.name);
            // --- FIN NUEVO ---
            gameActive = false;
            deck = [];
            discardPile = [];
            currentPlayerTurnId = null;
            currentTurnIndex = 0;
            Object.values(players).forEach(p => {
                p.hand = [];
                p.faceUp = [];
                p.faceDown = [];
                p.readyForPlay = false;
            });
        }
        
        if (gameActive) { // Solo avanza el turno si el juego sigue activo (nadie ha ganado)
            advanceTurn(); 
        }

        sendGameStateToAllClients(); 
    });

    socket.on('takePileRequest', () => {
        const player = players[socket.id];
        if (!player) {
            io.to(socket.id).emit('message', 'Error: Tu sesión de jugador no es válida.', 'error');
            return;
        }
        if (!gameActive || socket.id !== currentPlayerTurnId) {
            io.to(socket.id).emit('message', 'No es tu turno o el juego no está activo.', 'error');
            return;
        }
        if (discardPile.length === 0) {
            io.to(socket.id).emit('message', 'No hay cartas en el descarte para tomar.', 'warning');
            return;
        }

        player.hand = player.hand.concat(discardPile); 
        discardPile = []; 

        io.emit('message', `${players[socket.id].name} ha tomado el descarte.`, 'info');
        console.log(`[SERVER] Player
