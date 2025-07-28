// server.js
/**
 * @file server.js
 * @description Lógica del servidor para el juego de cartas multijugador usando Node.js y Socket.IO.
 * @author [Tu Nombre o Nombre de tu Compañía]
 * @copyright © 2024 [Tu Nombre o Nombre de tu Compañía]. Todos los derechos reservados.
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
let gameActive = false;
let players = {}; // Almacena info de los jugadores conectados: { socketId: { hand: [], faceUp: [], faceDown: [], readyForPlay: false } }
let deck = [];
let discardPile = [];
let currentPlayerTurnId = null; // ID del socket del jugador actual
let currentTurnIndex = 0; // Índice para recorrer los turnos de los jugadores

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
        console.log(`[SERVER] Player ${id.substring(0,4)} dealt: Hand(${players[id].hand.length}) FU(${players[id].faceUp.length}) FD(${players[id].faceDown.length})`);
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
            handCount: players[id].hand.length,
            faceUp: players[id].faceUp, // Las cartas boca arriba de los oponentes son públicas
            faceDownCount: players[id].faceDown.length // Solo el conteo para las cartas boca abajo de los oponentes
        };
    });

    Object.keys(players).forEach(socketId => {
        const player = players[socketId];
        // Envía el estado PARTICULAR del juego a cada cliente (su mano, sus cartas boca arriba, etc.)
        io.to(socketId).emit('currentGameState', {
            playerHand: player.hand,
            playerFaceUp: player.faceUp,
            playerFaceDown: player.faceDown, // Enviar las cartas reales al propio jugador para la fase de swap
            deckCount: deck.length,
            discardTopCard: discardPile.length > 0 ? discardPile[discardPile.length - 1] : null,
            discardCount: discardPile.length,
            currentPlayerTurnId: currentPlayerTurnId,
            gameActive: gameActive,
            // setupPhase es true si el juego no ha comenzado y hay al menos 2 jugadores y NO todos están listos
            setupPhase: !gameActive && playerIds.length >= 2 && !playerIds.every(id => players[id].readyForPlay),
            publicPlayerStates: publicPlayerStates // Enviar el estado de todos los jugadores (público)
        });
    });
    // Envía el estado PÚBLICO del juego a todos (lo que todos pueden ver, como el mazo, descarte, y cuántos jugadores hay)
    io.emit('publicGameState', {
        numPlayers: playerIds.length,
        deckCount: deck.length,
        discardTopCard: discardPile.length > 0 ? discardPile[discardPile.length - 1] : null,
        discardCount: discardPile.length,
        currentPlayerTurnId: currentPlayerTurnId,
        gameActive: gameActive
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
    // Si el juego no está activo, comprobamos si todos los jugadores están listos para empezar
    if (!gameActive && !playerIds.every(id => players[id].readyForPlay)) {
        io.emit('message', 'Esperando a que todos los jugadores terminen de preparar sus cartas.', 'info');
        sendGameStateToAllClients(); // Actualiza el estado para que los clientes sepan que no todos están listos
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
    if (!gameActive) { // Si dealInitialCards encontró un error (ej. pocas cartas) y puso gameActive a false
        return; // No se pudo iniciar, ya se emitió el mensaje.
    }

    // Decide el primer turno
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

    // Identifica qué dos cartas se seleccionaron para el intercambio
    let selectedCards = [];
    if (cardInHand) selectedCards.push({ card: cardInHand, array: player.hand, id: handCardId });
    if (cardInFaceUp) selectedCards.push({ card: cardInFaceUp, array: player.faceUp, id: faceUpCardId });
    if (cardInFaceDown) selectedCards.push({ card: cardInFaceDown, array: player.faceDown, id: faceDownCardId });
    
    // Asegura que no se seleccione la misma carta dos veces de áreas diferentes
    if (selectedCards.length === 2 && selectedCards[0].card.id === selectedCards[1].card.id) {
         io.to(socketId).emit('message', 'No puedes seleccionar la misma carta dos veces para el intercambio.', 'error');
         return;
    }

    if (selectedCards.length !== 2) {
        io.to(socketId).emit('message', 'Debes seleccionar exactamente dos cartas para intercambiar, cada una de un área diferente (mano, boca arriba, o boca abajo).', 'error');
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
        player.readyForPlay = true; // El jugador ha completado su swap
        io.emit('message', `Jugador ${player.name} ha terminado de preparar sus cartas.`, 'info');
        io.to(socketId).emit('swapSuccessful');
        sendGameStateToAllClients(); // Envia el estado actualizado a todos
        // Intenta iniciar el juego si todos están listos
        startGame(); 
    } else {
        io.to(socketId).emit('message', 'Error al procesar el intercambio de cartas: cartas no encontradas o selección inválida.', 'error');
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

// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
    console.log(`[SERVER] ¡Un usuario se ha conectado! ID: ${socket.id}`);
    
    // Añade el nuevo jugador a la lista
    players[socket.id] = {
        hand: [],
        faceUp: [],
        faceDown: [],
        isConnected: true,
        name: `Jugador ${socket.id.substring(0,4)}`, // Añade un nombre por defecto
        readyForPlay: false // Nuevo estado para la fase de setup
    };

    io.emit('message', `¡Un nuevo jugador (${players[socket.id].name}) se ha unido! Total: ${Object.keys(players).length} jugadores.`, 'info');
    sendGameStateToAllClients(); // Envía el estado actual a todos los que se conectan (incluido el nuevo)

    // --- Eventos que el cliente puede enviar ---

    socket.on('gameStartRequest', () => {
        console.log(`[SERVER] ${players[socket.id].name} (${socket.id.substring(0, 4)}) ha solicitado iniciar el juego.`);
        startGame(); // Intenta iniciar el juego
    });

    socket.on('swapCardsRequest', (data) => {
        handlePlayerSwap(socket.id, data.handCardId, data.faceUpCardId, data.faceDownCardId);
    });

    socket.on('playCardRequest', (data) => {
        const player = players[socket.id];
        if (!gameActive || socket.id !== currentPlayerTurnId) {
            io.to(socket.id).emit('message', 'No es tu turno o el juego no está activo.', 'error');
            return;
        }

        const cardId = data.cardId;
        let cardToPlay = null;
        let cardSourceArray = null; // Para saber si la carta viene de la mano o de boca arriba

        // 1. Encontrar la carta en la mano/faceUp del jugador.
        const handIndex = player.hand.findIndex(c => c.id === cardId);
        if (handIndex !== -1) {
            cardToPlay = player.hand[handIndex];
            cardSourceArray = player.hand;
        } else {
            // Si no está en mano, buscar en cartas boca arriba
            const faceUpIndex = player.faceUp.findIndex(c => c.id === cardId);
            if (faceUpIndex !== -1) {
                cardToPlay = player.faceUp[faceUpIndex];
                cardSourceArray = player.faceUp;
            } else {
                // Si la mano está vacía, buscar en cartas boca abajo (último recurso)
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
        
        // No permitir jugar de boca arriba o boca abajo si aún quedan cartas en la mano
        if (player.hand.length > 0 && cardSourceArray !== player.hand) {
            io.to(socket.id).emit('message', 'Debes jugar las cartas de tu mano antes de usar las cartas boca arriba o boca abajo.', 'warning');
            return;
        }

        const discardTopCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

        // 2. Validar si la carta se puede jugar sobre la discardTopCard.
        // REGLAS BÁSICAS (¡ADAPTAR A TU JUEGO!):
        // Puedes jugar si el descarte está vacío
        // O si la carta es de valor igual o superior a la carta superior del descarte.
        // O si la carta es un '2' (carta especial que se puede jugar sobre cualquier cosa).
        // O si la carta es un '10' (carta especial que quema la pila).
        let isValidPlay = false;
        if (!discardTopCard) {
            isValidPlay = true; // Descarte vacío, se puede jugar cualquier cosa
        } else if (cardToPlay.value === 15) { // '2' es carta especial, valor 15 (siempre se puede jugar)
            isValidPlay = true;
        } else if (cardToPlay.value === 16) { // '10' es carta especial, valor 16 (siempre se puede jugar y quema)
            isValidPlay = true;
        } else if (cardToPlay.value >= discardTopCard.value) {
            isValidPlay = true;
        }

        if (!isValidPlay) {
            io.to(socket.id).emit('message', `No puedes jugar un ${cardToPlay.rank} sobre un ${discardTopCard.rank}. Debes jugar una carta de valor igual o superior.`, 'warning');
            return;
        }

        // 3. Si es válida, mover la carta del jugador al discardPile.
        cardSourceArray.splice(cardSourceArray.findIndex(c => c.id === cardToPlay.id), 1);
        discardPile.push(cardToPlay);
        io.emit('message', `${player.name} jugó un ${cardToPlay.rank} de ${cardToPlay.getSuitSymbol()}.`, 'info');
        console.log(`[SERVER] Player ${player.name} played ${cardToPlay.id}. Discard Pile: ${discardPile.length}`);

        // 4. Implementar lógica de "quemar" (si aplica).
        if (cardToPlay.value === 16) { // Si la carta jugada es un '10' (valor 16), quema la pila
            discardPile = []; // Vacía el descarte
            io.emit('message', `${player.name} jugó un 10 y quemó la pila de descarte!`, 'success');
        }

        // 5. Robar cartas del deck si la mano del jugador tiene < 3 (solo si jugó de la mano o no tiene cartas boca arriba)
        // NOTA: Si el jugador jugó una carta de boca arriba o boca abajo, y tiene cartas en el mazo,
        // robará hasta tener 3 cartas en la mano ANTES de jugar de boca arriba/abajo.
        // Aquí la lógica es si la mano está vacía y jugó de boca arriba/abajo, no roba inmediatamente.
        // Se asume que solo roba para mantener la mano llena si jugó de la mano.
        if (cardSourceArray === player.hand) { // Solo roba si la carta fue de la mano
            drawCards(player);
        } else if (player.hand.length === 0 && deck.length > 0) {
            // Si el jugador no tiene cartas en mano, y jugó de faceUp, podría robar para llenar la mano
            // Esta es una regla a definir: ¿se rellena la mano después de jugar de FU?
            // Por ahora, asumimos que no se rellena si jugó de FU/FD, solo cuando se roba del mazo.
        }
        
        // TODO: Lógica de fin de juego (si un jugador se queda sin cartas)
        if (player.hand.length === 0 && player.faceUp.length === 0 && player.faceDown.length === 0) {
            io.emit('message', `¡${player.name} ha ganado el juego!`, 'success');
            gameActive = false;
            // Aquí puedes reiniciar el juego o mostrar una pantalla de victoria
            // Por simplicidad, solo desactivo el juego y reseteo el estado
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
        
        // 6. Luego llamar a advanceTurn();
        if (gameActive) { // Solo avanza el turno si el juego no ha terminado
            advanceTurn(); 
        }

        sendGameStateToAllClients(); // Actualiza estado después de la jugada
    });

    socket.on('takePileRequest', () => {
        const player = players[socket.id];
        if (!gameActive || socket.id !== currentPlayerTurnId) {
            io.to(socket.id).emit('message', 'No es tu turno o el juego no está activo.', 'error');
            return;
        }
        if (discardPile.length === 0) {
            io.to(socket.id).emit('message', 'No hay cartas en el descarte para tomar.', 'warning');
            return;
        }

        // Implementar lógica de tomar descarte
        player.hand = player.hand.concat(discardPile); // Añade todas las cartas del descarte a la mano del jugador
        discardPile = []; // Vacía el descarte

        io.emit('message', `${player.name} ha tomado el descarte.`, 'info');
        console.log(`[SERVER] Player ${player.name} took the discard pile. Hand: ${player.hand.length}`);
        
        advanceTurn(); // Pasa el turno
        sendGameStateToAllClients(); // Actualiza estado
    });

    // Cuando un cliente se desconecta
    socket.on('disconnect', () => {
        console.log(`[SERVER] Un usuario se ha descone
