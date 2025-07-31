// public/game.js

// *** ¡IMPORTANTE: REEMPLAZA "https://nombre-de-tu-servicio.onrender.com" con la URL REAL de tu backend en Render! ***
const backendUrl = "https://et-ope.onrender.com"; // <--- ¡TU URL DE RENDER AQUÍ!

// Asegúrate de que la librería cliente de Socket.IO esté cargada en tu HTML (ej: <script src="/socket.io/socket.io.js"></script>)
// ANTES de que se cargue este archivo game.js.
// Por eso, la declaración 'var io = ""' que tenías era incorrecta y causaba el error.
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
            // Asegúrate de que card.id exista en tus objetos de carta para que esto funcione
            cardDiv.onclick = () => playCard(card.id);
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
    myFaceDown.forEach(card => myFaceDownDiv.appendChild(renderCard(card, false))); // Cartas boca abajo no son clickeables

    // Actualizar turno
    if (currentGameState.currentPlayerTurnId && currentGameState.players[currentGameState.currentPlayerTurnId]) {
        currentPlayerTurnSpan.textContent = currentGameState.players[currentGameState.currentPlayerTurnId].name;
    } else {
        currentPlayerTurnSpan.textContent = 'Esperando...';
    }

    // Actualizar fase de juego y botones
    // Se asume que 'setupPhase' es una propiedad booleana del estado del juego
    if (currentGameState.setupPhase) {
        swapCardsButton.style.display = 'block';
        startGameButton.style.display = 'block';
        takePileButton.style.display = 'none';
        // Habilitar o deshabilitar botón de inicio si hay suficientes jugadores
        if (currentGameState.players && Object.keys(currentGameState.players).length >= 2 && currentGameState.allPlayersReadyForPlay) {
             startGameButton.disabled = false;
        } else {
             startGameButton.disabled = true;
        }
    } else {
        swapCardsButton.style.display = 'none';
        startGameButton.style.display = 'none';
        takePileButton.style.display = 'block';
    }

    // Actualizar clasificación
    playerRankingList.innerHTML = '';
    if (currentGameState.ranking) {
        currentGameState.ranking.forEach(player => {
            const li = document.createElement('li');
            li.textContent = `${player.name}: ${player.score}`;
            playerRankingList.appendChild(li);
        });
    }
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
    // NOTA: Aquí necesitarías la lógica para permitir al jugador seleccionar
    // qué cartas de su mano y de su pila boca arriba quiere intercambiar.
    // Por ahora, solo se enviaría una señal general o un arreglo de IDs si ya las seleccionó.
    // Ejemplo: socket.emit('swapCardsRequest', { selectedHandCardId: '...', selectedFaceUpCardId: '...' });
    addGameMessage('Has indicado tu intención de intercambiar cartas. Esperando la selección...', 'info');
    socket.emit('playerReadyForSwap'); // Podría ser una señal para que el servidor inicie la fase de intercambio
    swapCardsButton.disabled = true; // Desactivar una vez enviado hasta que el servidor lo re-habilite o termine la fase
});

startGameButton.addEventListener('click', () => {
    socket.emit('gameStartRequest');
    startGameButton.disabled = true; // Deshabilitar para evitar múltiples clics
});

sendChatButton.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
        socket.emit('chatMessage', message);
        chatInput.value = '';
    }
});

// Permite enviar mensaje de chat al presionar Enter
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatButton.click();
    }
});

takePileButton.addEventListener('click', () => {
    socket.emit('takePileRequest');
});

function playCard(cardId) {
    // Se asume que esta función se llama cuando una carta en la mano o boca arriba es clickeada
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
    // console.log('Estado del juego recibido:', gameState); // Descomenta para depuración
    myPlayerId = gameState.myPlayerId; // Asegurarse de que el cliente conoce su ID
    currentGameState = gameState;
    updateGameDisplay();
});

socket.on('playerStateUpdate', (data) => {
    // console.log('Actualización de estado de jugador recibida:', data); // Descomenta para depuración
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

// Evento para habilitar el botón de intercambio si es necesario (ej. después de un error o nueva ronda)
socket.on('enableSwapButton', () => {
    swapCardsButton.disabled = false;
});

// Evento para habilitar el botón de inicio de juego (si el servidor indica que hay suficientes jugadores y están listos)
socket.on('enableStartGameButton', () => {
    startGameButton.disabled = false;
});
