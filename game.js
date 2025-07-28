// --- Game State Variables ---
let deck = [];
let discardPile = [];
let player1Hand = [];
let player1FaceUp = [];
let player1FaceDown = [];
let player2Hand = []; // AI Hand
let player2FaceUp = []; // AI Face Up cards
let player2FaceDown = []; // AI Face Down cards

let currentPlayer = 1; // 1 for Player 1, 2 for Player 2 (AI)
let gameStarted = false;
let setupPhase = true; // True during initial card swap phase

// For card swapping functionality
let selectedSwapCards = {
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

const player2HandEl = document.getElementById('player2-hand');
const player2HandCountEl = document.getElementById('player2-hand-count');
const player2FaceUpEl = document.getElementById('player2-face-up');
const player2FaceDownEl = document.getElementById('player2-face-down');
const player2FaceDownCountEl = document.getElementById('player2-face-down-count');

const deckCountEl = document.getElementById('deck-count');
const discardCountEl = document.getElementById('discard-count');
const discardPileEl = document.getElementById('discard-pile');

const startButton = document.getElementById('start-button');
const swapButton = document.getElementById('swap-button');
const playButton = document.getElementById('play-button');
const takePileButton = document.getElementById('take-pile-button');
const restartButton = document.getElementById('restart-button');

// --- Card Class ---
class Card {
    constructor(suit, rank) {
        this.suit = suit; // e.g., 'hearts', 'diamonds', 'clubs', 'spades'
        this.rank = rank; // e.g., '2', '3', ..., '10', 'J', 'Q', 'K', 'A'
        this.value = this.getCardValue(); // Numeric value for comparison
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
        // Assign numeric values for comparison, adjust as per game rules
        if (this.rank === 'A') return 14;
        if (this.rank === 'K') return 13;
        if (this.rank === 'Q') return 12;
        if (this.rank === 'J') return 11;
        // Special cards (e.g., 2s, 10s, 7s) can have their own rules logic later
        if (this.rank === '2') return 15; // Example: 2 is highest
        if (this.rank === '10') return 16; // Example: 10 clears discard
        return parseInt(this.rank);
    }

    createCardElement(isFaceDown = false) {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card');
        cardDiv.dataset.id = this.id; // Store unique ID

        if (isFaceDown) {
            cardDiv.classList.add('hidden');
        } else {
            const rankDisplay = (this.rank === '10') ? 'T' : this.rank; // 'T' for 10
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
            // Add multi-symbol class for number cards for grid display
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
    player2Hand = [];
    player2FaceUp = [];
    player2FaceDown = [];

    // Deal 3 face-down, 3 face-up, 3 hand cards to each player
    for (let i = 0; i < 3; i++) {
        player1FaceDown.push(deck.pop());
        player2FaceDown.push(deck.pop());
    }
    for (let i = 0; i < 3; i++) {
        player1FaceUp.push(deck.pop());
        player2FaceUp.push(deck.pop());
    }
    for (let i = 0; i < 3; i++) {
        player1Hand.push(deck.pop());
        player2Hand.push(deck.pop());
    }
}

function renderUI() {
    // Render Player 1's cards
    renderCardArea(player1Hand, player1HandEl, 'player1-hand');
    renderCardArea(player1FaceUp, player1FaceUpEl, 'player1-face-up');
    renderCardArea(player1FaceDown, player1FaceDownEl, 'player1-face-down', true); // Face down

    // Render Player 2's cards (AI - all hidden for now)
    renderCardArea(player2Hand, player2HandEl, 'player2-hand', true); // AI hand hidden
    renderCardArea(player2FaceUp, player2FaceUpEl, 'player2-face-up'); // AI face up shown
    renderCardArea(player2FaceDown, player2FaceDownEl, 'player2-face-down', true); // AI face down hidden

    // Update counts
    player1HandCountEl.textContent = player1Hand.length;
    player1FaceDownCountEl.textContent = player1FaceDown.length;
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
    elementContainer.innerHTML = ''; // Clear current cards
    cardArray.forEach(card => {
        const cardEl = card.createCardElement(isFaceDown);
        cardEl.dataset.area = areaId; // Store which area it belongs to
        if (areaId === 'player1-hand' || areaId === 'player1-face-up') {
            cardEl.addEventListener('click', handlePlayerCardClick);
        }
        elementContainer.appendChild(cardEl);
    });
}

function updateGameMessage(message, type = 'info') {
    gameMessages.textContent = message;
    gameMessages.className = 'game-messages'; // Reset classes
    gameMessages.classList.add(type); // Add type for specific styling (e.g., 'error', 'success')
}

// --- Event Handlers ---

function handleStartGame() {
    if (gameStarted) return; // Prevent multiple starts
    gameStarted = true;
    setupPhase = true; // Enter setup phase
    updateGameMessage('¡Juego iniciado! Jugador 1, selecciona 0-3 cartas para intercambiar con tus cartas boca arriba.');

    deck = createDeck();
    shuffleDeck(deck);
    dealInitialCards();
    renderUI();

    // Enable/Disable buttons for setup phase
    startButton.disabled = true;
    swapButton.disabled = false;
    playButton.disabled = true;
    takePileButton.disabled = true;
    restartButton.disabled = false; // Always allow restart
}

function handleRestartGame() {
    // Reset all game state
    deck = [];
    discardPile = [];
    player1Hand = [];
    player1FaceUp = [];
    player1FaceDown = [];
    player2Hand = [];
    player2FaceUp = [];
    player2FaceDown = [];
    currentPlayer = 1;
    gameStarted = false;
    setupPhase = true;
    selectedSwapCards = { hand: null, faceUp: null };

    // Clear UI
    player1HandEl.innerHTML = '';
    player1FaceUpEl.innerHTML = '';
    player1FaceDownEl.innerHTML = '';
    player2HandEl.innerHTML = '';
    player2FaceUpEl.innerHTML = '';
    player2FaceDownEl.innerHTML = '';
    discardPileEl.innerHTML = '';

    // Update counts
    player1HandCountEl.textContent = '0';
    player1FaceDownCountEl.textContent = '0';
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
    restartButton.disabled = true; // Maybe enable after starting a game for convenience, or only after the game is over.
}


function handlePlayerCardClick(event) {
    if (!setupPhase) {
        // This part will handle actual game play card selection
        // For now, it only handles setup phase selection
        console.log('Game phase card click - not implemented yet');
        return;
    }

    const clickedCardEl = event.currentTarget; // The div.card that was clicked
    const cardId = clickedCardEl.dataset.id;
    const cardArea = clickedCardEl.dataset.area;

    let targetArray;
    let targetSelection;

    if (cardArea === 'player1-hand') {
        targetArray = player1Hand;
        targetSelection = 'hand';
    } else if (cardArea === 'player1-face-up') {
        targetArray = player1FaceUp;
        targetSelection = 'faceUp';
    } else {
        updateGameMessage('Solo puedes intercambiar cartas de tu mano o boca arriba.', 'error');
        return;
    }

    const clickedCard = targetArray.find(c => c.id === cardId);

    if (!clickedCard) return; // Should not happen

    // Toggle selection
    if (selectedSwapCards[targetSelection] && selectedSwapCards[targetSelection].id === clickedCard.id) {
        // Deselect
        selectedSwapCards[targetSelection] = null;
        clickedCardEl.classList.remove('selected-for-swap');
    } else {
        // Select
        if (selectedSwapCards[targetSelection]) {
            // Deselect previously selected card in this area
            const prevSelectedEl = document.querySelector(`[data-id="${selectedSwapCards[targetSelection].id}"][data-area="${cardArea}"]`);
            if (prevSelectedEl) {
                prevSelectedEl.classList.remove('selected-for-swap');
            }
        }
        selectedSwapCards[targetSelection] = clickedCard;
        clickedCardEl.classList.add('selected-for-swap');
    }

    updateGameMessage(
        `Seleccionadas: Mano: ${selectedSwapCards.hand ? selectedSwapCards.hand.rank + selectedSwapCards.hand.getSuitSymbol() : 'Ninguna'}, Boca Arriba: ${selectedSwapCards.faceUp ? selectedSwapCards.faceUp.rank + selectedSwapCards.faceUp.getSuitSymbol() : 'Ninguna'}`
    );
}


function handleSwapCards() {
    if (!setupPhase) {
        updateGameMessage('Solo puedes intercambiar cartas durante la fase de preparación.', 'error');
        return;
    }

    const handCard = selectedSwapCards.hand;
    const faceUpCard = selectedSwapCards.faceUp;

    if (!handCard && !faceUpCard) {
        updateGameMessage('Selecciona al menos una carta de la mano y/o una carta boca arriba para intercambiar.', 'error');
        return;
    }

    if (handCard && faceUpCard) {
        // Perform a direct swap
        const handIndex = player1Hand.findIndex(c => c.id === handCard.id);
        const faceUpIndex = player1FaceUp.findIndex(c => c.id === faceUpCard.id);

        if (handIndex > -1 && faceUpIndex > -1) {
            [player1Hand[handIndex], player1FaceUp[faceUpIndex]] = [player1FaceUp[faceUpIndex], player1Hand[handIndex]];
            updateGameMessage(`¡Cartas ${handCard.rank}${handCard.getSuitSymbol()} y ${faceUpCard.rank}${faceUpCard.getSuitSymbol()} intercambiadas!`);
        } else {
            updateGameMessage('Error al encontrar las cartas seleccionadas.', 'error');
        }
    } else if (handCard && !faceUpCard) {
        // Only hand card selected, assume moving it to face-up
        // This might be a rule specific to your game (e.g., swap hand card for a face-down card later)
        updateGameMessage('Para intercambiar, debes seleccionar una carta de tu mano Y una de tus cartas boca arriba.', 'error');
        return;
    } else if (!handCard && faceUpCard) {
        // Only face-up card selected, assume moving it to hand
        updateGameMessage('Para intercambiar, debes seleccionar una carta de tu mano Y una de tus cartas boca arriba.', 'error');
        return;
    }

    // Clear selection after swap
    selectedSwapCards.hand = null;
    selectedSwapCards.faceUp = null;
    renderUI(); // Re-render to show changes and remove selection highlights

    // Check if swap phase is done or if player can swap more
    // For simplicity, let's say after one swap, the setup phase ends for Player 1
    // You might want to allow 3 swaps, or unlimited until play button is pressed.
    endSetupPhaseForPlayer1();
}

function endSetupPhaseForPlayer1() {
    setupPhase = false; // Player 1's setup is done
    updateGameMessage('Fase de preparación terminada. ¡Es tu turno de jugar!');

    // Disable swap button and enable play buttons
    swapButton.disabled = true;
    playButton.disabled = false;
    takePileButton.disabled = false;

    // AI's turn (or player 1 starts, depending on game rules)
    // For now, assume player 1 starts after setup.
    // In a real game, you'd have AI logic here or a 'start game' button.
    // Let's assume player 1 begins by default after setup.
}


// --- Main Game Turn Logic (To be expanded) ---
function handlePlayCard() {
    if (currentPlayer !== 1 || setupPhase) {
        updateGameMessage('No es tu turno o aún estás en fase de preparación.', 'error');
        return;
    }
    updateGameMessage('Jugador 1 va a jugar una carta (lógica pendiente)...');
    // TODO: Implement actual card playing logic
    // - Get selected card from player1Hand or player1FaceUp (once selected)
    // - Validate against discardPile[discardPile.length - 1]
    // - Move card to discardPile
    // - Draw new card if hand < 3 and deck > 0
    // - Check for game end condition
    // - Pass turn to AI
    // simulatedPlayTurn(); // Call AI turn immediately for testing
}

function handleTakePile() {
    if (currentPlayer !== 1 || setupPhase) {
        updateGameMessage('No es tu turno o aún estás en fase de preparación.', 'error');
        return;
    }
    updateGameMessage('Jugador 1 va a tomar el descarte (lógica pendiente)...');
    // TODO: Implement taking discard pile logic
    // - Add all cards from discardPile to player1Hand
    // - Clear discardPile
    // - Pass turn to AI
    // simulatedPlayTurn();
}

function simulatedPlayTurn() {
    // Basic AI turn simulation
    updateGameMessage('Turno del Jugador 2 (IA)...');
    setTimeout(() => {
        // AI logic would go here: play a card, take pile, etc.
        // For now, just simulate passing turn back.
        updateGameMessage('Jugador 2 (IA) ha terminado su turno.');
        currentPlayer = 1; // Pass turn back to Player 1
        updateGameMessage('¡Es tu turno, Jugador 1!');
        playButton.disabled = false;
        takePileButton.disabled = false;
    }, 1500);
}


// --- Initialization ---
function initializeGame() {
    // Attach event listeners to buttons
    startButton.addEventListener('click', handleStartGame);
    swapButton.addEventListener('click', handleSwapCards);
    playButton.addEventListener('click', handlePlayCard);
    takePileButton.addEventListener('click', handleTakePile);
    restartButton.addEventListener('click', handleRestartGame);

    // Initial state of buttons
    startButton.disabled = false;
    swapButton.disabled = true;
    playButton.disabled = true;
    takePileButton.disabled = true;
    restartButton.disabled = true; // Initially disabled, enable after game starts

    updateGameMessage('Presiona "Iniciar Juego" para comenzar una nueva partida.');
}

// Call initialization function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeGame);

