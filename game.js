// 1. Declaración de Variables Globales
let deck = [];
const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const players = {
    player1: {
        hand: [],
        faceUp: [],
        faceDown: [],
        isTurn: false,
        selectedCards: [], // Para la fase de configuración
        cardsPlayedThisTurn: [], // Para la lógica de "si juegas igual o mejor"
        hasToBeatValue: null // Valor a superar en el turno actual
    },
    player2: { // La IA
        hand: [],
        faceUp: [],
        faceDown: [],
        isTurn: false,
        selectedCards: [],
        cardsPlayedThisTurn: [],
        hasToBeatValue: null
    }
};
let discardPile = [];
let gameState = 'setup'; // 'setup', 'playing', 'gameOver'
let currentPlayer = 'player1'; // 'player1' o 'player2'
let messageTimeout; // Para controlar el timeout de los mensajes

// Referencias a elementos del DOM
const player1HandEl = document.getElementById('player1-hand');
const player1FaceUpEl = document.getElementById('player1-face-up');
const player1FaceDownEl = document.getElementById('player1-face-down');
const player2HandEl = document.getElementById('player2-hand');
const player2FaceUpEl = document.getElementById('player2-face-up');
const player2FaceDownEl = document.getElementById('player2-face-down');
const deckEl = document.querySelector('.deck-pile'); // Seleccionar el contenedor del mazo
const discardPileEl = document.getElementById('discard-pile'); // Seleccionar solo el área de la carta superior
const gameMessagesEl = document.getElementById('game-messages');
const startButton = document.getElementById('start-button');
const swapButton = document.getElementById('swap-button');
const playButton = document.getElementById('play-button');
const takePileButton = document.getElementById('take-pile-button');
const restartButton = document.getElementById('restart-button');

// Contadores de cartas
const player1HandCountEl = document.getElementById('player1-hand-count');
const player1FaceDownCountEl = document.getElementById('player1-face-down-count');
const player2HandCountEl = document.getElementById('player2-hand-count');
const player2FaceDownCountEl = document.getElementById('player2-face-down-count');
const deckCountEl = document.getElementById('deck-count');
const discardCountEl = document.getElementById('discard-count');


// 2. Funciones de Lógica del Juego

// Baraja las cartas
function createDeck() {
    deck = [];
    for (const suit of suits) {
        for (const value of values) {
            let type = 'number';
            if (['J', 'Q', 'K', 'A'].includes(value)) {
                type = 'face';
            }
            if (value === '2') {
                type = 'two';
            }
            if (value === '10') {
                type = 'ten';
            }
            deck.push({ value, suit, type });
        }
    }
    // Opcional: Añadir Jokers si se desean
    // deck.push({ value: 'Joker', suit: 'None', type: 'joker' });
    // deck.push({ value: 'Joker', suit: 'None', type: 'joker' });
}

// Mezcla el mazo
function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]; // Intercambio de elementos
    }
}

// Reparte las cartas iniciales
function dealCards() {
    for (const playerKey in players) {
        const player = players[playerKey];
        player.hand = deck.splice(0, 6); // 6 cartas en mano
        player.faceUp = deck.splice(0, 3); // 3 cartas boca arriba
        player.faceDown = deck.splice(0, 3); // 3 cartas boca abajo
    }
}

// Actualiza los contadores de cartas en la UI
function updateCardCounts() {
    player1HandCountEl.textContent = players.player1.hand.length;
    player1FaceDownCountEl.textContent = players.player1.faceDown.length;
    player2HandCountEl.textContent = players.player2.hand.length;
    player2FaceDownCountEl.textContent = players.player2.faceDown.length;
    deckCountEl.textContent = deck.length;
    discardCountEl.textContent = discardPile.length;
}

// Muestra mensajes en el área de mensajes
function displayMessage(msg, isError = false) {
    clearTimeout(messageTimeout); // Limpiar cualquier timeout anterior
    gameMessagesEl.textContent = msg;
    gameMessagesEl.style.backgroundColor = isError ? '#ffdddd' : '#e0f7fa'; // Rojo para error, azul para normal
    gameMessagesEl.style.color = isError ? '#d32f2f' : '#00796b';
    messageTimeout = setTimeout(() => {
        gameMessagesEl.textContent = '';
        gameMessagesEl.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; // Volver al color original
        gameMessagesEl.style.color = '#b3e5fc';
    }, 5000); // El mensaje desaparece después de 5 segundos
}

// Deshabilita/habilita botones según el estado del juego
function updateButtonStates() {
    startButton.disabled = gameState !== 'setup';
    swapButton.disabled = !(gameState === 'setup' && players.player1.selectedCards.length > 0);
    playButton.disabled = !(gameState === 'playing' && players.player1.isTurn && players.player1.selectedCards.length > 0);
    takePileButton.disabled = !(gameState === 'playing' && players.player1.isTurn && !canPlayCard(players.player1.selectedCards) && players.player1.selectedCards.length === 0);
    restartButton.disabled = false; // El botón de reiniciar siempre está habilitado
}

// Determina el valor numérico de una carta para comparaciones
function getCardRank(card) {
    if (card.type === 'joker') return 15; // Joker es la más alta (ajustable)
    if (card.type === 'two') return 14; // El 2 es la segunda más alta
    if (card.type === 'ten') return 13; // El 10 es la tercera más alta
    const rankValues = { 'J': 11, 'Q': 12, 'K': 13, 'A': 14 }; // As como alto por defecto
    return rankValues[card.value] || parseInt(card.value);
}

// Compara dos cartas o la última carta de la pila de descarte
function compareCards(cardToPlay, targetCard) {
    const rankToPlay = getCardRank(cardToPlay);
    const rankTarget = getCardRank(targetCard);

    // Reglas especiales
    if (cardToPlay.type === 'two') return true; // Un 2 siempre se puede jugar
    if (cardToPlay.type === 'ten') return true; // Un 10 siempre se puede jugar
    if (cardToPlay.type === 'joker') return true; // Un Joker siempre se puede jugar

    return rankToPlay >= rankTarget;
}

// Determina si una selección de cartas es válida para jugar
function isValidPlay(cards) {
    if (cards.length === 0) return false;

    // Todas las cartas deben tener el mismo valor para ser jugadas juntas
    const firstCardValue = cards[0].value;
    const allSameValue = cards.every(card => card.value === firstCardValue);
    if (!allSameValue) {
        displayMessage('Solo puedes jugar cartas del mismo valor.', true);
        return false;
    }

    // Reglas de juego (superar la última carta del descarte)
    if (discardPile.length > 0) {
        const topDiscardCard = discardPile[discardPile.length - 1];
        if (!compareCards(cards[0], topDiscardCard)) { // Solo necesitamos comparar la primera carta seleccionada
            displayMessage(`Debes jugar una carta igual o superior a ${topDiscardCard.value}.`, true);
            return false;
        }
    }
    return true;
}

// Determina si un jugador puede jugar alguna carta (para habilitar el botón "Tomar Descarte")
function canPlayCard(selectedCards) {
    // Si ya hay cartas seleccionadas, verificar si esa selección es válida
    if (selectedCards.length > 0) {
        return isValidPlay(selectedCards);
    }
    
    // Si no hay cartas seleccionadas, verificar si hay CUALQUIER carta jugable
    const p = players[currentPlayer];
    const cardsToCheck = [...p.hand, ...p.faceUp];
    const topDiscardCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

    for (const card of cardsToCheck) {
        // Si no hay pila de descarte o la carta es jugable, entonces el jugador puede jugar
        if (!topDiscardCard || compareCards(card, topDiscardCard)) {
            return true;
        }
    }
    return false; // No hay cartas jugables
}


// Lógica para jugar una carta
async function playCard(card, area, cardEl) {
    const player = players.player1;

    // Deseleccionar si ya estaba seleccionada
    const index = player.selectedCards.findIndex(c => c.value === card.value && c.suit === card.suit);
    if (index > -1) {
        player.selectedCards.splice(index, 1);
        cardEl.classList.remove('selected-for-swap');
    } else {
        // Solo permitir seleccionar si es la fase correcta de la mano/boca arriba
        if (player.hand.length > 0 && area === 'hand') {
            player.selectedCards.push(card);
            cardEl.classList.add('selected-for-swap');
        } else if (player.hand.length === 0 && player.faceUp.length > 0 && area === 'faceUp') {
            player.selectedCards.push(card);
            cardEl.classList.add('selected-for-swap');
        } else if (player.hand.length === 0 && player.faceUp.length === 0 && player.faceDown.length > 0 && area === 'faceDown' && deck.length === 0) {
            // Solo una carta boca abajo a la vez
            if (player.selectedCards.length === 0) {
                player.selectedCards.push(card);
                cardEl.classList.add('selected-for-swap');
            } else {
                displayMessage('Solo puedes revelar una carta boca abajo a la vez.', true);
            }
        } else {
            displayMessage('No puedes seleccionar cartas de esta área en este momento.', true);
        }
    }
    updateButtonStates();
    renderCards(); // Volver a renderizar para actualizar el estado visual
}


// Ejecuta la jugada de cartas seleccionadas
async function executePlay() {
    const player = players.player1;
    let cardsToPlay = player.selectedCards;

    if (cardsToPlay.length === 0) {
        displayMessage('Por favor, selecciona al menos una carta para jugar.', true);
        return;
    }

    // Ordenar las cartas a jugar para verificar si son del mismo valor
    cardsToPlay.sort((a, b) => getCardRank(a) - getCardRank(b));

    // Si se está jugando una carta boca abajo
    if (player.hand.length === 0 && player.faceUp.length === 0 && cardsToPlay[0].dataset.area === 'faceDown') {
        const revealedCard = cardsToPlay[0];
        const originalCardIndex = player.faceDown.findIndex(c => c.value === revealedCard.value && c.suit === revealedCard.suit);
        
        // Simular que la carta boca abajo se "revela" para la comparación
        // Temporalmente la hacemos visible para la lógica de isValidPlay
        // No la movemos aún de player.faceDown

        // Si la carta revelada NO es válida, el jugador debe tomar toda la pila
        if (!isValidPlay([revealedCard])) {
            displayMessage(`Tu carta boca abajo (${revealedCard.value} de ${revealedCard.suit}) no es válida. Tomas el descarte.`, true);
            await sleep(1000); // Pausa para que el mensaje sea visible

            // Mover la carta revelada de faceDown a mano antes de tomar el descarte
            player.hand.push(player.faceDown.splice(originalCardIndex, 1)[0]);
            takeDiscardPile(player);
            endTurn(); // Termina el turno del jugador
            return; // Terminar la función aquí
        } else {
            // Si la carta revelada ES válida, se juega y el turno continúa
            displayMessage(`Tu carta boca abajo (${revealedCard.value} de ${revealedCard.suit}) es válida.`, false);
            await sleep(1000); // Pausa para que el mensaje sea visible
            // Eliminar la carta de faceDown
            player.faceDown.splice(originalCardIndex, 1);
            // Añadirla a discardPile
            discardPile.push(revealedCard);
            // Limpiar la selección
            player.selectedCards = [];
            player.cardsPlayedThisTurn = [revealedCard]; // Registrar la carta jugada
            handleSpecialCards(revealedCard, player); // Manejar efectos de cartas especiales
            renderCards(); // Renderizar con la carta jugada
            // El turno no termina si la carta boca abajo fue válida
        }

    } else { // Jugar desde mano o boca arriba
        if (!isValidPlay(cardsToPlay)) {
            // displayMessage se maneja dentro de isValidPlay
            return;
        }

        // Mover cartas de la mano/boca arriba al descarte
        for (const card of cardsToPlay) {
            let found = false;
            // Intentar eliminar de la mano
            let index = player.hand.findIndex(c => c.value === card.value && c.suit === card.suit);
            if (index > -1) {
                player.hand.splice(index, 1);
                found = true;
            } else {
                // Si no está en la mano, intentar eliminar de boca arriba
                index = player.faceUp.findIndex(c => c.value === card.value && c.suit === card.suit);
                if (index > -1) {
                    player.faceUp.splice(index, 1);
                    found = true;
                }
            }
            if (found) {
                discardPile.push(card);
            }
        }
        player.cardsPlayedThisTurn = cardsToPlay; // Guardar las cartas jugadas
        handleSpecialCards(cardsToPlay[cardsToPlay.length - 1], player); // Manejar efectos de la última carta jugada
    }
    
    player.selectedCards = []; // Limpiar selección
    dealCardsToPlayer(player); // Repartir al jugador hasta 6 cartas si es posible
    renderCards();
    checkWinCondition();
    
    // Si el turno no terminó por carta especial, pasamos al siguiente
    if (currentPlayer === 'player1') { // Solo pasar el turno si es el turno del jugador y no fue carta especial
        // Si no fue un 10 o 2, cambiar turno
        if (!(player.cardsPlayedThisTurn[0].type === 'ten' || player.cardsPlayedThisTurn[0].type === 'two')) {
            endTurn();
        } else {
            displayMessage(`¡Jugaste un ${player.cardsPlayedThisTurn[0].value}! Juega de nuevo.`);
        }
    }
}


// Repartir cartas a un jugador hasta tener 6 o agotar el mazo
function dealCardsToPlayer(player) {
    while (player.hand.length < 6 && deck.length > 0) {
        player.hand.push(deck.shift());
    }
}

// Lógica de tomar el descarte
function takeDiscardPile(player) {
    displayMessage(`${player === players.player1 ? '¡Tomaste' : 'La IA tomó'} la pila de descarte!`);
    player.hand.push(...discardPile);
    discardPile = [];
    player.selectedCards = []; // Limpiar cualquier selección pendiente
    renderCards();
    // Después de tomar el descarte, el turno no cambia, el jugador que tomó sigue jugando
    // Hasta que pueda jugar una carta válida o no le queden cartas jugables
}

// Manejo de cartas especiales (2, 10, etc.)
function handleSpecialCards(lastCardPlayed, player) {
    if (lastCardPlayed.type === 'two') {
        // El jugador actual juega de nuevo
        displayMessage(`¡Un 2! ${player === players.player1 ? 'Juegas' : 'La IA juega'} de nuevo.`);
        // No se cambia el currentPlayer
    } else if (lastCardPlayed.type === 'ten') {
        // La pila de descarte se vacía y se retira del juego
        displayMessage(`¡Un 10! La pila de descarte se quema.`);
        discardPile = []; // Vacía la pila de descarte
        // El jugador actual juega de nuevo
        // No se cambia el currentPlayer
    } else if (lastCardPlayed.type === 'joker') {
        displayMessage(`¡Joker! ${player === players.player1 ? 'Juegas' : 'La IA juega'} de nuevo.`);
        // El jugador actual juega de nuevo
    }
    // Otras reglas de cartas especiales aquí
}


// Finaliza el turno y lo pasa al siguiente jugador
function endTurn() {
    players.player1.isTurn = !players.player1.isTurn;
    players.player2.isTurn = !players.player2.isTurn;
    
    players.player1.selectedCards = []; // Limpiar selección al cambiar de turno
    players.player2.selectedCards = [];

    renderCards(); // Actualizar UI
    
    if (players.player2.isTurn) {
        displayMessage('Turno de la IA...');
        setTimeout(aiTurn, 1500); // Retraso para el turno de la IA
    } else {
        displayMessage('Tu turno.');
    }
}

// Lógica del turno de la IA
async function aiTurn() {
    const ai = players.player2;
    const topDiscardCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

    let playableCards = [];

    // Prioridad 1: Jugar desde la mano
    if (ai.hand.length > 0) {
        playableCards = ai.hand.filter(card => !topDiscardCard || compareCards(card, topDiscardCard));
    }
    
    // Prioridad 2: Si la mano está vacía, jugar desde boca arriba
    if (playableCards.length === 0 && ai.hand.length === 0 && ai.faceUp.length > 0) {
        playableCards = ai.faceUp.filter(card => !topDiscardCard || compareCards(card, topDiscardCard));
    }

    if (playableCards.length > 0) {
        // La IA juega la carta más baja posible que sea válida
        playableCards.sort((a, b) => getCardRank(a) - getCardRank(b));
        const cardToPlay = playableCards[0];

        // Mover la carta de la mano/boca arriba al descarte
        let cardIndex;
        if (ai.hand.length > 0) {
            cardIndex = ai.hand.findIndex(c => c.value === cardToPlay.value && c.suit === cardToPlay.suit);
            if (cardIndex > -1) {
                ai.hand.splice(cardIndex, 1);
            }
        } else { // Debe estar en faceUp
            cardIndex = ai.faceUp.findIndex(c => c.value === cardToPlay.value && c.suit === cardToPlay.suit);
            if (cardIndex > -1) {
                ai.faceUp.splice(cardIndex, 1);
            }
        }
        discardPile.push(cardToPlay);
        ai.cardsPlayedThisTurn = [cardToPlay];
        displayMessage(`La IA jugó ${cardToPlay.value} de ${cardToPlay.suit}.`);
        await sleep(1000); // Pausa para ver la jugada

        handleSpecialCards(cardToPlay, ai);
        dealCardsToPlayer(ai); // La IA también roba cartas si es posible
        renderCards();
        checkWinCondition();

        // Si la IA jugó un 10 o 2, juega de nuevo
        if (cardToPlay.type === 'ten' || cardToPlay.type === 'two' || cardToPlay.type === 'joker') {
            await sleep(1000);
            aiTurn(); // La IA tiene otro turno
        } else {
            endTurn(); // Pasar el turno
        }

    } else {
        // La IA no puede jugar, toma el descarte
        if (ai.hand.length === 0 && ai.faceUp.length === 0 && ai.faceDown.length > 0 && deck.length === 0) {
            // Si la IA solo tiene cartas boca abajo y el mazo está vacío, revela una boca abajo
            const revealedCard = ai.faceDown[Math.floor(Math.random() * ai.faceDown.length)]; // Revela una al azar
            const originalCardIndex = ai.faceDown.findIndex(c => c.value === revealedCard.value && c.suit === revealedCard.suit);

            if (!topDiscardCard || compareCards(revealedCard, topDiscardCard)) {
                // Si la carta boca abajo es válida, la juega
                displayMessage(`La IA reveló y jugó ${revealedCard.value} de ${revealedCard.suit} (boca abajo).`);
                await sleep(1000);
                ai.faceDown.splice(originalCardIndex, 1);
                discardPile.push(revealedCard);
                ai.cardsPlayedThisTurn = [revealedCard];
                handleSpecialCards(revealedCard, ai);
                renderCards();
                checkWinCondition();
                if (!(revealedCard.type === 'ten' || revealedCard.type === 'two' || revealedCard.type === 'joker')) {
                    endTurn();
                } else {
                    await sleep(1000);
                    aiTurn(); // La IA tiene otro turno si jugó especial
                }
            } else {
                // Si la carta boca abajo NO es válida, la IA toma el descarte
                displayMessage(`La IA reveló ${revealedCard.value} de ${revealedCard.suit} (boca abajo) y no puede jugar. Toma el descarte.`);
                await sleep(1000);
                ai.hand.push(ai.faceDown.splice(originalCardIndex, 1)[0]); // La carta revelada va a la mano
                takeDiscardPile(ai);
                // Si la IA tomó la pila, sigue siendo su turno
                await sleep(1000); // Pausa
                aiTurn(); // La IA intenta jugar de nuevo
            }
        } else {
            // La IA toma el descarte si no tiene jugadas válidas
            takeDiscardPile(ai);
            await sleep(1000); // Pausa
            aiTurn(); // La IA intenta jugar de nuevo después de tomar el descarte
        }
    }
}


// Comprueba las condiciones de victoria
function checkWinCondition() {
    for (const playerKey in players) {
        const player = players[playerKey];
        if (player.hand.length === 0 && player.faceUp.length === 0 && player.faceDown.length === 0) {
            displayMessage(`${playerKey === 'player1' ? '¡Ganaste!' : 'La IA ganó!'}`, false);
            gameState = 'gameOver';
            updateButtonStates();
            return true;
        }
    }
    return false;
}

// Pausa la ejecución por un número de milisegundos
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 3. Renderizar las Cartas en la UI
function renderCards() {
    // Limpiar áreas antes de renderizar de nuevo
    player1HandEl.innerHTML = '';
    player1FaceUpEl.innerHTML = '';
    player1FaceDownEl.innerHTML = '';
    player2HandEl.innerHTML = '';
    player2FaceUpEl.innerHTML = '';
    player2FaceDownEl.innerHTML = '';
    discardPileEl.innerHTML = '';

    // Renderizar cartas del Jugador 1
    players.player1.hand.forEach(card => player1HandEl.appendChild(createCardElement(card, 'player1', 'hand', players.player1.isTurn && gameState === 'playing' ? players.player1.selectedCards.includes(card) : false)));
    players.player1.faceUp.forEach(card => player1FaceUpEl.appendChild(createCardElement(card, 'player1', 'faceUp', players.player1.isTurn && gameState === 'playing' ? players.player1.selectedCards.includes(card) : false)));
    players.player1.faceDown.forEach(card => player1FaceDownEl.appendChild(createCardElement(card, 'player1', 'faceDown', true))); // Siempre oculta

    // Renderizar cartas del Jugador 2 (IA)
    players.player2.hand.forEach(card => player2HandEl.appendChild(createCardElement(card, 'player2', 'hand', true))); // Siempre oculta
    players.player2.faceUp.forEach(card => player2FaceUpEl.appendChild(createCardElement(card, 'player2', 'faceUp', false))); // Visible
    players.player2.faceDown.forEach(card => player2FaceDownEl.appendChild(createCardElement(card, 'player2', 'faceDown', true))); // Siempre oculta

    // Renderizar solo la última carta del montón de descarte
    if (discardPile.length > 0) {
        discardPileEl.appendChild(createCardElement(discardPile[discardPile.length - 1], 'discard', 'top', false));
    }
    updateButtonStates(); // Actualizar el estado de los botones cada vez que se renderiza
    updateCardCounts(); // ¡Actualizar contadores de cartas!
}

// 5. Crear elemento HTML de una carta (con gestión de clics)
function createCardElement(card, owner, area, isHidden = false) {
    const cardEl = document.createElement('div');
    cardEl.classList.add('card');

    // Mapeo de palos a sus símbolos Unicode
    const suitSymbols = {
        'Hearts': '♥',
        'Diamonds': '♦',
        'Clubs': '♣',
        'Spades': '♠',
        'None': '' // Para Jokers o cartas sin palo
    };
    const symbol = suitSymbols[card.suit] || '';
    const isRedSuit = (card.suit === 'Hearts' || card.suit === 'Diamonds');

    if (isHidden) {
        cardEl.classList.add('hidden');
        cardEl.textContent = ''; // No mostrar valor si está oculta
    } else {
        // --- Estructura para cartas de póker reales ---
        // Valor en las esquinas
        const valueCornerHtml = `
            <div class="value-corner ${isRedSuit ? 'red-symbol' : 'black-symbol'}">${card.value}</div>
            <div class="suit-corner ${isRedSuit ? 'red-symbol' : 'black-symbol'}">${symbol}</div>
        `;

        cardEl.innerHTML += `<div class="corner-top">${valueCornerHtml}</div>`;
        cardEl.innerHTML += `<div class="corner-bottom">${valueCornerHtml}</div>`;

        // Símbolos centrales (dependiendo del valor)
        if (['A', 'J', 'Q', 'K'].includes(card.value) || card.type === 'joker') {
            // Ases y figuras: un solo símbolo grande en el centro
            if (card.type === 'joker') {
                // Para el Joker, podemos poner una estrella o un símbolo especial
                cardEl.innerHTML += `<div class="suit-center ${isRedSuit ? 'red-symbol' : 'black-symbol'}">★</div>`; // Símbolo de estrella para Joker
            } else {
                cardEl.innerHTML += `<div class="suit-center ${isRedSuit ? 'red-symbol' : 'black-symbol'}">${symbol}</div>`;
            }
        } else {
            // Cartas numéricas (2-10): múltiples símbolos en una cuadrícula
            cardEl.classList.add('multi-symbol'); // Clase para estilos de cuadrícula
            const numSymbols = parseInt(card.value, 10);
            let symbolsHtml = '';
            // Ajustar la disposición de los símbolos para números (ej. para 9, 3x3)
            // Esto es un enfoque simplificado, para un control preciso se necesitaría CSS Grid más complejo o SVGs.
            for (let i = 0; i < numSymbols; i++) {
                symbolsHtml += `<span class="symbol-small ${isRedSuit ? 'red-symbol' : 'black-symbol'}">${symbol}</span>`;
            }
            cardEl.innerHTML += `<div class="suit-grid">${symbolsHtml}</div>`;
        }

        // Aplicar el color principal a toda la carta si es roja
        if (isRedSuit) {
            cardEl.classList.add('red');
        }
    }
    
    // Añadir data-attributes para identificar la carta al hacer clic
    cardEl.dataset.value = card.value;
    cardEl.dataset.suit = card.suit;
    cardEl.dataset.type = card.type;
    cardEl.dataset.owner = owner; // 'player1' o 'player2'
    cardEl.dataset.area = area; // 'hand', 'faceUp', 'faceDown'

    // --- Lógica de Clics para el Jugador 1 ---
    if (owner === 'player1') {
        if (gameState === 'setup' && (area === 'hand' || area === 'faceUp')) {
            cardEl.addEventListener('click', () => handleSetupClick(card, area, cardEl));
        } else if (gameState === 'playing' && players.player1.isTurn) {
            const p1 = players.player1;
            // Asegurarse de que el jugador SOLO puede hacer clic en la fase de juego actual
            let canClick = false;
            if (area === 'hand' && p1.hand.length > 0) {
                canClick = true;
            } else if (area === 'faceUp' && p1.hand.length === 0 && p1.faceUp.length > 0) {
                canClick = true;
            }
            // Habilitar clic en cartas boca abajo SOLO si mano y boca arriba están vacías Y el mazo está agotado
            else if (area === 'faceDown' && p1.hand.length === 0 && p1.faceUp.length === 0 && deck.length === 0 && p1.faceDown.length > 0) {
                canClick = true;
            }

            if (canClick) {
                cardEl.addEventListener('click', () => playCard(card, area, cardEl));
            } else {
                cardEl.classList.add('disabled'); // Deshabilitar si no es la fase correcta
            }
        } else {
             // Deshabilita clics para cartas del jugador 1 si no es su turno o no es la fase adecuada
            cardEl.classList.add('disabled');
        }
    }
    // -------------------------------------------------------------------------
    return cardEl;
}

// 6. Funciones de Configuración (Setup Phase)
function handleSetupClick(card, area, cardEl) {
    const player = players.player1;

    // Alternar selección de la carta
    const index = player.selectedCards.findIndex(c => c.value === card.value && c.suit === card.suit);
    if (index > -1) {
        player.selectedCards.splice(index, 1);
        cardEl.classList.remove('selected-for-swap');
    } else {
        // Permitir solo 3 cartas seleccionadas en la mano o boca arriba
        if (player.selectedCards.length < 3) {
            player.selectedCards.push(card);
            cardEl.classList.add('selected-for-swap');
        } else {
            displayMessage('Solo puedes seleccionar 3 cartas para intercambiar.', true);
        }
    }
    updateButtonStates();
}

function swapCards() {
    const player = players.player1;
    if (player.selectedCards.length !== 3) {
        displayMessage('Debes seleccionar exactamente 3 cartas para intercambiar.', true);
        return;
    }

    // Identificar qué cartas son de la mano y cuáles son boca arriba
    const selectedFromHand = player.selectedCards.filter(c => player.hand.some(hc => hc.value === c.value && hc.suit === c.suit));
    const selectedFromFaceUp = player.selectedCards.filter(c => player.faceUp.some(fuc => fuc.value === c.value && fuc.suit === c.suit));

    if (selectedFromHand.length === 0 || selectedFromFaceUp.length === 0) {
        displayMessage('Debes seleccionar cartas tanto de tu mano como de tus cartas boca arriba.', true);
        return;
    }

    // Realizar el intercambio
    selectedFromHand.forEach(card => {
        const indexHand = player.hand.findIndex(c => c.value === card.value && c.suit === card.suit);
        player.hand.splice(indexHand, 1);
        player.faceUp.push(card);
    });

    selectedFromFaceUp.forEach(card => {
        const indexFaceUp = player.faceUp.findIndex(c => c.value === card.value && c.suit === card.suit);
        player.faceUp.splice(indexFaceUp, 1);
        player.hand.push(card);
    });

    player.selectedCards = []; // Limpiar selección
    displayMessage('¡Cartas intercambiadas! Haz clic en "Iniciar Juego" para comenzar.');
    renderCards();
    updateButtonStates(); // Actualizar botones después del intercambio
}


// 7. Funciones de Inicialización
function initializeGame() {
    createDeck();
    shuffleDeck();
    dealCards();
    discardPile = [deck.shift()]; // La primera carta del mazo al descarte
    players.player1.isTurn = true; // El jugador 1 siempre empieza
    gameState = 'setup'; // Inicia en fase de configuración
    displayMessage('Selecciona 3 cartas de tu mano y 3 de tus cartas boca arriba para intercambiar. Luego haz clic en "Intercambiar Cartas".');
    renderCards(); // Renderiza el estado inicial
}

// 8. Event Listeners
startButton.addEventListener('click', () => {
    if (gameState === 'setup') {
        gameState = 'playing';
        displayMessage('¡Juego iniciado! Es tu turno.');
        players.player1.selectedCards = []; // Limpiar selecciones de setup
        renderCards();
    }
});

swapButton.addEventListener('click', swapCards);

playButton.addEventListener('click', executePlay);

takePileButton.addEventListener('click', () => {
    takeDiscardPile(players.player1);
    // Después de tomar la pila, el jugador debe intentar jugar de nuevo
    displayMessage('Has tomado la pila. Intenta jugar una carta.');
});

restartButton.addEventListener('click', () => {
    // Restablecer todas las variables de juego a su estado inicial
    deck = [];
    discardPile = [];
    players.player1 = { hand: [], faceUp: [], faceDown: [], isTurn: false, selectedCards: [], cardsPlayedThisTurn: [], hasToBeatValue: null };
    players.player2 = { hand: [], faceUp: [], faceDown: [], isTurn: false, selectedCards: [], cardsPlayedThisTurn: [], hasToBeatValue: null };
    gameState = 'setup';
    currentPlayer = 'player1';
    
    // Limpiar mensajes y contadores
    gameMessagesEl.textContent = '';
    updateCardCounts();
    renderCards(); // Limpiar el display de cartas
    
    // Reiniciar el juego
    initializeGame();
    displayMessage('Juego reiniciado. Selecciona 3 cartas de tu mano y 3 de tus cartas boca arriba para intercambiar.');
});

// Inicializar el juego al cargar la página
initializeGame();
