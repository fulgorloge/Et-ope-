// game.js
/**
 * @file game.js
 * @description Lógica del cliente para el juego de cartas, manejo de la interfaz de usuario y comunicación con el servidor.
 * @author Diego Santiago Cobo Agreda
 * @copyright © 2024 Fulgor. Todos los derechos reservados.
 */

const socket = io();

// --- Elementos del DOM ---
const gameMessagesEl = document.getElementById('game-messages');
const playerHandEl = document.getElementById('player1-hand');
const playerFaceUpEl = document.getElementById('player1-face-up');
const playerFaceDownEl = document.getElementById('player1-face-down');
const deckEl = document.getElementById('deck');
const discardPileEl = document.getElementById('discard-pile');
const deckCountEl = document.getElementById('deck-count');
const discardCountEl = document.getElementById('discard-count');
const startGameBtn = document.getElementById('startGameBtn');
const takePileBtn = document.getElementById('takePileBtn');
const restartGameBtn = document.getElementById('restartGameBtn');
const playerNameEl = document.getElementById('player-name');
const playerAvatarEl = document.getElementById('player-avatar');
const opponentAreasEl = document.getElementById('opponent-areas');

// Para la gestión de nombres de usuario y avatares
const nameInputArea = document.getElementById('name-input-area');
const usernameInput = document.getElementById('usernameInput');
const avatarUrlInput = document.getElementById('avatarUrlInput');
const saveUsernameBtn = document.getElementById('saveUsernameBtn');

// Elementos del DOM para el Chat
const chatMessagesEl = document.getElementById('chat-messages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');

// --- NUEVO: Elementos del DOM para el Ranking ---
const rankingListEl = document.getElementById('ranking-list');
// --- FIN NUEVO ---


const EMOJIS = [
    '😀', '😂', '🥳', '👍', '👎', '❤️', '🔥', '👏', '🤔', '😎',
    '🤩', '😜', '😭', '🤯', '💯', '🙏', '🤞', '✨', '🚀', '⭐'
];


// --- Game State (Client Side) ---
let myPlayerId = null; 
let myPlayerName = ''; 
let myPlayerAvatarUrl = ''; 
let myHand = [];
let myFaceUp = [];
let myFaceDown = [];
let discardTopCard = null;
let deckCount = 0;
let discardCount = 0;
let currentPlayerTurnId = null;
let gameActive = false;
let setupPhase = true; 
let selectedCardsForSwap = []; 
let publicPlayerStates = {}; 
let currentRanking = []; // NUEVO: Para almacenar el ranking


const DEFAULT_CLIENT_AVATAR_URL = 'https://via.placeholder.com/50?text=Yo'; 

// --- Card Class (Client-side, for rendering) ---
class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.id = `${suit}-${rank}`;
        this.value = this.getCardValue(); 
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
        if (this.rank === '2') return 15;
        if (this.rank === '10') return 16;
        return parseInt(this.rank);
    }

    isRed() {
        return this.suit === 'hearts' || this.suit === 'diamonds';
    }

    createCardElement(isHidden = false) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.dataset.cardId = this.id; 

        if (isHidden) {
            cardEl.classList.add('hidden');
        } else {
            cardEl.innerHTML = `<span class="rank">${this.rank}</span><span class="suit">${this.getSuitSymbol()}</span>`;
            if (this.isRed()) {
                cardEl.classList.add('red');
            }
        }
        return cardEl;
    }
}

// --- UI Rendering Functions ---

function renderCards(cardArray, containerEl, isHidden = false, isInteractive = false, isFaceDownArea = false) {
    containerEl.innerHTML = ''; 
    cardArray.forEach(cardData => {
        const card = new Card(cardData.suit, cardData.rank);
        const cardEl = card.createCardElement(isHidden);
        
        if (isInteractive && !cardEl.classList.contains('hidden')) {
            cardEl.classList.add('interactive-card'); 
            cardEl.addEventListener('click', (event) => handleCardClick(event, cardData.id, containerEl.id));
        }

        if (isFaceDownArea && isHidden && setupPhase) {
            cardEl.classList.add('interactive-card');
            cardEl.addEventListener('click', (event) => handleCardClick(event, cardData.id, containerEl.id));
        }
        
        if (selectedCardsForSwap.includes(card.id)) {
            cardEl.classList.add('selected-for-swap');
        }

        containerEl.appendChild(cardEl);
    });
}

function updateGameMessage(message, type = 'info') {
    gameMessagesEl.textContent = message;
    gameMessagesEl.className = 'game-messages'; 
    gameMessagesEl.classList.add(type); 
}

function updateUI() {
    // Esconder o mostrar el área de input de nombre y avatar
    if (!myPlayerName) { // Si el nombre no está establecido
        nameInputArea.style.display = 'flex';
        // Ocultar el resto del juego hasta que se elija un nombre
        document.querySelectorAll('.game-container > *:not(#name-input-area):not(h1)').forEach(el => {
            el.style.display = 'none';
        });
        gameMessagesEl.textContent = 'Por favor, ingresa tu nombre y un avatar para unirte al juego.';
        gameMessagesEl.className = 'game-messages info';
        document.querySelector('.chat-container').style.display = 'none';
        document.querySelector('.ranking-container').style.display = 'none'; // NUEVO: Ocultar ranking
        return; 
    } else {
        nameInputArea.style.display = 'none';
        document.querySelector('.game-messages').style.display = 'block'; 
        document.querySelector('.opponent-areas').style.display = 'flex'; 
        document.querySelector('.game-center-area').style.display = 'flex';
        document.querySelector('.player-area').style.display = 'block'; 
        document.querySelector('.chat-container').style.display = 'flex';
        document.querySelector('.ranking-container').style.display = 'block'; // NUEVO: Mostrar ranking
    }


    renderCards(myHand, playerHandEl, false, myPlayerId === currentPlayerTurnId && gameActive && myHand.length > 0);
    renderCards(myFaceUp, playerFaceUpEl, false, myPlayerId === currentPlayerTurnId && gameActive && myHand.length === 0 && myFaceUp.length > 0);
    
    if (setupPhase) {
        renderCards(myFaceDown, playerFaceDownEl, false, true, true); 
    } else {
        const canPlayFaceDown = myPlayerId === currentPlayerTurnId && gameActive && myHand.length === 0 && myFaceUp.length === 0;
        renderCards(myFaceDown, playerFaceDownEl, true, canPlayFaceDown);
    }
    
    deckCountEl.textContent = `Mazo: ${deckCount}`;
    if (deckCount === 0) {
        deckEl.classList.add('disabled');
    } else {
        deckEl.classList.remove('disabled');
    }

    discardPileEl.innerHTML = '';
    if (discardTopCard) {
        const card = new Card(discardTopCard.suit, discardTopCard.rank);
        const cardEl = card.createCardElement(false); 
        discardPileEl.appendChild(cardEl);
    }
    discardCountEl.textContent = `Descarte: ${discardCount}`;

    // Actualizar nombre y avatar del jugador actual
    playerNameEl.textContent = myPlayerName || 'Desconocido';
    playerAvatarEl.src = myPlayerAvatarUrl || DEFAULT_CLIENT_AVATAR_URL;
    playerAvatarEl.alt = `${myPlayerName}'s Avatar`;

    const isMyTurn = myPlayerId === currentPlayerTurnId && gameActive;
    
    if (setupPhase) {
        startGameBtn.style.display = 'block';
        if (selectedCardsForSwap.length === 2) {
            startGameBtn.textContent = 'Confirmar Intercambio';
            startGameBtn.disabled = false;
        } else {
            startGameBtn.textContent = 'Iniciar Juego'; 
            const playerInfo = publicPlayerStates[myPlayerId];
            startGameBtn.disabled = !playerInfo || playerInfo.readyForPlay; 
        }
    } else {
        startGameBtn.style.display = 'none'; 
    }

    takePileBtn.disabled = !isMyTurn || discardCount === 0;
    takePileBtn.style.display = gameActive ? 'block' : 'none';

    restartGameBtn.disabled = !gameActive; 
    restartGameBtn.style.display = 'block'; 

    updateOpponentAreas();
    updateRankingUI(); // NUEVO: Llamar a la función de actualización del ranking
}

function updateOpponentAreas() {
    opponentAreasEl.innerHTML = ''; 

    for (const id in publicPlayerStates) {
        if (id === myPlayerId) continue; 

        const opponent = publicPlayerStates[id];
        const opponentArea = document.createElement('div');
        opponentArea.className = 'opponent-player-area';
        if (currentPlayerTurnId === id) {
            opponentArea.classList.add('current-turn-indicator');
        }

        // Mostrar el nombre del oponente y su avatar
        opponentArea.innerHTML = `
            <img class="player-avatar" src="${opponent.avatarUrl || DEFAULT_CLIENT_AVATAR_URL}" alt="${opponent.name}'s Avatar">
            <h3>${opponent.name}</h3>
            <div class="opponent-cards-summary">
                <div class="opponent-card-summary-item">Mano: <span class="card-count">${opponent.handCount}</span></div>
                <div class="opponent-card-summary-item">Boca Abajo: <span class="card-count">${opponent.faceDownCount}</span></div>
            </div>
            <h4>Cartas Boca Arriba:</h4>
            <div class="opponent-face-up-cards"></div>
        `;
        
        const opponentFaceUpCardsEl = opponentArea.querySelector('.opponent-face-up-cards');
        renderCards(opponent.faceUp, opponentFaceUpCardsEl, false, false); 

        opponentAreasEl.appendChild(opponentArea);
    }
}

// --- Funciones para el Mini Chat ---
function addChatMessage(senderName, message, senderId) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('chat-message');
    if (senderId === myPlayerId) {
        messageEl.classList.add('self');
    }
    messageEl.innerHTML = `<strong>${senderName}:</strong> ${message}`;
    chatMessagesEl.appendChild(messageEl);
    // Auto-scroll al final del chat
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message) {
        socket.emit('chatMessage', message);
        chatInput.value = ''; // Limpiar input
        // Cerrar picker de emojis si estaba abierto
        emojiPicker.classList.add('hidden');
    }
}

function populateEmojiPicker() {
    emojiPicker.innerHTML = '';
    EMOJIS.forEach(emoji => {
        const button = document.createElement('button');
        button.textContent = emoji;
        button.addEventListener('click', () => {
            chatInput.value += emoji; // Añadir emoji al input
            chatInput.focus(); // Mantener el foco
        });
        emojiPicker.appendChild(button);
    });
}
// --- FIN Funciones para el Mini Chat ---

// --- NUEVO: Funciones de Ranking del Cliente ---
function updateRankingUI() {
    rankingListEl.innerHTML = ''; // Limpiar la lista existente

    if (currentRanking.length === 0) {
        const listItem = document.createElement('li');
        listItem.textContent = 'Aún no hay puntos registrados.';
        rankingListEl.appendChild(listItem);
        return;
    }

    currentRanking.forEach((player, index) => {
        const listItem = document.createElement('li');
        listItem.classList.add('ranking-item');
        listItem.innerHTML = `
            <span>${index + 1}. <span class="player-name">${player.name}</span></span>
            <span class="player-score">${player.score} puntos</span>
        `;
        rankingListEl.appendChild(listItem);
    });
}
// --- FIN NUEVO ---


// --- Event Handlers ---

function handleCardClick(event, cardId, sourceAreaId) {
    if (setupPhase) {
        const cardEl = event.currentTarget;

        let cardSourceArrayRef;
        if (sourceAreaId === playerHandEl.id) cardSourceArrayRef = myHand;
        else if (sourceAreaId === playerFaceUpEl.id) cardSourceArrayRef = myFaceUp;
        else if (sourceAreaId === playerFaceDownEl.id) cardSourceArrayRef = myFaceDown;
        else return; 

        const clickedCard = cardSourceArrayRef.find(c => c.id === cardId);
        if (!clickedCard) return;

        const isAlreadySelected = selectedCardsForSwap.includes(cardId);

        if (isAlreadySelected) {
            selectedCardsForSwap = selectedCardsForSwap.filter(id => id !== cardId);
            cardEl.classList.remove('selected-for-swap');
        } else {
            if (selectedCardsForSwap.length < 2) {
                let canSelect = true;
                if (selectedCardsForSwap.length === 1) {
                    const firstSelectedCardId = selectedCardsForSwap[0];
                    let firstSelectedCardAreaId;
                    if (myHand.some(c => c.id === firstSelectedCardId)) firstSelectedCardAreaId = playerHandEl.id;
                    else if (myFaceUp.some(c => c.id === firstSelectedCardId)) firstSelectedCardAreaId = playerFaceUpEl.id;
                    else if (myFaceDown.some(c => c.id === firstSelectedCardId)) firstSelectedCardAreaId = playerFaceDownEl.id;
                    
                    if (firstSelectedCardAreaId === sourceAreaId) {
                        updateGameMessage('Debes seleccionar cartas de áreas DIFERENTES (mano, boca arriba, o boca abajo) para intercambiar.', 'warning');
                        canSelect = false;
                    }
                }

                if (canSelect) {
                    selectedCardsForSwap.push(cardId);
                    cardEl.classList.add('selected-for-swap');
                }
            } else {
                updateGameMessage('Ya has seleccionado dos cartas para intercambiar. Haz clic en "Confirmar Intercambio".', 'warning');
            }
        }
        updateUI(); 
        
    } else if (myPlayerId === currentPlayerTurnId && gameActive) {
        const cardEl = event.currentTarget;
        const cardIdToPlay = cardEl.dataset.cardId;
        
        socket.emit('playCardRequest', { cardId: cardIdToPlay });
    } else {
        updateGameMessage('No es tu turno para jugar.', 'warning');
    }
}


// Evento para guardar el nombre de usuario y avatar
saveUsernameBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const avatarUrl = avatarUrlInput.value.trim();

    if (username) {
        // Enviar tanto el nombre como el avatar al servidor
        socket.emit('setPlayerInfo', { playerName: username, avatarUrl: avatarUrl });
        myPlayerName = username; // Actualizar el nombre localmente
        myPlayerAvatarUrl = avatarUrl || DEFAULT_CLIENT_AVATAR_URL; // Actualizar el avatar localmente (si es vacío, usar el default del cliente)
        updateGameMessage(`¡Hola, ${myPlayerName}! Esperando a otros jugadores...`, 'info');
        updateUI(); 
    } else {
        updateGameMessage('Por favor, ingresa un nombre válido.', 'warning');
    }
});

// Permitir presionar Enter para guardar el nombre y avatar
usernameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        saveUsernameBtn.click();
    }
});
avatarUrlInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        saveUsernameBtn.click();
    }
});

// Eventos del Chat
sendChatBtn.addEventListener('click', sendChatMessage);

chatInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
});

emojiBtn.addEventListener('click', () => {
    emojiPicker.classList.toggle('hidden');
    if (!emojiPicker.classList.contains('hidden')) {
        populateEmojiPicker(); // Rellenar los emojis cada vez que se abre
    }
});

// Cerrar el selector de emojis si se hace clic fuera
document.addEventListener('click', (event) => {
    if (!emojiPicker.contains(event.target) && !emojiBtn.contains(event.target)) {
        emojiPicker.classList.add('hidden');
    }
});


startGameBtn.addEventListener('click', () => {
    if (setupPhase) {
        if (selectedCardsForSwap.length === 2) {
            socket.emit('swapCardsRequest', {
                handCardId: myHand.some(card => selectedCardsForSwap.includes(card.id)) ? selectedCardsForSwap.find(id => myHand.some(card => card.id === id)) : null,
                faceUpCardId: myFaceUp.some(card => selectedCardsForSwap.includes(card.id)) ? selectedCardsForSwap.find(id => myFaceUp.some(card => card.id === id)) : null,
                faceDownCardId: myFaceDown.some(card => selectedCardsForSwap.includes(card.id)) ? selectedCardsForSwap.find(id => myFaceDown.some(card => card.id === id)) : null
            });
            selectedCardsForSwap = []; 
            updateGameMessage('Enviando solicitud de intercambio. Esperando a otros jugadores...', 'info');
            startGameBtn.textContent = 'Esperando otros jugadores...';
            startGameBtn.disabled = true; 
            updateUI(); 
        } else {
            const playerInfo = publicPlayerStates[myPlayerId];
            if (playerInfo && playerInfo.readyForPlay) {
                socket.emit('gameStartRequest');
            } else {
                updateGameMessage('Selecciona exactamente dos cartas para intercambiar, o espera a que otros jugadores terminen el setup.', 'warning');
            }
        }
    } else {
        socket.emit('gameStartRequest');
    }
});

takePileBtn.addEventListener('click', () => {
    if (myPlayerId === currentPlayerTurnId && gameActive) {
        socket.emit('takePileRequest');
    } else {
        updateGameMessage('No es tu turno para tomar el descarte.', 'warning');
    }
});

restartGameBtn.addEventListener('click', () => {
    updateGameMessage('Funcionalidad de reiniciar juego no implementada completamente en el servidor.', 'info');
});


// --- Socket.IO Event Listeners ---

socket.on('connect', () => {
    myPlayerId = socket.id;
    updateUI(); 
});

socket.on('message', (message, type = 'info') => {
    updateGameMessage(message, type);
});

// Escuchar mensajes de chat
socket.on('chatMessage', (data) => {
    addChatMessage(data.senderName, data.text, data.senderId);
});


socket.on('currentGameState', (state) => {
    // console.log('[CLIENT] Received current game state:', state);
    if (state.playerName) {
        myPlayerName = state.playerName; 
    }
    if (state.playerAvatarUrl) {
        myPlayerAvatarUrl = state.playerAvatarUrl;
    }

    myHand = state.playerHand;
    myFaceUp = state.playerFaceUp;
    myFaceDown = state.faceDown; 
    deckCount = state.deckCount;
    discardTopCard = state.discardTopCard;
    discardCount = state.discardCount;
    currentPlayerTurnId = state.currentPlayerTurnId;
    gameActive = state.gameActive;
    setupPhase = state.setupPhase;
    publicPlayerStates = state.publicPlayerStates; 
    currentRanking = state.ranking; // NUEVO: Actualizar el ranking

    if (!setupPhase) {
        selectedCardsForSwap = [];
        const selectedEls = document.querySelectorAll('.selected-for-swap');
        selectedEls.forEach(el => el.classList.remove('selected-for-swap'));
    }

    updateUI();
});

socket.on('publicGameState', (state) => {
    // console.log('[CLIENT] Received public game state:', state);
    deckCount = state.deckCount;
    discardTopCard = state.discardTopCard;
    discardCount = state.discardCount;
    currentPlayerTurnId = state.currentPlayerTurnId;
    gameActive = state.gameActive;
    publicPlayerStates = sta
