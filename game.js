// public/game.js

// *** ¡IMPORTANTE: REEMPLAZA "https://nombre-de-tu-servicio.onrender.com" con la URL REAL de tu backend en Render! ***
const backendUrl = 'https://nombre-de-tu-servicio.onrender.com'; // <--- ¡TU URL DE RENDER AQUÍ!
var io = ““;
const socket = io(backendUrl);

// --- Elementos del DOM ---
const messagesDiv = document.getElementById('messages');
const playerNameInput = document.getElementById('player-name-input');
const avatarUrlInput = document.getElementById('avatar-url-input');
const joinGameButton = document.getElementById('join-game-button');
const playerInfoSetupDiv = document.getElementById('player-info-setup');
const gameAreaDiv = document.getElementById('game-area');
const otherPlayersDiv = document.getElementById('other-players');
const deckCountSpan = document.getElementById('deck-count');
const discardTopCardSpan = document.getElementById('discard-top-card');
const myHandDiv = document.getElementById('my-hand');
const myFaceUpDiv = document.getElementById('my-face-up');
const myFaceDownDiv = document.getElementById('my-face-down');
const swapCardsButton = document.getElementById('swap-cards-button');
const startGameButton = document.getElementById('start-game-button');
const takePileButton = document.getElementById('take-pile-button');
const chatInput = document.getElementById('chat-input');
const sendChatButton = document.getElementById('send-chat-button');
const chatMessagesDiv = document.getElementById('chat-messages');
const currentPlayerTurnSpan = document.getElementById('turn-name');
const playerRankingList = document.getElementById('player-ranking-list');


// --- Variables del juego (estado del cliente) ---
let myPlayerId = null;
let currentGameState = {}; // Para almacenar el estado del juego recibido del servidor
let myHand = [];
let myFaceUp = [];
let myFaceDown = [];

// --- Funciones de Utilidad ---
function addGameMessage(message, type = 'info') {
    const p = document.createElement('p');
    p.textContent = message;
    p.className = `game-message ${type}`; // Para estilos CSS (info, warning, error, success)
    messagesDiv.appendChild(p);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Auto-scroll
}

function addChatMessage(senderName, text, senderId) {
    const p = document.createElement('p');
    p.innerHTML = `<strong>${senderName}:</strong> ${text}`;
    if (senderId === myPlayerId) {
        p.classList.add('my-message'); // Clase para mis propios mensajes de chat
    }
    chatMessagesDiv.appendChild(p);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

function renderCard(card, isClickable = false) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    if (card) {
        cardDiv.dataset.suit = card.suit;
        cardDiv.dataset.rank = card.rank;
        cardDiv.textContent = `${card.rank} de ${card.suit}`; // Simplificado para mostrar
        if (isClickable) {
            cardDiv.classList.add('clickable');
            cardDiv.onclick = () => playCard(card.id); // Asumiendo que las cartas tienen un ID único
        }
    } else {
        cardDiv.textContent = 'Carta'; // Para cartas boca abajo o desconocidas
        cardDiv.classList.add('card-back'); // Estilo para cartas boca abajo
    }
    return cardDiv;
}

function updateGameDisplay() {
    // Actualizar otros jugadores
    otherPlayersDiv.innerHTML = '';
    for (const id in currentGameState.players) {
        if (id !== myPlayerId) {
            const player = currentGameState.players[id];
            const playerDiv = document.createElement('div');
            playerDiv.className = 'other-player';
            playerDiv.innerHTML = `
                <img src="${player.avatarUrl || 'https://via.placeholder.com/50?text=Yo'}" alt="${player.name}" class="player-avatar">
                <p>${player.name}</p>
                <p>Mano: ${player.handCount}</p>
                <div class="face-up-cards">
                    ${player.faceUp.map(card => `<div class="card">${card.rank} de ${card.suit}</div>`).join('')}
                </div>
                <p>Boca abajo: ${player.faceDownCount}</p>
                ${player.readyForPlay ? '<span class="status-ready">Listo</span>' : '<span class="status-not-ready">No listo</span>'}
            `;
            otherPlayersDiv.appendChild(playerDiv);
        }
    }

    // Actualizar mazo y descarte
    deckCountSpan.textContent = currentGameState.deckCount || 0;
    if (currentGameState.discardTopCard) {
        discardTopCardSpan.textContent = `${currentGameState.discardTopCard.rank} de ${currentGameState.discardTopCard.suit}`;
    } else {
        discardTopCardSpan.textContent = 'Vacío';
    }

    // Actualizar mi mano y cartas boca arriba/abajo
    myHandDiv.innerHTML = '';
    myHand.forEach(card => myHandDiv.appendChild(renderCard(card, true)));

    myFaceUpDiv.innerHTML = '';
    myFaceUp.forEach(card => myFaceUpDiv.appendChild(renderCard(card, true)));

    myFaceDownDiv.innerHTML = '';
    myFaceDown.forEach(card => myFaceDownDiv.appendChild(renderCard(card, true)));

    // Actualizar turno
    if (currentGameState.currentPlayerTurnId && currentGameState.players[currentGameState.currentPlayerTurnId]) {
        currentPlayerTurnSpan.textContent = currentGameState.players[currentGameState.currentPlayerTurnId].name;
    } else {
        currentPlayerTurnSpan.textContent = 'Esperando...';
    }

    // Actualizar fase de juego y botones
    if (currentGameState.setupPhase) {
        swapCardsButton.style.display = 'block';
        startGameButton.style.display = 'block';
        takePileButton.style.display = 'none';
    } else {
        swapCardsButton.style.display = 'none';
        startGameButton.style.display = 'none';
        takePileButton.style.display = 'block';
    }

    // Actualizar clasificación
    playerRankingList.innerHTML = '';
    currentGameState.ranking.forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.name}: ${player.score}`;
        playerRankingList.appendChild(li);
    });
}

// --- Eventos del Cliente ---
joinGameButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    const avatarUrl = avatarUrlInput.value.trim();
    if (playerName) {
        socket.emit('setPlayerInfo', { playerName, avatarUrl });
        playerInfoSetupDiv.style.display = 'none';
        gameAreaDiv.style.display = 'block';
        addGameMessage(`¡Te has unido como ${playerName}!`, 'success');
    } else {
        alert('Por favor, ingresa tu nombre.');
    }
});

swapCardsButton.addEventListener('click', () => {
    // Lógica para seleccionar y enviar cartas a intercambiar
    // Por ahora, solo indicamos que el jugador está listo
    socket.emit('swapCardsRequest', { /* datos de intercambio si los hubiera */ });
    swapCardsButton.disabled = true; // Desactivar una vez enviado
});

startGameButton.addEventListener('click', () => {
    socket.emit('gameStartRequest');
});

sendChatButton.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
        socket.emit('chatMessage', message);
        chatInput.value = '';
    }
});

takePileButton.addEventListener('click', () => {
    socket.emit('takePileRequest');
});

function playCard(cardId) {
    socket.emit('playCardRequest', { cardId });
}

// --- Eventos de Socket.IO (Recibir del Servidor) ---
socket.on('connect', () => {
    console.log('Conectado al servidor de Socket.IO');
    addGameMessage('Conectado al servidor de juego.', 'info');
});

socket.on('disconnect', () => {
    console.log('Desconectado del servidor de Socket.IO');
    addGameMessage('Desconectado del servidor de juego. Reconectando...', 'error');
});

socket.on('message', (message, type) => {
    addGameMessage(message, type);
});

socket.on('chatMessage', (data) => {
    addChatMessage(data.senderName, data.text, data.senderId);
});

socket.on('gameState', (gameState) => {
    // console.log('Estado del juego recibido:', gameState);
    myPlayerId = gameState.myPlayerId; // Asegurarse de que el cliente conoce su ID
    currentGameState = gameState;
    updateGameDisplay();
});

socket.on('playerStateUpdate', (data) => {
    // console.log('Actualización de estado de jugador recibida:', data);
    myHand = data.myHand || [];
    myFaceUp = data.myFaceUp || [];
    myFaceDown = data.myFaceDown || [];
    updateGameDisplay(); // Vuelve a renderizar con mis cartas actualizadas
});

// Manejo de errores
socket.on('connect_error', (err) => {
    console.error('Error de conexión:', err);
    addGameMessage(`Error de conexión al servidor: ${err.message}`, 'error');
});

