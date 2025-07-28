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
const opponentAreasEl = document.getElementById('opponent-areas');

// --- Game State (Client Side) ---
let myPlayerId = null; // Se establecerá cuando el servidor envíe el primer estado
let myHand = [];
let myFaceUp = [];
let myFaceDown = [];
let discardTopCard = null;
let deckCount = 0;
let discardCount = 0;
let currentPlayerTurnId = null;
let gameActive = false;
let setupPhase = true; // Inicialmente estamos en fase de setup
let selectedCardsForSwap = []; // Almacena hasta dos IDs de cartas seleccionadas para el swap

// --- Card Class (Client-side, for rendering) ---
class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.id = `${suit}-${rank}`;
        this.value = this.getCardValue(); // No estrictamente necesario en el cliente, pero útil para mostrar
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

    // Crea el elemento HTML de la carta
    createCardElement(isHidden = false) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.dataset.cardId = this.id; // Guarda el ID para fácil referencia

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
    containerEl.innerHTML = ''; // Limpiar el contenedor
    cardArray.forEach(cardData => {
        const card = new Card(cardData.suit, cardData.rank);
        const cardEl = card.createCardElement(isHidden);
        
        if (isInteractive && !cardEl.classList.contains('hidden')) {
            cardEl.classList.add('interactive-card'); // Para efectos visuales o para indicar clicable
            cardEl.addEventListener('click', (event) => handleCardClick(event, cardData.id, containerEl.id));
        }

        if (isFaceDownArea && isHidden && setupPhase) {
            // Permitir seleccionar cartas ocultas SOLO en fase de setup para intercambio
            cardEl.classList.add('interactive-card');
            cardEl.addEventListener('click', (event) => handleCardClick(event, cardData.id, containerEl.id));
        }
        
        // Mantener el estado de selección para el swap
        if (selectedCardsForSwap.includes(card.id)) {
            cardEl.classList.add('selected-for-swap');
        }

        containerEl.appendChild(cardEl);
    });
}

function updateGameMessage(message, type = 'info') {
    gameMessagesEl.textContent = message;
    gameMessagesEl.className = 'game-messages'; // Resetear clases
    gameMessagesEl.classList.add(type); // Añadir el tipo de mensaje (info, warning, error, success)
}

function updateUI() {
    // Actualizar mano del jugador
    // Cartas de la mano solo interactivas si es mi turno y el juego está activo
    renderCards(myHand, playerHandEl, false, myPlayerId === currentPlayerTurnId && gameActive && myHand.length > 0);

    // Actualizar cartas boca arriba del jugador
    // Cartas boca arriba interactivas solo si es mi turno, juego activo y mi mano está vacía
    renderCards(myFaceUp, playerFaceUpEl, false, myPlayerId === currentPlayerTurnId && gameActive && myHand.length === 0 && myFaceUp.length > 0);
    
    // Actualizar cartas boca abajo del jugador (visibles solo para el propietario en fase de setup)
    if (setupPhase) {
        // En fase de setup, las cartas boca abajo se muestran y son interactivas para el intercambio
        renderCards(myFaceDown, playerFaceDownEl, false, true, true); 
    } else {
        // Fuera de setup, son ocultas y solo interactivas si es mi turno, juego activo, y mano Y boca arriba están vacías
        const canPlayFaceDown = myPlayerId === currentPlayerTurnId && gameActive && myHand.length === 0 && myFaceUp.length === 0;
        renderCards(myFaceDown, playerFaceDownEl, true, canPlayFaceDown);
    }
    
    // Actualizar mazo
    deckCountEl.textContent = `Mazo: ${deckCount}`;
    if (deckCount === 0) {
        deckEl.classList.add('disabled');
    } else {
        deckEl.classList.remove('disabled');
    }

    // Actualizar pila de descarte
    discardPileEl.innerHTML = '';
    if (discardTopCard) {
        const card = new Card(discardTopCard.suit, discardTopCard.rank);
        const cardEl = card.createCardElement(false); // La carta superior del descarte siempre es visible
        discardPileEl.appendChild(cardEl);
    }
    discardCountEl.textContent = `Descarte: ${discardCount}`;

    // Actualizar ID del jugador y turno
    playerNameEl.textContent = myPlayerId ? `Tú (${myPlayerId.substring(0,4)})` : 'Desconocido';

    // Manejo de botones según la fase del juego y el turno
    const isMyTurn = myPlayerId === currentPlayerTurnId && gameActive;
    
    // Botón Iniciar Juego/Confirmar Intercambio
    if (setupPhase) {
        startGameBtn.style.display = 'block';
        if (selectedCardsForSwap.length === 2) {
            startGameBtn.textContent = 'Confirmar Intercambio';
            startGameBtn.disabled = false;
        } else {
            startGameBtn.textContent = 'Iniciar Juego'; // Estado por defecto si no hay 2 seleccionadas
            startGameBtn.disabled = true; // Deshabilitado hasta que se seleccionen 2 cartas o el juego se inicie por otro
        }
        // Si ya confirmó su swap, el botón debe estar deshabilitado hasta que todos lo hagan.
        // Esto se maneja en el listener 'swapSuccessful' y en 'startGame'.
    } else {
        startGameBtn.style.display = 'none'; // Ocultar si el juego ya empezó
    }

    // Botón Tomar Descarte
    takePileBtn.disabled = !isMyTurn || discardCount === 0;
    takePileBtn.style.display = gameActive ? 'block' : 'none';

    // Botón Reiniciar Juego (decide cuándo mostrarlo)
    restartGameBtn.disabled = !gameActive; // Habilitado si el juego está activo (para un reseteo forzado)
    restartGameBtn.style.display = 'block'; // Siempre visible por ahora, puedes ocultarlo si quieres

    // Actualizar el estado visual de los oponentes
    updateOpponentAreas();
}

function updateOpponentAreas() {
    opponentAreasEl.innerHTML = ''; // Limpiar área de oponentes

    for (const id in publicPlayerStates) {
        if (id === myPlayerId) continue; // No renderizar al propio jugador como oponente

        const opponent = publicPlayerStates[id];
        const opponentArea = document.createElement('div');
        opponentArea.className = 'opponent-player-area';
        if (currentPlayerTurnId === id) {
            opponentArea.classList.add('current-turn-indicator');
        }

        opponentArea.innerHTML = `
            <h3>${opponent.name}</h3>
            <div class="opponent-cards-summary">
                <div class="opponent-card-summary-item">Mano: <span class="card-count">${opponent.handCount}</span></div>
                <div class="opponent-card-summary-item">Boca Abajo: <span class="card-count">${opponent.faceDownCount}</span></div>
            </div>
            <h4>Cartas Boca Arriba:</h4>
            <div class="opponent-face-up-cards"></div>
        `;
        
        const opponentFaceUpCardsEl = opponentArea.querySelector('.opponent-face-up-cards');
        renderCards(opponent.faceUp, opponentFaceUpCardsEl, false, false); // Las cartas boca arriba de oponentes no son interactivas para nosotros

        opponentAreasEl.appendChild(opponentArea);
    }
}


// --- Event Handlers ---

function handleCardClick(event, cardId, sourceAreaId) {
    if (setupPhase) {
        // Lógica de selección de cartas para intercambio en fase de setup
        const cardEl = event.currentTarget;

        // Determinar de qué área proviene la carta clicada
        let cardSourceArrayRef;
        if (sourceAreaId === playerHandEl.id) cardSourceArrayRef = myHand;
        else if (sourceAreaId === playerFaceUpEl.id) cardSourceArrayRef = myFaceUp;
        else if (sourceAreaId === playerFaceDownEl.id) cardSourceArrayRef = myFaceDown;
        else return; // Área no reconocida

        // Encontrar la carta real en el array
        const clickedCard = cardSourceArrayRef.find(c => c.id === cardId);
        if (!clickedCard) return;

        // Comprobar si la carta ya está en la selección
        const isAlreadySelected = selectedCardsForSwap.includes(cardId);

        if (isAlreadySelected) {
            // Si ya estaba seleccionada, la deseleccionamos
            selectedCardsForSwap = selectedCardsForSwap.filter(id => id !== cardId);
            cardEl.classList.remove('selected-for-swap');
        } else {
            // Si no estaba seleccionada, intentamos añadirla
            if (selectedCardsForSwap.length < 2) {
                // Verificar que no se seleccione otra carta de la misma área si ya hay una seleccionada
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
        updateUI(); // Refrescar UI para actualizar el estado del botón
        
    } else if (myPlayerId === currentPlayerTurnId && gameActive) {
        // Lógica para jugar una carta durante el turno normal
        const cardEl = event.currentTarget;
        const cardIdToPlay = cardEl.dataset.cardId;
        
        // Emitir el evento al servidor
        socket.emit('playCardRequest', { cardId: cardIdToPlay });
    } else {
        updateGameMessage('No es tu turno para jugar.', 'warning');
    }
}


startGameBtn.addEventListener('click', () => {
    if (setupPhase) {
        if (selectedCardsForSwap.length === 2) {
            // Envía la solicitud de swap al servidor
            socket.emit('swapCardsRequest', {
                // Asegúrate de enviar solo los IDs de las cartas para el swap
                handCardId: myHand.some(card => selectedCardsForSwap.includes(card.id)) ? selectedCardsForSwap.find(id => myHand.some(card => card.id === id)) : null,
                faceUpCardId: myFaceUp.some(card => selectedCardsForSwap.includes(card.id)) ? selectedCardsForSwap.find(id => myFaceUp.some(card => card.id === id)) : null,
                faceDownCardId: myFaceDown.some(card => selectedCardsForSwap.includes(card.id)) ? selectedCardsForSwap.find(id => myFaceDown.some(card => card.id === id)) : null
            });
            selectedCardsForSwap = []; // Limpiar selección inmediatamente
            updateGameMessage('Enviando solicitud de intercambio. Esperando a otros jugadores...', 'info');
            startGameBtn.textContent = 'Esperando otros jugadores...';
            startGameBtn.disabled = true; // Deshabilitar mientras espera
            updateUI(); // Refrescar UI para mostrar botón deshabilitado
        } else {
            updateGameMessage('Selecciona exactamente dos cartas para intercambiar.', 'warning');
        }
    } else {
        // Si no estamos en fase de setup, este botón debería iniciar el juego (para el host)
        // O debería estar oculto/deshabilitado si el juego ya está activo.
        // La lógica ya maneja que el juego solo inicie si hay al menos 2 jugadores y todos están readyForPlay.
        socket.emit('gameStartRequest', { playerName: playerNameEl.textContent });
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
    // TODO: Implementar lógica de reinicio completo en el servidor
    // Por ahora, solo es un marcador de posición
    updateGameMessage('Funcionalidad de reiniciar juego no implementada completamente en el servidor.', 'info');
    // socket.emit('restartGameRequest'); // Puedes emitir un evento para que el servidor lo maneje
});


// --- Socket.IO Event Listeners ---

socket.on('connect', () => {
    myPlayerId = socket.id;
    playerNameEl.textContent = `Tú (${myPlayerId.substring(0,4)})`;
    updateGameMessage('Conectado al servidor. Esperando jugadores...');
    updateUI(); // Renderiza el estado inicial
});

socket.on('message', (message, type = 'info') => {
    updateGameMessage(message, type);
});

socket.on('currentGameState', (state) => {
    // console.log('[CLIENT] Received current game state:', state);
    myHand = state.playerHand;
    myFaceUp = state.playerFaceUp;
    myFaceDown = state.playerFaceDown; // Ahora recibimos las cartas reales
    deckCount = state.deckCount;
    discardTopCard = state.discardTopCard;
    discardCount = state.discardCount;
    currentPlayerTurnId = state.currentPlayerTurnId;
    gameActive = state.gameActive;
    setupPhase = state.setupPhase;
    publicPlayerStates = state.publicPlayerStates; // Asegurar que publicPlayerStates esté actualizado para el renderizado de oponentes

    // Si la fase de setup termina, asegurar que los elementos de swap se limpian
    if (!setupPhase) {
        selectedCardsForSwap = [];
        const selectedEls = document.querySelectorAll('.selected-for-swap');
        selectedEls.forEach(el => el.classList.remove('selected-for-swap'));
    }

    updateUI();
});

// Este evento es para datos públicos de todos los jugadores que todos pueden ver
let publicPlayerStates = {}; // Definir aquí para que sea accesible globalmente
socket.on('publicGameState', (state) => {
    // console.log('[CLIENT] Received public game state:', state);
    // Actualizar solo los datos públicos
    deckCount = state.deckCount;
    discardTopCard = state.discardTopCard;
    discardCount = state.discardCount;
    currentPlayerTurnId = state.currentPlayerTurnId;
    gameActive = state.gameActive;
    // La 'setupPhase' se maneja desde 'currentGameState' que es específico del cliente.

    // Actualizar el objeto publicPlayerStates completo desde el servidor
    // Esto es crucial para renderizar a los oponentes.
    publicPlayerStates = state.publicPlayerStates; 

    updateUI();
});

socket.on('swapSuccessful', () => {
    updateGameMessage('Intercambio realizado con éxito. Esperando a otros jugadores.', 'success');
    // El botón se actualizará a "Esperando otros jugadores..." y deshabilitado via updateUI
    // El texto del botón ya se gestiona en updateUI basado en setupPhase y selectedCardsForSwap
});

socket.on('disconnect', () => {
    updateGameMessage('Desconectado del servidor.', 'error');
    // Deshabilitar todo y limpiar el UI
    gameActive = false;
    myPlayerId = null;
    myHand = [];
    myFaceUp = [];
    myFaceDown = [];
    discardTopCard = null;
    deckCount = 0;
    discardCount = 0;
    currentPlayerTurnId = null;
    setupPhase = true;
    selectedCardsForSwap = [];
    publicPlayerStates = {}; // Limpiar también el estado de los oponentes
    updateUI();
});

// Inicializar la UI al cargar
updateUI();
                                
