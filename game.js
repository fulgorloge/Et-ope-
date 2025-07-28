// --- Game State Variables ---
let deck = [];
let discardPile = [];
let player1Hand = []; // This will temporarily hold all 9 initial cards for the lote selection
let player1FinalHand = []; // This will be the 3 cards chosen after the lote selection
let player1FaceUp = []; // Player 1's 3 face-up cards
let player1FaceDown = []; // Player 1's 6 face-down cards

let player2Hand = []; // AI's hand (hidden)
let player2FaceUp = []; // AI's face-up cards (visible)
let player2FaceDown = []; // AI's face-down cards (hidden)

let currentPlayer = 1;
let gameStarted = false;
let setupPhase = true;
let loteSelectionPhase = true; // New phase for the 3-lote selection
let currentBatchAttempt = 0; // 0: initial, 1: first, 2: second, 3: third (final)
let currentVisibleBatch = []; // Stores the 3 cards currently shown to the player for selection

// For the original Hand <-> Face Up swap (after lote selection)
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

// New element for showing the current batch during lote selection
const player1LoteSelectionEl = document.getElementById('player1-lote-selection');
const player1LoteSelectionCountEl = document.getElementById('player1-lote-selection-count');


const player2HandEl = document.getElementById('player2-hand');
const player2HandCountEl = document.getElementById('player2-hand-count');
const player2FaceUpEl = document.getElementById('player2-face-up');
const player2FaceDownEl = document.getElementById('player2-face-down');
const player2FaceDownCountEl = document.getElementById('player2-face-down-count');

const deckCountEl = document.getElementById('deck-count');
const discardCountEl = document.getElementById('discard-count');
const discardPileEl = document.getElementById('discard-pile');

const startButton = document.getElementById('start-button');
const swapButton = document.getElementById('swap-button'); // Intercambiar Mano/Boca Arriba (after lote selection)
const playButton = document.getElementById('play-button');
const takePileButton = document.getElementById('take-pile-button');
const restartButton = document.getElementById('restart-button');

// New buttons for lote selection
const acceptLoteButton = document.getElementById('accept-lote-button');
const rejectLoteButton = document.getElementById('reject-lote-button');
const endSetupButton = document.getElementById('end-setup-button'); // New button to end setup phase


// --- Card Class ---
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
            cardDiv.classList.add('hidden'); // This class hides the card content
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
    player1Hand = []; // This will temporarily hold all 9 cards for initial selection
    player1FinalHand = []; // This will be the actual hand for gameplay (3 cards)
    player1FaceUp = []; // Player 1's 3 face-up cards
    player1FaceDown = []; // Player 1's 6 face-down cards (these are set AFTER lote selection)

    player2Hand = [];
    player2FaceUp = [];
    player2FaceDown = [];

    // Deal 9 cards to player 1's temporary hand for the lote selection process
    for (let i = 0; i < 9; i++) {
        player1Hand.push(deck.pop());
    }

    // Deal Player 2's cards (AI)
    // Player 2 gets 3 face-down
    for (let i = 0; i < 3; i++) {
        player2FaceDown.push(deck.pop());
    }
    // Player 2 gets 3 face-up
    for (let i = 0; i < 3; i++) {
        player2FaceUp.push(deck.pop());
    }
    // Player 2 gets 3 in hand
    for (let i = 0; i < 3; i++) {
        player2Hand.push(deck.pop());
    }

    // Sort player1Hand for consistent batch presentation (optional, but good for testing)
    player1Hand.sort((a, b) => a.value - b.value);
}

function renderUI() {
    // Render Player 1's cards
    renderCardArea(player1FinalHand, player1HandEl, 'player1-hand', false); // Player's actual hand for gameplay (visible)
    renderCardArea(player1FaceUp, player1FaceUpEl, 'player1-face-up', false); // Player 1's face-up cards (visible)
    renderCardArea(player1FaceDown, player1FaceDownEl, 'player1-face-down', true); // Player 1's face-down cards (hidden)

    // Render the current batch in the selection area (only visible during lote selection phase)
    renderCardArea(currentVisibleBatch, player1LoteSelectionEl, 'player1-lote-selection', false); // Lote selection cards are visible


    // Render Player 2's cards (AI)
    renderCardArea(player2Hand, player2HandEl, 'player2-hand', true); // AI hand (hidden)
    renderCardArea(player2FaceUp, player2FaceUpEl, 'player2-face-up', false); // AI face up (visible)
    renderCardArea(player2FaceDown, player2FaceDownEl, 'player2-face-down', true); // AI face down (hidden)

    // Update counts
    player1HandCountEl.textContent = player1FinalHand.length; // Count of final hand
    player1FaceDownCountEl.textContent = player1FaceDown.length;
    player1LoteSelectionCountEl.textContent = currentVisibleBatch.length; // Count of current batch
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
        if (loteSelectionPhase && areaId === 'player1-lote-selection') {
            // Cards in the visible batch are not clickable, only accept/reject buttons
            // Add a class for styling if needed, but no click listener for individual cards here
            cardEl.classList.add('selectable-lote-card');
        } else if (setupPhase && !loteSelectionPhase) { // This is for the Hand <-> Face Up swap
            if (areaId === 'player1-hand') {
                cardEl.addEventListener('click', (event) => handlePlayerCardClickForSwap(event, 'hand'));
            } else if (areaId === 'player1-face-up') {
                cardEl.addEventListener('click', (event) => handlePlayerCardClickForSwap(event, 'faceUp'));
            }
        }
        // During game phase, cards in hand would be clickable to play (logic to be added later)
        // else if (areaId === 'player1-hand') {
        //     cardEl.addEventListener('click', handlePlayerCardClickToPlay);
        // }


        elementContainer.appendChild(cardEl);

        // Add 'selected-for-swap' class if the card is currently selected for Hand <-> Face Up swap
        if (!loteSelectionPhase) { // Only highlight if we're in the swap phase
            if (areaId === 'player1-hand' && selectedCardsForHandFaceUpSwap.hand && selectedCardsForHandFaceUpSwap.hand.id === card.id) {
                cardEl.classList.add('selected-for-swap');
            } else if (areaId === 'player1-face-up' && selectedCardsForHandFaceUpSwap.faceUp && selectedCardsForHandFaceUpSwap.faceUp.id === card.id) {
                cardEl.classList.add('selected-for-swap');
            }
        }
    });
}

function updateGameMessage(message, type = 'info') {
    gameMessages.textContent = message;
    gameMessages.className = 'game-messages'; // Reset classes
    gameMessages.classList.add(type);
}

// --- Event Handlers ---

function handleStartGame() {
    if (gameStarted) return;
    gameStarted = true;
    setupPhase = true;
    loteSelectionPhase = true; // Start in lote selection phase
    currentBatchAttempt = 0; // Reset attempt counter

    deck = createDeck();
    shuffleDeck(deck);
    dealInitialCards(); // This deals all 9 to player1Hand, and P2's cards
    showNextLote(); // This populates currentVisibleBatch from player1Hand

    updateGameMessage('¡Juego iniciado! Elige tu primer lote de 3 cartas.');

    startButton.disabled = true;
    // Disable all other buttons initially
    swapButton.disabled = true;
    playButton.disabled = true;
    takePileButton.disabled = true;
    endSetupButton.disabled = true; // Disable until ready to end setup
    restartButton.disabled = false;

    // Enable lote selection buttons
    acceptLoteButton.disabled = false;
    rejectLoteButton.disabled = false;

    renderUI();
}

function handleRestartGame() {
    // Reset all game state
    deck = [];
    discardPile = [];
    player1Hand = [];
    player1FinalHand = [];
    player1FaceUp = [];
    player1FaceDown = [];
    player2Hand = [];
    player2FaceUp = [];
    player2FaceDown = [];
    currentPlayer = 1;
    gameStarted = false;
    setupPhase = true;
    loteSelectionPhase = true;
    currentBatchAttempt = 0;
    currentVisibleBatch = [];
    selectedCardsForHandFaceUpSwap = { hand: null, faceUp: null };


    // Clear UI
    player1HandEl.innerHTML = '';
    player1FaceUpEl.innerHTML = '';
    player1FaceDownEl.innerHTML = '';
    player1LoteSelectionEl.innerHTML = ''; // Clear lote selection area
    player2HandEl.innerHTML = '';
    player2FaceUpEl.innerHTML = '';
    player2FaceDownEl.innerHTML = '';
    discardPileEl.innerHTML = '';

    // Update counts
    player1HandCountEl.textContent = '0';
    player1FaceDownCountEl.textContent = '0';
    player1LoteSelectionCountEl.textContent = '0';
    player2HandCountEl.textContent = '0';
    player2FaceDownCountEl.textContent = '0';
    deckCountEl.textContent = '0';
    discardCountEl.textContent = '0';

    updateGameMessage('Presiona "Iniciar Juego" para comenzar una nueva partida.');

    // Reset button states
    startButton.disabled = false;
    swapButton.disabled = true;
    playButton.disabled = true;
    takePileButton.disabled = true;
    restartButton.disabled = true;
    acceptLoteButton.disabled = true;
    rejectLoteButton.disabled = true;
    endSetupButton.disabled = true;
}

// --- Lote Selection Logic ---

function showNextLote() {
    // Ensure we have enough cards to form a batch
    if (player1Hand.length < (currentBatchAttempt + 1) * 3) {
        updateGameMessage('Error interno: No hay suficientes cartas para formar el siguiente lote.', 'error');
        console.error('Not enough cards in player1Hand for the next batch! Player1Hand length:', player1Hand.length);
        return;
    }

    currentBatchAttempt++;
    // Get the next 3 cards from the player1Hand (which holds all 9 initial cards)
    currentVisibleBatch = player1Hand.slice((currentBatchAttempt - 1) * 3, currentBatchAttempt * 3);

    if (currentBatchAttempt === 3) {
        updateGameMessage('Este es tu TERCER y ÚLTIMO intento. ¡Debes quedarte con este lote!');
        acceptLoteButton.textContent = 'Aceptar Lote Final';
        rejectLoteButton.disabled = true; // Can't reject the last one
    } else {
        updateGameMessage(`Mostrando Lote ${currentBatchAttempt}. ¿Aceptar o Rechazar?`);
        acceptLoteButton.textContent = 'Aceptar Lote';
        rejectLoteButton.disabled = false;
    }
    renderUI();
}

function handleAcceptLote() {
    player1FinalHand = [...currentVisibleBatch]; // Set this batch as the player's final hand
    
    // Determine the 6 cards that were NOT chosen as the final hand
    // These will become the player's face-up and face-down cards
    let rejectedCards = [];
    const allInitialCards = [...player1Hand]; // Make a copy of the original 9 cards
    
    rejectedCards = allInitialCards.filter(card => 
        !player1FinalHand.some(finalCard => finalCard.id === card.id)
    );

    // Now, from these 6 rejected cards, 3 go to player1FaceUp and 3 to player1FaceDown
    shuffleDeck(rejectedCards); // Shuffle the 6 cards to randomize face-up/down
    
    player1FaceUp = rejectedCards.splice(0, 3); // Take the first 3 for face-up
    player1FaceDown = rejectedCards; // The remaining 3 are face-down

    player1Hand = []; // Clear the temporary 9-card hand
    currentVisibleBatch = []; // Clear the visible batch (lote selection is over)

    updateGameMessage(`¡Has aceptado el Lote ${currentBatchAttempt}! Tu mano final está lista. Ahora, puedes intercambiar cartas de tu mano con tus cartas boca arriba.`, 'success');
    endLoteSelectionPhase(); // Transition to next setup phase
    renderUI();
}

function handleRejectLote() {
    if (currentBatchAttempt < 3) {
        showNextLote();
    } else {
        // This case should not be reachable if rejectLoteButton is disabled for the 3rd attempt
        updateGameMessage('No puedes rechazar el último lote.', 'error');
    }
    renderUI();
}

function endLoteSelectionPhase() {
    loteSelectionPhase = false;
    // Disable lote selection buttons
    acceptLoteButton.disabled = true;
    rejectLoteButton.disabled = true;

    // Enable Hand <-> Face Up swap button and End Setup button
    swapButton.disabled = false;
    endSetupButton.disabled = false;

    // Setup phase continues for the Hand <-> Face Up swap
    updateGameMessage('Fase de selección de lote completada. Ahora puedes intercambiar cartas de tu mano con tus cartas boca arriba. Cuando termines, haz clic en "Finalizar Preparación".');
}

// --- Hand <-> Face Up Swap Logic (After Lote Selection) ---
function handlePlayerCardClickForSwap(event, areaType) {
    // Only allow clicks if not in lote selection, but still in general setup
    if (!setupPhase || loteSelectionPhase) {
        return;
    }

    const clickedCardEl = event.currentTarget;
    const cardId = clickedCardEl.dataset.id;
    let targetCard = null;

    // Clear previous selections for this type of swap if a new card of the same type is clicked
    if (areaType === 'hand') {
        targetCard = player1FinalHand.find(c => c.id === cardId);
        if (selectedCardsForHandFaceUpSwap.hand && selectedCardsForHandFaceUpSwap.hand.id === cardId) {
            selectedCardsForHandFaceUpSwap.hand = null; // Deselect
        } else {
            selectedCardsForHandFaceUpSwap.hand = targetCard; // Select
        }
    } else if (areaType === 'faceUp') {
        targetCard = player1FaceUp.find(c => c.id === cardId);
        if (selectedCardsForHandFaceUpSwap.faceUp && selectedCardsForHandFaceUpSwap.faceUp.id === cardId) {
            selectedCardsForHandFaceUpSwap.faceUp = null; // Deselect
        } else {
            selectedCardsForHandFaceUpSwap.faceUp = targetCard; // Select
        }
    }
    updateGameMessage(
        `Seleccionadas para Intercambio (Mano/Boca Arriba): Mano: ${selectedCardsForHandFaceUpSwap.hand ? selectedCardsForHandFaceUpSwap.hand.rank + selectedCardsForHandFaceUpSwap.hand.getSuitSymbol() : 'Ninguna'}, Boca Arriba: ${selectedCardsForHandFaceUpSwap.faceUp ? selectedCardsForHandFaceUpSwap.faceUp.rank + selectedCardsForHandFaceUpSwap.faceUp.getSuitSymbol() : 'Ninguna'}`
    );
    renderUI(); // Re-render to update selection highlights
}


function handleSwapCards() {
    if (!setupPhase || loteSelectionPhase) {
        updateGameMessage('Solo puedes intercambiar cartas de mano/boca arriba después de seleccionar tu lote final.', 'error');
        return;
    }

    const handCard = selectedCardsForHandFaceUpSwap.hand;
    const faceUpCard = selectedCardsForHandFaceUpSwap.faceUp;

    if (!handCard || !faceUpCard) {
        updateGameMessage('Para este intercambio (Mano/Boca Arriba), selecciona UNA carta de tu mano Y UNA de tus cartas boca arriba.', 'error');
        return;
    }

    const handIndex = player1FinalHand.findIndex(c => c.id === handCard.id);
    const faceUpIndex = player1FaceUp.findIndex(c => c.id === faceUpCard.id);

    if (handIndex > -1 && faceUpIndex > -1) {
        // Perform the swap
        [player1FinalHand[handIndex], player1FaceUp[faceUpIndex]] = [player1FaceUp[faceUpIndex], player1FinalHand[handIndex]];
        updateGameMessage(`¡Cartas ${handCard.rank}${handCard.getSuitSymbol()} y ${faceUpCard.rank}${faceUpCard.getSuitSymbol()} intercambiadas! Puedes hacer más intercambios o presionar 'Finalizar Preparación'.`);
    } else {
        updateGameMessage('Error al encontrar las cartas seleccionadas.', 'error');
    }

    // Clear selections after swap
    selectedCardsForHandFaceUpSwap.hand = null;
    selectedCardsForHandFaceUpSwap.faceUp = null;
    renderUI();
}


function endSetupPhaseForPlayer1() {
    setupPhase = false;
    updateGameMessage('Fase de preparación terminada. ¡Es tu turno de jugar!', 'success');

    // Disable all setup-related buttons
    swapButton.disabled = true;
    acceptLoteButton.disabled = true;
    rejectLoteButton.disabled = true;
    endSetupButton.disabled = true;

    // Enable game-play buttons
    playButton.disabled = false;
    takePileButton.disabled = false;
}


// --- Main Game Turn Logic (To be expanded) ---
function han
