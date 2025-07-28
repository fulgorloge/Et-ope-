// game.js
/**
 * @file game.js
 * @description Lógica del cliente para el juego de cartas, manejo de la interfaz de usuario y comunicación con el servidor.
 * @author Diego Santiago Cobo Agreda
 * @copyright © 2024 Fulgor. Todos los derechos reservados.
 */

const socket = io();

// --- Elementos del DOM ---
// Pantalla de Perfil
const nameInputArea = document.getElementById('name-input-area');
const usernameInput = document.getElementById('usernameInput');
const avatarUrlInput = document.getElementById('avatarUrlInput');
const saveUsernameBtn = document.getElementById('saveUsernameBtn');
const gameMessagesInitialEl = document.getElementById('game-messages-initial'); // Mensajes específicos para la pantalla inicial

// Pantalla de Juego
const gameContainerEl = document.getElementById('game-container'); // Nuevo contenedor principal del juego
const gameMessagesEl = document.getElementById('game-messages'); // Mensajes dentro del juego
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

// Elementos del DOM para el Chat
const chatMessagesEl = document.getElementById('chat-messages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');

// Elementos del DOM para el Ranking
const rankingListEl = document.getElementById('ranking-list');


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
let currentRanking = []; 


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
    // Decide dónde mostrar el mensaje basado en si estamos en la pantalla de perfil o de juego
    if (!myPlayerName) { // Si el nombre aún no está guardado, mostrar en la pantalla inicial
        gameMessagesInitialEl.textContent = message;
        gameMessagesInitialEl.className = 'game-messages'; 
        gameMessagesInitialEl.classList.add(type); 
    } else { // Si el nombre ya está guardado, mostrar en la pantalla de juego
        gameMessagesEl.textContent = message;
        gameMessagesEl.className = 'game-messages'; 
        gameMessagesEl.classList.add(type); 
    }
}

function updateUI() {
    // Alternar visibilidad de las pantallas
    if (!myPlayerName) { 
        nameInputArea.classList.remove('hidden');
        gameContainerEl.classList.add('hidden');
        updateGameMessage('Por favor, ingresa tu nombre y un avatar para unirte al juego.', 'info');
        return; 
    } else {
        nameInputArea.classList.add('hidden');
        gameContainerEl.classList.remove('hidden');
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
            startGameBtn.disabled = !playerInfo || !playerInfo.readyForPlay; 
        }
    } else {
        startGameBtn.style.display = 'none'; 
    }

    takePileBtn.disabled = !isMyTurn || discardCount === 0;
    takePileBtn.style.display = gameActive ? 'block' : 'none';

    restartGameBtn.disabled = !gameActive; 
    restartGameBtn.style.display = 'block'; 

    updateOpponentAreas();
    updateRankingUI(); 
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
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message) {
        socket.emit('chatMessage', message);
        chatInput.value = ''; 
        emojiPicker.classList.add('hidden');
    }
}

function populateEmojiPicker() {
    emojiPicker.innerHTML = '';
    EMOJIS.forEach(emoji => {
        const button = document.createElement('button');
        button.textContent = emoji;
        button.addEventListener('click', () => {
            chatInput.value += emoji; 
            chatInput.focus(); 
        });
        emojiPicker.appendChild(button);
    });
}
// --- FIN Funciones para el Mini Chat ---

// --- Funciones de Ranking del Cliente ---
function updateRankingUI() {
    rankingListEl.innerHTML = ''; 

    if (currentRanking.length === 0) {
        const listItem = document.createElement('li');
        listItem.textContent = 'Aún no hay puntos registrados.';
        rankingListEl.appendChild(listItem);
        return;
    }

    currentRanking.forEach((player, index) => {
        const listItem = document.createElement('li');
        listItem.classList.add('ranking-item');
        
        // Determinar el nivel de estrellas basado en el puntaje
        let starLevel = '';
        if (player.score >= 5) {
            starLevel = 'gold'; // 3 estrellas
        } else if (player.score >= 2) {
            starLevel = 'silver'; // 2 estrellas
        } else if (player.score >= 1) {
            starLevel = 'bronze'; // 1 estrella
        }
        listItem.dataset.score = starLevel; // Usar data-attribute para CSS

        // Añadir trofeo para los top 3
        const trophy = index < 3 ? `<span class="trophy-icon"></span>` : '';
        const stars = starLevel ? `<span class="stars"></span>` : '';

        listItem.innerHTML = `
            <span>${index + 1}. ${trophy}<span class="player-name">${player.name}</span></span>
            <span class="player-score">${player.score} puntos ${stars}</span>
        `;
        rankingListEl.appendChild(listItem);
    });
}
// --- FIN Funciones de Ranking del Cliente ---


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
        console.log('[CLIENTE] Intento de guardar nombre:', username, 'Avatar:', avatarUrl); // DEPURACIÓN CLIENTE
        socket.emit('setPlayerInfo', { playerName: username, avatarUrl: avatarUrl });
        
        // Actualizar el nombre y avatar localmente para una respuesta inmediata en la UI
        myPlayerName = username; 
        myPlayerAvatarUrl = avatarUrl || DEFAULT_CLIENT_AVATAR_URL; 
        
        updateGameMessage(`¡Hola, ${myPlayerName}! Esperando a otros jugadores...`, 'info');
        updateUI(); // Esto cambiará a la pantalla del juego
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
        populateEmojiPicker(); 
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
            startGameBtn.disabled = true; 
            updateUI(); 
        } else {
            const playerInfo = publicPlayerStates[myPlayerId];
            if (playerInfo && playerInfo.readyForPlay) {
                socket.emit('gameStartRequest');
                updateGameMessage('Intentando iniciar el juego...', 'info');
                startGameBtn.disabled = true; 
            } else {
                updateGameMessage('Selecciona exactamente dos cartas para intercambiar, o espera a que otros jugadores terminen el setup.', 'warning');
            }
        }
    } else {
        socket.emit('gameStartRequest'); 
        updateGameMessage('Funcionalidad de reiniciar juego no implementada completamente en el servidor.', 'info');
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
    console.log('[CLIENTE] Conectado con ID:', myPlayerId); // DEPURACIÓN CLIENTE
    
    // Al conectar, intenta cargar el nombre y avatar guardados
    const storedName = localStorage.getItem('playerName');
    const storedAvatar = localStorage.getItem('playerAvatarUrl');
    
    if (storedName) {
        myPlayerName = storedName; // Establece el nombre localmente de inmediato
        myPlayerAvatarUrl = storedAvatar || DEFAULT_CLIENT_AVATAR_URL;
        socket.emit('setPlayerInfo', { playerName: storedName, avatarUrl: storedAvatar || DEFAULT_CLIENT_AVATAR_URL });
        updateGameMessage(`¡Reconectado como ${myPlayerName}!`, 'info');
    } else {
        // Si no hay nombre guardado, asegúrate de que se muestre la pantalla de entrada
        myPlayerName = ''; // Asegura que esté vacío para que updateUI muestre la pantalla de perfil
    }
    updateUI(); // Esto mostrará la pantalla correcta (perfil o juego)
});

socket.on('message', (message, type = 'info') => {
    console.log(`[CLIENTE] Mensaje del servidor (${type}):`, message); // DEPURACIÓN CLIENTE
    updateGameMessage(message, type);
});

socket.on('chatMessage', (data) => {
    addChatMessage(data.senderName, data.text, data.
