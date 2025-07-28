// --- Game State Variables ---
let deck = [];
let discardPile = [];
let player1Hand = [];
let player1FaceUp = [];
let player1FaceDown = [];
let player1SwapZone = []; // This zone now receives the cards that end up face-down (from the "full interchange")
let player1ExchangeSelection = []; // Holds the 3 cards from the hand that the player chose to potentially send face-down

let player2Hand = [];
let player2FaceUp = [];
let player2FaceDown = [];

let currentPlayer = 1;
let gameStarted = false;
let setupPhase = true;

// This will now strictly manage the two cards selected for the 'full interchange'
let selectedCardsForFullInterchange = {
    cardToKeepInHand: null, // Card chosen from player1ExchangeSelection (to move to player1Hand)
    cardFromHandToFaceDown: null // Card chosen from player1Hand (to move to player1FaceDown)
};

// For the original Hand <-> Face Up swap
let selectedCardsForHandFaceUpSwap = {
    hand: null,
    faceUp: null
};


// --- DOM Elements ---
const gameMessages = document.getElementById('game-messages');
const player1HandEl = document.getElementById('player1-hand');
const player1HandCountEl = document.getElementById('player1-hand-count');
const player1FaceUpEl = document.getElementById('player1-face-up');
const player1FaceDownEl = document.getElementById('player1-face-down');
const player1FaceDownCountEl = document.getElementById('player1-face-down-count');

const player1SwapZoneEl = document.getElementById('player1-swap-container');
const player1SwapCountEl = document.getElementById('player1-swap-count');

const player1ExchangeSelectionEl = document.getElementById('player1-exchange-selection-container');
const player1ExchangeSelectionCountEl = document.getElementById('player1-exchange-selection-count');


const player2HandEl = document.getElementById('player2-hand');
const player2HandCountEl = document.getElementById('player2-hand-count');
const player2FaceUpEl = document.getElementById('player2-face-up');
const player2FaceDownEl = document.getElementById('player2-face-down');
const player2FaceDownCountEl = document.getElementById('player2-face-down-count');

const deckCountEl = document.getElementById('deck-count');
const discardCountEl = document.getElementById('discard-count');
const discardPileEl = document.getElementById('discard-pile');

const startButton = document.getElementById('start-button');
const swapButton = document.getElementById('swap-button'); // Intercambiar Mano/Boca Arriba
const playButton = document.getElementById('play-button');
const takePileButton = document.getElementById('take-pile-button');
const restartButton = document.getElementById('restart-button');
const confirmFullSwapButton = document.getElementById('confirm-full-swap-button'); // Botón para el "intercambio completo"

const selectFirstThreeButton = document.getElementById('select-first-three-button');
const selectSecondThreeButton = document.getElementById('select-second-three-button');

// --- Card Class --- (No changes needed here)
class Card {
    constructor(suit, rank) {
        this.suit = suit;
        this.rank = rank;
        this.value = this.getCardValue();
        this.id = `${suit}-${rank}`;
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

    createCardElement(isFaceDown = false) {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card');
        cardDiv.dataset.id = this.id;

        if (isFaceDown) {
            cardDiv.classList.add('hidden');
        } else {
            const rankDisplay = (this.rank === '10') ? 'T' : this.rank;
            const suitSymbol = this.getSuitSymbol();
            const colorClass = (this.suit === 'hearts' || this.suit === 'diamonds') ? 'red-symbol' : 'black-symbol';

            cardDiv.innerHTML = `
                <div class="corner-top">
                    <span class="value-corner">${rankDisplay}</span>
                    <span class="suit-corner ${colorClass}">${suitSymbol}</span>
                </div>
                ${this.rank.match(/^[2-9]$/) ? `<div class="suit-grid">` + `<span class="symbol-small ${colorClass}">${suitSymbol}</span>`.repeat(this.rank) + `</div>` : `<span class="suit-center ${colorClass}">${suitSymbol}</span>`}
                <div class="corner-bottom">
                    <span class="value-corner">${rankDisplay}</span>
                    <span class="suit-corner ${colorClass}">${suitSymbol}</span>
                </div>
            `;
            if (this.rank.match(/^[2-9]$/)) {
                cardDiv.classList.add('multi-symbol');
            }
        }
        return cardDiv;
    }
}

// --- Game Functions ---

function createDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let newDeck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            newDeck.push(new Card(suit, rank));
        }
    }
    return newDeck;
}

function shuffleDeck(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // ES6 swap
    }
}

function dealInitialCards() {
    // Clear previous hands
    player1Hand = [];
    player1FaceUp = [];
    player1FaceDown = [];
    player1SwapZone = [];
    player1ExchangeSelection = [];
    player2Hand = [];
    player2FaceUp = [];
    player2FaceDown = [];

    // Deal 3 face-down, 3 face-up, 6 hand cards to player 1
    for (let i = 0; i < 3; i++) {
        player1FaceDown.push(deck.pop());
        player2FaceDown.push(deck.pop());
    }
    for (let i = 0; i < 3; i++) {
        player1FaceUp.push(deck.pop());
        player2FaceUp.push(deck.pop());
    }
    for (let i = 0; i < 6; i++) { // Deal 6 cards to player 1's hand for 'second three' option
        player1Hand.push(deck.pop());
        player2Hand.push(deck.pop()); // AI also gets 6 for consistency (can be adjusted)
    }
    // Player 1's hand can be sorted to make 'first three' and 'second three' consistent
    player1Hand.sort((a, b) => a.value - b.value); // Example: sort by value
}

function renderUI() {
    // Render Player 1's cards
    renderCardArea(player1Hand, player1HandEl, 'player1-hand');
    renderCardArea(player1FaceUp, player1FaceUpEl, 'player1-face-up');
    renderCardArea(player1FaceDown, player1FaceDownEl, 'player1-face-down', true); // Face down
    renderCardArea(player1SwapZone, player1SwapZoneEl, 'player1-swap-zone', true); // Face down until game end or specific reveal

    // Render the new exchange selection zone
    renderCardArea(player1ExchangeSelection, player1ExchangeSelectionEl, 'player1-exchange-selection-zone');

    // Render Player 2's cards (AI - all hidden for now)
    renderCardArea(player2Hand, player2HandEl, 'player2-hand', true); // AI hand hidden
    renderCardArea(player2FaceUp, player2FaceUpEl, 'player2-face-up'); // AI face up shown
    renderCardArea(player2FaceDown, player2FaceDownEl, 'player2-face-down', true); // AI face down hidden

    // Update counts
    player1HandCountEl.textContent = player1Hand.length;
    player1FaceDownCountEl.textContent = player1FaceDown.length;
    player1SwapCountEl.textContent = player1SwapZone.length;
    player1ExchangeSelectionCountEl.textContent = player1ExchangeSelection.length;
    player2HandCountEl.textContent = player2Hand.length;
    player2FaceDownCountEl.textContent = player2FaceDown.length;
    deckCountEl.textContent = deck.length;
    discardCountEl.textContent = discardPile.length;

    // Render top of discard pile
    discardPileEl.innerHTML = '';
    if (discardPile.length > 0) {
        discardPileEl.appendChild(discardPile[discardPile.length - 1].createCardElement());
    }
}

function renderCardArea(cardArray, elementContainer, areaId, isFaceDown = false) {
    elementContainer.innerHTML = '';
    cardArray.forEach(card => {
        const cardEl = card.createCardElement(isFaceDown);
        cardEl.dataset.id = card.id;
        cardEl.dataset.area = areaId;

        // Apply click listeners based on the area and phase
        if (setupPhase) {
            if (areaId === 'player1-hand' || areaId === 'player1-face-up') {
                // These are for the original Hand <-> Face Up swap
                cardEl.addEventListener('click', (event) => handlePlayerCardClick(event, 'hand-faceup-swap'));
            } else if (areaId === 'player1-exchange-selection-zone') {
                // This is for selecting the card to keep in hand from the temporary zone
                cardEl.addEventListener('click', (event) => handlePlayerCardClick(event, 'full-interchange-selection-from-exchange-zone'));
            }
        }
        // During game phase, cards in hand would be clickable to play
        // (This part is not yet fully implemented but structure allows it)
        // else if (areaId === 'player1-hand') {
        //     cardEl.addEventListener('click', handlePlayerCardClickToPlay);
        // }


        elementContainer.appendChild(cardEl);

        // Add 'selected-for-swap' class if the card is currently selected
        if (areaId === 'player1-hand' && selectedCardsForHandFaceUpSwap.hand && selectedCardsForHandFaceUpSwap.hand.id === card.id) {
            cardEl.classList.add('selected-for-swap');
        } else if (areaId === 'player1-face-up' && selectedCardsForHandFaceUpSwap.faceUp && selectedCardsForHandFaceUpSwap.faceUp.id === card.id) {
            cardEl.classList.add('selected-for-swap');
        } else if (areaId === 'player1-exchange-selection-zone' && selectedCardsForFullInterchange.cardToKeepInHand && selectedCardsForFullInterchange.cardToKeepInHand.id === card.id) {
            cardEl.classList.add('selected-for-swap');
        } else if (areaId === 'player1-hand' && selectedCardsForFullInterchange.cardFromHandToFaceDown && selectedCardsForFullInterchange.cardFromHandToFaceDown.id === card.id) {
            cardEl.classList.add('selected-for-swap');
        }
    });
}

function updateGameMessage(message, type = 'info') {
    gameMessages.textContent = message;
    gameMessages.className = 'game-messages';
    gameMessages.classList.add(type);
}

// --- Event Handlers ---

function handleStartGame() {
    if (gameStarted) return;
    gameStarted = true;
    setupPhase = true;
    updateGameMessage('¡Juego iniciado! Primero, elige si quieres enviar las primeras 3 o las segundas 3 cartas de tu mano a la zona de intercambio temporal.');

    deck = createDeck();
    shuffleDeck(deck);
    dealInitialCards();
    renderUI();

    startButton.disabled = true;
    swapButton.disabled = false; // Original swap (hand <-> face-up) enabled
    selectFirstThreeButton.disabled = false; // Enable group selection buttons
    selectSecondThreeButton.disabled = false;
    confirmFullSwapButton.disabled = true; // Disabled until selection is made
    playButton.disabled = true;
    takePileButton.disabled = true;
    restartButton.disabled = false;
}

function handleRestartGame() {
    // Reset all game state
    deck = [];
    discardPile = [];
    player1Hand = [];
    player1FaceUp = [];
    player1FaceDown = [];
    player1SwapZone = [];
    player1ExchangeSelection = [];
    player2Hand = [];
    player2FaceUp = [];
    player2FaceDown = [];
    currentPlayer = 1;
    gameStarted = false;
    setupPhase = true;
    selectedCardsForFullInterchange = { cardToKeepInHand: null, cardFromHandToFaceDown: null };
    selectedCardsForHandFaceUpSwap = { hand: null, faceUp: null };


    // Clear UI
    player1HandEl.innerHTML = '';
    player1FaceUpEl.innerHTML = '';
    player1FaceDownEl.innerHTML = '';
    player1SwapZoneEl.innerHTML = '';
    player1ExchangeSelectionEl.innerHTML = '';
    player2HandEl.innerHTML = '';
    player2FaceUpEl.innerHTML = '';
    player2FaceDownEl.innerHTML = '';
    discardPileEl.innerHTML = '';

    // Update counts
    player1HandCountEl.textContent = '0';
    player1FaceDownCountEl.textContent = '0';
    player1SwapCountEl.textContent = '0';
    player1ExchangeSelectionCountEl.textContent = '0';
    player2HandCountEl.textContent = '0';
    player2FaceDownCountEl.textContent = '0';
    deckCountEl.textContent = '0';
    discardCountEl.textContent = '0';

    updateGameMessage('Presiona "Iniciar Juego" para comenzar una nueva partida.');

    // Reset button states
    startButton.disabled = false;
    swapButton.disabled = true;
    confirmFullSwapButton.disabled = true;
    playButton.disabled = true;
    takePileButton.disabled = true;
    restartButton.disabled = true;
    selectFirstThreeButton.disabled = true;
    selectSecondThreeButton.disabled = true;
}

// --- Main Player Card Click Handler (now unified) ---
function handlePlayerCardClick(event, clickType) {
    if (!setupPhase) {
        console.log('Game phase card click - not implemented yet');
        return;
    }

    const clickedCardEl = event.currentTarget;
    const cardId = clickedCardEl.dataset.id;
    const cardArea = clickedCardEl.dataset.area;

    let targetCard = null;
    let targetCollection = null; // The array where the card currently resides

    // Determine the card and its current collection
    if (cardArea === 'player1-hand') {
        targetCollection = player1Hand;
    } else if (cardArea === 'player1-face-up') {
        targetCollection = player1FaceUp;
    } else if (cardArea === 'player1-exchange-selection-zone') {
        targetCollection = player1ExchangeSelection;
    }

    targetCard = targetCollection.find(c => c.id === cardId);
    if (!targetCard) return;

    // --- Logic for Hand <-> Face Up Swap selection ---
    if (clickType === 'hand-faceup-swap') {
        if (player1ExchangeSelection.length > 0) { // If cards are already in the exchange selection zone, disable this swap
            updateGameMessage('Ya has movido cartas a la Zona de Selección de Intercambio. Completa ese proceso o reinicia.', 'error');
            return;
        }

        if (cardArea === 'player1-hand') {
            if (selectedCardsForHandFaceUpSwap.hand && selectedCardsForHandFaceUpSwap.hand.id === cardId) {
                selectedCardsForHandFaceUpSwap.hand = null;
            } else {
                selectedCardsForHandFaceUpSwap.hand = targetCard;
            }
        } else if (cardArea === 'player1-face-up') {
            if (selectedCardsForHandFaceUpSwap.faceUp && selectedCardsForHandFaceUpSwap.faceUp.id === cardId) {
                selectedCardsForHandFaceUpSwap.faceUp = null;
            } else {
                selectedCardsForHandFaceUpSwap.faceUp = targetCard;
            }
        }
        updateGameMessage(
            `Seleccionadas para Intercambio (Mano/Boca Arriba): Mano: ${selectedCardsForHandFaceUpSwap.hand ? selectedCardsForHandFaceUpSwap.hand.rank + selectedCardsForHandFaceUpSwap.hand.getSuitSymbol() : 'Ninguna'}, Boca Arriba: ${selectedCardsForHandFaceUpSwap.faceUp ? selectedCardsForHandFaceUpSwap.faceUp.rank + selectedCardsForHandFaceUpSwap.faceUp.getSuitSymbol() : 'Ninguna'}`
        );

    }
    // --- Logic for Full Interchange Selection (selecting which card from exchange zone to keep) ---
    else if (clickType === 'full-interchange-selection-from-exchange-zone') {
        if (player1ExchangeSelection.length === 0) {
            updateGameMessage('No hay cartas en la Zona de Selección de Intercambio para elegir.', 'error');
            return;
        }
        if (selectedCardsForFullInterchange.cardToKeepInHand && selectedCardsForFullInterchange.cardToKeepInHand.id === cardId) {
            selectedCardsForFullInterchange.cardToKeepInHand = null;
        } else {
            selectedCardsForFullInterchange.cardToKeepInHand = targetCard;
        }
        updateGameMessage(`Carta seleccionada para permanecer en la mano: ${selectedCardsForFullInterchange.cardToKeepInHand ? selectedCardsForFullInterchange.cardToKeepInHand.rank + selectedCardsForFullInterchange.cardToKeepInHand.getSuitSymbol() : 'Ninguna'}. Ahora, selecciona una carta de tu mano para enviar boca abajo.`);

        // Additionally, enable hand cards for selection for 'cardFromHandToFaceDown'
        // This is handled by renderCardArea's click listener.
    }
    // --- Logic for Full Interchange Selection (selecting which card from HAND to send face down) ---
    else if (clickType === 'full-interchange-selection-from-hand') {
        if (player1ExchangeSelection.length === 0) {
            updateGameMessage('Primero selecciona un grupo de cartas para la Zona de Selección de Intercambio.', 'error');
            return;
        }
        if (!selectedCardsForFullInterchange.cardToKeepInHand) {
            updateGameMessage('Primero selecciona la carta que quieres mantener de la Zona de Selección de Intercambio.', 'error');
            return;
        }

        if (selectedCardsForFullInterchange.cardFromHandToFaceDown && selectedCardsForFullInterchange.cardFromHandToFaceDown.id === cardId) {
            selectedCardsForFullInterchange.cardFromHandToFaceDown = null;
        } else {
            selectedCardsForFullInterchange.cardFromHandToFaceDown = targetCard;
        }
        updateGameMessage(`Carta de la mano para enviar boca abajo: ${selectedCardsForFullInterchange.cardFromHandToFaceDown ? selectedCardsForFullInterchange.cardFromHandToFaceDown.rank + selectedCardsForFullInterchange.cardFromHandToFaceDown.getSuitSymbol() : 'Ninguna'}. ¡Listo para confirmar!`);
    }

    renderUI(); // Re-render to update selection highlights
}

// --- Lógica para seleccionar grupo de 3 cartas de la mano ---
function handleSelectGroupForExchange(groupType) {
    if (!setupPhase || player1ExchangeSelection.length > 0) {
        updateGameMessage('Ya has seleccionado cartas para el intercambio, o no estás en la fase de preparación.', 'error');
        return;
    }

    let cardsToMove = [];
    if (groupType === 'first-three') {
        if (player1Hand.length < 3) {
            updateGameMessage('No tienes al menos 3 cartas en la mano para seleccionar las primeras 3.', 'error');
            return;
        }
        // Take the first 3 cards and remove them from player1Hand
        cardsToMove = player1Hand.splice(0, 3);
    } else if (groupType === 'second-three') {
        // Assuming player1Hand has been sorted, the 'second three' would be the next 3 after the first 3.
        // If hand has 6 cards, indices 0,1,2 are first three, indices 3,4,5 are second three.
        if (player1Hand.length < 6) {
            updateGameMessage('Necesitas al menos 6 cartas en la mano para seleccionar las segundas 3.', 'error');
            return;
        }
        // Take cards from index 3 (the 4th card) for 3 cards
        cardsToMove = player1Hand.splice(3, 3);
    }

    if (cardsToMove.length === 3) {
        player1ExchangeSelection.push(...cardsToMove); // Add the 3 cards to the temporary exchange selection zone
        updateGameMessage(`Has movido 3 cartas a la Zona de Selección de Intercambio. Ahora, haz clic en UNA de esas 3 para decidir cuál quieres que se quede en tu mano.`);

        selectFirstThreeButton.disabled = true;
        selectSecondThreeButton.disabled = true;
        // confirmFullSwapButton will be enabled after both cards are selected
        renderUI();
    } else {
        updateGameMessage('Error al seleccionar las cartas. Asegúrate de tener suficientes cartas en la mano.', 'error');
    }
}


// Original swap function: between Hand and Face-Up cards
function handleSwapCards() {
    if (!setupPhase) {
        updateGameMessage('Solo puedes intercambiar cartas durante la fase de preparación.', 'error');
        return;
    }

    const handCard = selectedCardsForHandFaceUpSwap.hand;
    const faceUpCard = selectedCardsForHandFaceUpSwap.faceUp;

    if (!handCard || !faceUpCard) {
        updateGameMessage('Para este intercambio (Mano/Boca Arriba), selecciona UNA carta de tu mano Y UNA de tus cartas boca arriba.', 'error');
        return;
    }

    const handIndex = player1Hand.findIndex(c => c.id === handCard.id);
    const faceUpIndex = player1FaceUp.findIndex(c => c.id === faceUpCard.id);

    if (handIndex > -1 && faceUpIndex > -1) {
        [player1Hand[handIndex], player1FaceUp[faceUpIndex]] = [player1FaceUp[faceUpIndex], player1Hand[handIndex]];
        updateGameMessage(`¡Cartas ${handCard.rank}${handCard.getSuitSymbol()} y ${faceUpCard.rank}${faceUpCard.getSuitSymbol()} intercambiadas!`);
    } else {
        updateGameMessage('Error al encontrar las cartas seleccionadas.', 'error');
    }

    selectedCardsForHandFaceUpSwap.hand = null;
    selectedCardsForHandFaceUpSwap.faceUp = null;
    renderUI();
}

// --- NEW FUNCTION: Handle the "Full Interchange" ---
function handleFullInterchange() {
    if (!setupPhase) {
        updateGameMessage('Este tipo de intercambio solo se puede realizar en la fase de preparación.', 'error');
        return;
    }

    const cardToKeepInHand = selectedCardsForFullInterchange.cardToKeepInHand;
    const cardFromHandToFaceDown = selectedCardsForFullInterchange.cardFromHandToFaceDown;

    if (player1ExchangeSelection.length !== 3) {
        updateGameMessage('La Zona de Selección de Intercambio debe contener exactamente 3 cartas antes de confirmar.', 'error');
        return;
    }

    if (!cardToKeepInHand || !cardFromHandToFaceDown) {
        updateGameMessage('Para el "Intercambio Completo", debes seleccionar: 1) una carta de la Zona de Selección de Intercambio (para quedártela) y 2) una carta de tu Mano (para enviarla boca abajo).', 'error');
        return;
    }

    const exchangeSelectionIndex = player1ExchangeSelection.findIndex(c => c.id === cardToKeepInHand.id);
    const handIndex = player1Hand.findIndex(c => c.id === cardFromHandToFaceDown.id);

    if (exchangeSelectionIndex === -1 || handIndex === -1) {
        updateGameMessage('Error interno al procesar las cartas seleccionadas para el intercambio completo.', 'error');
        return;
    }

    // STEP 1: Move the chosen card from player1ExchangeSelection to player1Hand
    player1Hand.push(player1ExchangeSelection.splice(exchangeSelectionIndex, 1)[0]);

    // STEP 2: Move the *remaining two* cards from player1ExchangeSelection to player1FaceDown
    // player1ExchangeSelection now only has the two cards that weren't selected to be kept.
    player1FaceDown.push(...player1ExchangeSelection.splice(0, player1ExchangeSelection.length)); // Splice all remaining (should be 2)

    // STEP 3: Move the chosen card from player1Hand to player1FaceDown
    player1FaceDown.push(player1Hand.splice(handIndex, 1)[0]);

    updateGameMessage(`¡Intercambio completo realizado! La carta ${cardToKeepInHand.rank}${cardToKeepInHand.getSuitSymbol()} volvió a tu mano. Las otras 2 cartas de la Zona de Selección y la carta ${cardFromHandToFaceDown.rank}${cardFromHandToFaceDown.getSuitSymbol()} de tu mano ahora están boca abajo.`);

    // Clear selections
    selectedCardsForFullInterchange.cardToKeepInHand = null;
    selectedCardsForFullInterchange.cardFromHandToFaceDown = null;
    player1ExchangeSelection = []; // Clear the temporary zone
    renderUI();

    endSetupPhaseForPlayer1();
}


function endSetupPhaseForPlayer1() {
    setupPhase = false;
    updateGameMessage('Fase de preparación terminada. ¡Es tu turno de jugar!');

    // Disable all setup-related buttons
    swapButton.disabled = true;
    confirmFullSwapButton.disabled = true;
    selectFirstThreeButton.disabled = true;
    selectSecondThreeButton.disabled = true;

    // Enable game-play buttons
    playButton.disabled = false;
    takePileButton.disabled = false;
}


// --- Main Game Turn Logic (To be expanded) ---
function handlePlayCard() {
    if (currentPlayer !== 1 || setupPhase) {
        updateGameMessage('No es tu turno o aún estás en fase de preparación.', 'error');
        return;
    }
    updateGameMessage('Jugador 1 va a jugar una carta (lógica pendiente)...');
}

function handleTakePile() {
    if (currentPlayer !== 1 || setupPhase) {
        updateGameMessage('No es tu turno o aún estás en fase de preparación.', 'error');
        return;
    }
    updateGameMessage('Jugador 1 va a tomar el descarte (lógica pendiente)...');
}

function simulatedPlayTurn() {
    updateGameMessage('Turno del Jugador 2 (IA)...');
    setTimeout(() => {
        updateGameMessage('Jugador 2 (IA) ha terminado su turno.');
        currentPlayer = 1;
        updateGameMessage('¡Es tu turno, Jugador 1!');
        playButton.disabled = false;
        takePileButton.disabled = false;
    }, 1500);
}


// --- Initialization ---
function initializeGame() {
    startButton.addEventListener('click', handleStartGame);
    swapButton.addEventListener('click', handleSwapCards);
    confirmFullSwapButton.addEventListener('click', handleFullInterchange);
    playButton.addEventListener('click', handlePlayCard);
    takePileButton.addEventListener('click', handleTakePile);
    restartButton.addEventListener('click', handleRestartGame);

    selectFirstThreeButton.addEventListener('click', () => handleSelectGroupForExchange('first-three'));
    selectSecondThreeButton.addEventListener('click', () => handleSelectGroupForExchange('second-three'));


    startButton.disabled = false;
    swapButton.disabled = true;
    confirmFullSwapButton.disabled = true;
    playButton.disabled = true;
    takePileButton.disabled = true;
    restartButton.disabled = true;
    selectFirstThreeButton.disabled = true;
    selectSecondThreeButton.disabled = true;

    updateGameMessage('Presiona "Iniciar Juego" para comenzar una nueva partida.');
}

document.addEventListener('DOMContentLoaded', initializeGame);
