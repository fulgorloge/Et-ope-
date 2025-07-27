// --- Definición de Cartas y Mazos ---
const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades']; // Corazones, Diamantes, Tréboles, Picas
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const JOKERS_COUNT = 4;

let deck = [];
let players = {
    player1: {
        hand: [],
        faceUp: [], // Cartas boca arriba en la mesa
        faceDown: [], // Cartas boca abajo en la mesa
        isTurn: false // Se establece al iniciar el juego
    },
    player2: { // IA básica
        hand: [],
        faceUp: [],
        faceDown: [],
        isTurn: false
    }
};
let discardPile = []; // Montón central de descarte
let currentPlayer = ''; // 'player1' o 'player2'
let twoEffectActive = false; // Bandera para el efecto del 2 (permite otro turno) o del 7 (mantiene el turno)

// --- NUEVA FUNCIONALIDAD: PREPARACIÓN DE MANO INICIAL ---
let gameState = 'setup'; // 'setup', 'playing', 'gameOver'
let selectedSetupCard = null; // Almacena la primera carta clickeada en la fase de setup
let selectedSetupCardElement = null; // Almacena el elemento DOM de la primera carta clickeada
// --------------------------------------------------------

// --- Referencias a elementos del DOM ---
const player1HandEl = document.getElementById('player1-hand');
const player1FaceUpEl = document.getElementById('player1-face-up');
const player1FaceDownEl = document.getElementById('player1-face-down');
const player2HandEl = document.getElementById('player2-hand');
const player2FaceUpEl = document.getElementById('player2-face-up');
const player2FaceDownEl = document.getElementById('player2-face-down');
const discardPileEl = document.getElementById('discard-pile');

// --- BOTONES: mainActionButton y restartButton ---
const mainActionButton = document.getElementById('main-action-button'); // Botón principal (Confirmar Mano / Tomar Montón)
const restartButton = document.getElementById('restart-button'); // Nuevo botón de reiniciar

const gameMessagesEl = document.getElementById('game-messages');

// --- Funciones del Juego ---

// 1. Crear el Mazo completo (incluyendo Jokers)
function createDeck() {
    deck = [];
    for (let suit of suits) {
        for (let value of values) {
            deck.push({ value, suit, type: 'normal' });
        }
    }
    // Añadir los Jokers
    for (let i = 0; i < JOKERS_COUNT; i++) {
        deck.push({ value: 'Joker', suit: 'None', type: 'joker' });
    }
    shuffleDeck(deck);
}

// 2. Mezclar el Mazo (Algoritmo de Fisher-Yates)
function shuffleDeck(deckToShuffle) {
    for (let i = deckToShuffle.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckToShuffle[i], deckToShuffle[j]] = [deckToShuffle[j], deckToShuffle[i]];
    }
}

// 3. Repartir Cartas Iniciales a los Jugadores
function dealInitialCards() {
    // Resetear manos de los jugadores y montón de descarte
    players.player1.hand = [];
    players.player1.faceUp = [];
    players.player1.faceDown = [];
    players.player2.hand = [];
    players.player2.faceUp = [];
    players.player2.faceDown = [];
    discardPile = [];

    // Repartir 3 cartas en mano, 3 boca arriba, 3 boca abajo
    for (let playerKey in players) {
        for (let i = 0; i < 3; i++) { // Bucle para 3 cartas en cada área
            players[playerKey].hand.push(deck.pop());
            players[playerKey].faceUp.push(deck.pop());
            players[playerKey].faceDown.push(deck.pop());
        }
    }
}

// 4. Renderizar las Cartas en la UI
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
    players.player1.hand.forEach(card => player1HandEl.appendChild(createCardElement(card, 'player1', 'hand')));
    players.player1.faceUp.forEach(card => player1FaceUpEl.appendChild(createCardElement(card, 'player1', 'faceUp')));
    // Cartas boca abajo se muestran ocultas para el Jugador 1
    players.player1.faceDown.forEach(card => player1FaceDownEl.appendChild(createCardElement(card, 'player1', 'faceDown', true))); // Pasar true para ocultar

    // Renderizar cartas del Jugador 2 (IA) - mano y boca abajo ocultas
    players.player2.hand.forEach(card => player2HandEl.appendChild(createCardElement(card, 'player2', 'hand', true))); // Pasar true para ocultar
    players.player2.faceUp.forEach(card => player2FaceUpEl.appendChild(createCardElement(card, 'player2', 'faceUp')));
    players.player2.faceDown.forEach(card => player2FaceDownEl.appendChild(createCardElement(card, 'player2', 'faceDown', true))); // Pasar true para ocultar

    // Renderizar solo la última carta del montón de descarte
    if (discardPile.length > 0) {
        discardPileEl.appendChild(createCardElement(discardPile[discardPile.length - 1], 'discard', 'top'));
    }
    updateButtonStates(); // Actualizar el estado de los botones cada vez que se renderiza
}

// 5. Crear elemento HTML de una carta (con gestión de clics)
// Añadimos un parámetro 'isHidden' para controlar si la carta se muestra boca arriba o boca abajo
function createCardElement(card, owner, area, isHidden = false) {
    const cardEl = document.createElement('div');
    cardEl.classList.add('card');

    if (isHidden) {
        cardEl.classList.add('hidden');
        cardEl.textContent = ''; // No mostrar valor si está oculta
    } else {
        cardEl.textContent = card.value;
        if (card.suit === 'Hearts' || card.suit === 'Diamonds') {
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
            } else if (area === 'faceDown' && p1.hand.length === 0 && p1.faceUp.length === 0 && deck.length === 0 && p1.faceDown.length > 0) {
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

// --- NUEVA FUNCIONALIDAD: PREPARACIÓN DE MANO INICIAL (Handler de Clics) ---
function handleSetupClick(card, area, cardEl) {
    if (selectedSetupCard === null) {
        // Primera carta seleccionada
        selectedSetupCard = { card, area };
        selectedSetupCardElement = cardEl;
        cardEl.classList.add('selected-for-swap');
        showMessage("Carta seleccionada para intercambiar. Haz clic en otra carta de tu mano o boca arriba.");
    } else {
        // Segunda carta seleccionada, realizar el intercambio
        if (selectedSetupCard.card === card) {
            // Misma carta clickeada, deseleccionar
            selectedSetupCardElement.classList.remove('selected-for-swap');
            selectedSetupCard = null;
            selectedSetupCardElement = null;
            showMessage("Selección cancelada.");
            return;
        }

        // Asegurarse de que las cartas son de las áreas permitidas para el intercambio
        if (!(selectedSetupCard.area === 'hand' || selectedSetupCard.area === 'faceUp') || !(area === 'hand' || area === 'faceUp')) {
            showMessage("Solo puedes intercambiar cartas entre tu mano y tus cartas boca arriba.");
            selectedSetupCardElement.classList.remove('selected-for-swap');
            selectedSetupCard = null;
            selectedSetupCardElement = null;
            return;
        }

        // Realizar el intercambio entre las dos cartas
        const p1 = players.player1;

        // Encuentra y quita la primera carta de su área
        let card1SourceArray = selectedSetupCard.area === 'hand' ? p1.hand : p1.faceUp;
        let card1Index = card1SourceArray.findIndex(c => c === selectedSetupCard.card);
        card1SourceArray.splice(card1Index, 1);

        // Encuentra y quita la segunda carta de su área
        let card2SourceArray = area === 'hand' ? p1.hand : p1.faceUp;
        let card2Index = card2SourceArray.findIndex(c => c === card);
        card2SourceArray.splice(card2Index, 1);

        // Añade la primera carta al área de la segunda
        card2SourceArray.push(selectedSetupCard.card);
        // Añade la segunda carta al área de la primera
        card1SourceArray.push(card);

        showMessage("Cartas intercambiadas. Puedes seguir intercambiando o confirmar tu mano.");
        
        // Resetear la selección
        selectedSetupCard = null;
        selectedSetupCardElement = null;
        renderCards(); // Volver a renderizar para mostrar los cambios y actualizar listeners
    }
}

// Función para confirmar la mano inicial y empezar el juego
function confirmHandSetup() {
    if (gameState !== 'setup') return; // Solo funciona en la fase de setup

    gameState = 'playing';
    mainActionButton.textContent = 'Tomar Montón'; // Cambiar el texto del botón
    showMessage("¡Mano confirmada! El juego ha comenzado. Es tu turno.");

    currentPlayer = 'player1';
    players.player1.isTurn = true;
    renderCards(); // Re-renderizar para activar los listeners de juego normal
}
// --------------------------------------------------------------------------

// 6. Lógica para Jugar una Carta
async function playCard(cardToPlay, fromArea, clickedElement = null) {
    if (gameState !== 'playing') {
        showMessage("El juego no ha comenzado aún. Confirma tu mano primero.");
        return;
    }

    if (!players[currentPlayer].isTurn) {
        showMessage("No es tu turno.");
        return;
    }

    const p = players[currentPlayer]; // Referencia al jugador actual

    // Asegurar que la carta se juega desde la fase correcta
    if (fromArea === 'hand' && p.hand.length === 0) {
        showMessage("Error: No tienes cartas en tu mano para jugar.");
        return;
    }
    if (fromArea === 'faceUp' && (p.hand.length > 0 || p.faceUp.length === 0)) {
        showMessage("Debes jugar las cartas de tu mano primero, o no tienes cartas boca arriba.");
        return;
    }
    if (fromArea === 'faceDown' && (p.hand.length > 0 || p.faceUp.length > 0 || deck.length === 0 || p.faceDown.length === 0)) {
        showMessage("Solo puedes jugar cartas boca abajo si tu mano y tus cartas boca arriba están vacías, y el mazo está agotado.");
        return;
    }

    let actualCardToPlay = cardToPlay;
    let cardIndex;
    let playedSuccessfully = false;

    if (fromArea === 'faceDown') {
        // Al jugar una carta boca abajo, se revela
        // La carta que se juega es la que se clickeó, debemos encontrarla en el array
        cardIndex = p.faceDown.findIndex(c => c.value === cardToPlay.value && c.suit === cardToPlay.suit);
        if (cardIndex === -1) {
             showMessage("Error: Carta boca abajo no encontrada para jugar.");
             return;
        }
        actualCardToPlay = p.faceDown.splice(cardIndex, 1)[0]; // Remover y obtener la carta

        // Actualizar visualmente la carta para que muestre su valor
        if (clickedElement) {
            clickedElement.textContent = actualCardToPlay.value;
            clickedElement.classList.remove('hidden');
            if (actualCardToPlay.suit === 'Hearts' || actualCardToPlay.suit === 'Diamonds') {
                clickedElement.classList.add('red');
            }
        }
        showMessage(`¡Has revelado un ${actualCardToPlay.value} de ${actualCardToPlay.suit} de tus cartas boca abajo!`);

        const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
        if (!isValidPlay(actualCardToPlay, topCard)) {
            showMessage(`El ${actualCardToPlay.value} no se puede jugar. ¡Debes tomar el montón!`);
            discardPile.push(actualCardToPlay); // La carta revelada pero no jugada va al montón
            takePile(p);
            return;
        } else {
            discardPile.push(actualCardToPlay);
            showMessage(`¡Has jugado un ${actualCardToPlay.value} de ${actualCardToPlay.suit || 'Comodín'}!`);
            playedSuccessfully = true;
        }
    } else { // Si viene de mano o boca arriba
        let sourceArray = p[fromArea];
        cardIndex = sourceArray.findIndex(c => c.value === cardToPlay.value && c.suit === cardToPlay.suit);

        if (cardIndex === -1) {
            showMessage("Error: Carta no encontrada en el área de origen.");
            return;
        }

        if (cardToPlay.type === 'joker' && currentPlayer === 'player1') {
            const chosenValue = await askForJokerValue();
            if (!chosenValue) {
                showMessage("Has cancelado la jugada del Joker.");
                return;
            }
            actualCardToPlay = { ...cardToPlay, value: chosenValue, type: 'joker-chosen' };
        }

        const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
        if (!isValidPlay(actualCardToPlay, topCard)) {
            showMessage(`No puedes jugar un ${actualCardToPlay.value} sobre un ${topCard ? topCard.value : 'nada'}. ¡Debes tomar el montón!`);
            takePile(p);
            return;
        }

        sourceArray.splice(cardIndex, 1);
        discardPile.push(actualCardToPlay);
        showMessage(`¡Has jugado un ${actualCardToPlay.value} de ${actualCardToPlay.suit || 'Comodín'}!`);
        playedSuccessfully = true;
    }

    if (playedSuccessfully) {
        ensureMinHandCards(p);
    }

    // Aquí es crucial: handleSpecialCards activa twoEffectActive
    await handleSpecialCards(actualCardToPlay);

    renderCards(); // Volver a renderizar las cartas y actualizar el estado de los botones
    checkWinCondition();

    // SOLO cambiar de turno si el efecto de '2' o '7' NO está activo
    if (!twoEffectActive) {
        switchTurn();
    }
    // Si twoEffectActive es true, el turno NO cambia, y el jugador actual (Player 1 o IA)
    // debe tener la oportunidad de jugar otra carta.
}

// Diálogo para que el jugador elija el valor del Joker
function askForJokerValue() {
    return new Promise(resolve => {
        const input = prompt("Has jugado un Joker. ¿Qué valor quieres que represente? (Ej: A, 2, 3... K)");
        if (input && values.includes(input.toUpperCase())) {
            resolve(input.toUpperCase());
        } else if (input) {
            alert("Valor inválido. Por favor, elige un valor de carta (A, 2, 3... K).");
            resolve(null); // No resuelve, el jugador puede reintentar
        } else {
            resolve(null); // Jugador canceló
        }
    });
}

// 7. Validar si una carta es válida para jugar
function isValidPlay(card, topCard) {
    // 10, 2, 7 y Joker siempre son válidos para lanzar sobre CUALQUIER carta
    if (card.value === '10' || card.value === '2' || card.value === '7' || card.type === 'joker' || card.type === 'joker-chosen') {
        return true;
    }

    // Si no hay carta en el montón, cualquier carta normal es válida
    if (!topCard || discardPile.length === 0) { // Asegurarse de que el montón esté realmente vacío
        return true;
    }

    // Regla base: La carta debe ser de igual o mayor valor que la topCard
    const cardValueNum = getValueNumber(card.value);
    const topCardValueNum = getValueNumber(topCard.value);

    return cardValueNum >= topCardValueNum;
}

// Función auxiliar para obtener valor numérico de las cartas
function getValueNumber(value) {
    if (value === 'Joker') return 15; // Un valor alto para que el Joker pueda ser cualquier cosa si se necesita comparar (aunque su función principal es ser elegido)
    if (['J', 'Q', 'K', 'A'].includes(value)) {
        switch (value) {
            case 'J': return 11;
            case 'Q': return 12;
            case 'K': return 13;
            case 'A': return 14; // El As es alto en este contexto (siempre va encima de K)
        }
    }
    return parseInt(value, 10);
}

// 8. Manejar efectos de cartas especiales (10, 2, 7, Trío)
async function handleSpecialCards(playedCard) {
    // Primero, verificar si la carta jugada es un 2 o un 7
    if (playedCard.value === '2') {
        showMessage("¡Has jugado un 2! Tira otra carta.");
        twoEffectActive = true; // Activa la bandera para permitir otro turno
        return; // Salir, ya que el jugador lanzará otra carta
    }
    
    if (playedCard.value === '7') {
        showMessage("¡Has jugado un 7! ¡El sentido del juego se ha revertido! Te toca de nuevo.");
        twoEffectActive = true;
        return;
    }

    // Si no es un 2 ni un 7, y el efecto estaba activo, resetearlo
    if (twoEffectActive && playedCard.value !== '2' && playedCard.value !== '7') {
        twoEffectActive = false;
    }

    // --- Efecto del 10 ---
    if (playedCard.value === '10') {
        showMessage("¡El 10 ha quemado el montón! Turno del siguiente jugador.");
        discardPile = []; // Quema todo el montón
        twoEffectActive = false; // Asegurar que el efecto del 2 o 7 no persiste
        switchTurn(); // El que jugó el 10 pierde su turno
        return; // Salir para no procesar otras reglas en este mismo ciclo
    }

    // --- Efecto de Trío ---
    if (discardPile.length >= 3) {
        const lastThreeCards = discardPile.slice(-3);
        let potentialTrioValue = null;
        const nonJokerCards = lastThreeCards.filter(c => c.type !== 'joker' && c.type !== 'joker-chosen');

        if (nonJokerCards.length > 0) {
            potentialTrioValue = nonJokerCards[0].value;
        } else if (lastThreeCards.length === 3 && lastThreeCards.every(c => c.type === 'joker' || c.type === 'joker-chosen')) {
            // Si todas son jokers, el jugador actual (o IA) elige el valor del trío
            if (currentPlayer === 'player1') {
                const chosenValue = await askForJokerValue();
                if (chosenValue) {
                    potentialTrioValue = chosenValue;
                } else {
                    return; // Si el jugador cancela el joker, no hay trío.
                }
            } else {
                potentialTrioValue = values[Math.floor(Math.random() * values.length)]; // IA elige al azar
            }
        }

        if (potentialTrioValue) {
            let isActualTrio = true;
            for (const card of lastThreeCards) {
                if (!(card.value === potentialTrioValue || card.type === 'joker' || card.type === 'joker-chosen')) {
                    isActualTrio = false;
                    break;
                }
            }

            if (isActualTrio) {
                showMessage(`¡Trío de ${potentialTrioValue}s! Quemando todos los ${potentialTrioValue}s de las manos de todos los jugadores.`);

                for (let playerKey in players) {
                    players[playerKey].hand = players[playerKey].hand.filter(card => {
                        if (card.value === potentialTrioValue || card.type === 'joker' || card.type === 'joker-chosen') {
                            return false;
                        }
                        return true;
                    });
                }
                renderCards();
            }
        }
    }
}


// 9. Cambiar de Turno
function switchTurn() {
    // Si el efecto del 2 o 7 está activo, NO CAMBIA el turno.
    if (twoEffectActive) {
        // En este caso, el turno sigue siendo del mismo jugador.
        // Si era la IA la que jugó el 2/7, la llamamos de nuevo.
        if (currentPlayer === 'player2') {
            mainActionButton.disabled = true; // Asegurarse de que el botón de toma esté deshabilitado para el jugador mientras la IA piensa
            setTimeout(aiPlay, 1500);
        } else {
            // Si es el Jugador 1, su turno continúa. El botón principal (Tomar Montón)
            // ya está habilitado para él. Solo renderizamos de nuevo para asegurar
            // que los listeners de sus cartas estén activos si es necesario.
            renderCards();
        }
        return; // Salir de la función, ya que no hay cambio de turno.
    }

    // Si no hay efecto activo, entonces se procede a cambiar el turno normalmente
    if (gameState !== 'playing') return;

    players[currentPlayer].isTurn = false;
    currentPlayer = (currentPlayer === 'player1') ? 'player2' : 'player1';
    players[currentPlayer].isTurn = true;
    showMessage(`Es el turno de ${currentPlayer === 'player1' ? 'Jugador 1' : 'Jugador 2'}.`);

    renderCards(); // Volver a renderizar para actualizar el estado del botón principal para el siguiente turno

    // Si es el turno de la IA (player2), debería hacer un movimiento
    if (currentPlayer === 'player2') {
        // Deshabilitar el botón de "Tomar Montón" mientras juega la IA
        mainActionButton.disabled = true;
        setTimeout(aiPlay, 1500); // Dar un pequeño retraso para la IA
    } else {
        // Habilitar el botón de "Tomar Montón" para el Jugador 1
        mainActionButton.disabled = false;
    }
    updateButtonStates(); // Asegurarse de que los estados de los botones se actualicen
}

// 10. Lógica de la IA (Jugador 2)
async function aiPlay() {
    if (gameState !== 'playing') return;

    const aiPlayer = players.player2;
    const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
    let played = false;
    let cardToPlay = null;
    let fromArea = '';

    const findBestPlay = (cards) => {
        // Prioridad de la IA: jugar 2s o 7s si puede, luego 10s para quemar, luego cartas normales válidas.
        const specialCards = cards.filter(c => c.value === '2' || c.value === '7' || c.value === '10' || c.type === 'joker');
        const normalCards = cards.filter(c => c.value !== '2' && c.value !== '7' && c.value !== '10' && c.type !== 'joker');

        // Intentar jugar un 2 o 7 primero
        for (let card of specialCards) {
            if (card.value === '2' || card.value === '7') {
                // Los 2 y 7 siempre son válidos
                return card;
            }
        }
        // Intentar jugar un 10
        for (let card of specialCards) {
            if (card.value === '10') {
                return card;
            }
        }
        // Intentar jugar un Joker
        for (let card of specialCards) {
            if (card.type === 'joker') {
                 // Si es Joker, la IA lo usará para hacer una jugada válida si no tiene otra opción mejor.
                 // Para simplificar, la IA elegirá el valor más bajo que le permita jugar.
                 // Si no hay topCard, elige un 2 para mantener el turno si es posible.
                if (!topCard) return {...card, value: '2', type: 'joker-chosen'}; // Si no hay nada, el 2 es una buena opción
                for (let val of values) {
                    if (getValueNumber(val) >= getValueNumber(topCard.value)) {
                        return {...card, value: val, type: 'joker-chosen'};
                    }
                }
                return {...card, value: 'A', type: 'joker-chosen'}; // Si no encuentra una jugada mayor, que sea un As
            }
        }

        // Si no hay cartas especiales que se puedan jugar con ventaja, intenta jugar cartas normales
        const sortedNormalCards = [...normalCards].sort((a, b) => getValueNumber(a.value) - getValueNumber(b.value));
        for (let card of sortedNormalCards) {
            if (isValidPlay(card, topCard)) {
                return card;
            }
        }
        return null;
    };

    // --- ORDEN DE FASES DE JUEGO (Prioridad de la IA) ---
    if (aiPlayer.hand.length > 0) {
        cardToPlay = findBestPlay(aiPlayer.hand);
        if (cardToPlay) {
            fromArea = 'hand';
        }
    }
    if (!cardToPlay && aiPlayer.hand.length === 0 && aiPlayer.faceUp.length > 0) {
        cardToPlay = findBestPlay(aiPlayer.faceUp);
        if (cardToPlay) {
            fromArea = 'faceUp';
        }
    }
    if (!cardToPlay && aiPlayer.hand.length === 0 && aiPlayer.faceUp.length === 0 && deck.length === 0 && aiPlayer.faceDown.length > 0) {
        // La IA debe intentar jugar una de sus cartas boca abajo al azar.
        const randomIndex = Math.floor(Math.random() * aiPlayer.faceDown.length);
        const revealedCard = aiPlayer.faceDown[randomIndex]; // Revelar una al azar
        showMessage(`El Jugador 2 ha revelado una carta boca abajo.`);

        // Si la carta revelada es válida, la juega
        if (isValidPlay(revealedCard, topCard)) {
            cardToPlay = aiPlayer.faceDown.splice(randomIndex, 1)[0]; // Remover la carta jugada
            fromArea = 'faceDown';
        } else {
            // Si la carta revelada NO es válida, la IA toma el montón
            showMessage(`El Jugador 2 no pudo jugar su carta boca abajo y toma el montón.`);
            // La carta revelada pero no jugada va al montón de descarte
            discardPile.push(aiPlayer.faceDown.splice(randomIndex, 1)[0]); 
            takePile(aiPlayer);
            renderCards();
            checkWinCondition();
            // Si la IA toma, su turno termina (el efecto del 2/7 no se aplica si tomó)
            twoEffectActive = false; // Asegurar que se resetee
            switchTurn();
            return;
        }
    }

    if (cardToPlay) {
        let sourceArray;
        if (fromArea === 'hand') sourceArray = aiPlayer.hand;
        else if (fromArea === 'faceUp') sourceArray = aiPlayer.faceUp;

        if (fromArea !== 'faceDown') { // Si no es faceDown, la carta ya fue spliceada arriba
            const index = sourceArray.findIndex(c => c.value === cardToPlay.value && c.suit === cardToPlay.suit);
            if (index !== -1) { // Asegurarse de que la carta aún esté en el array si se encuentra.
                sourceArray.splice(index, 1);
            }
        }
        
        discardPile.push(cardToPlay);
        showMessage(`El Jugador 2 ha jugado un ${cardToPlay.value} de ${cardToPlay.suit || 'Comodín'}.`);
        played = true;
        ensureMinHandCards(aiPlayer);
        await handleSpecialCards(cardToPlay);
    }

    if (!played) {
        showMessage(`El Jugador 2 no pudo jugar ninguna carta. ¡Toma el montón!`);
        takePile(aiPlayer);
    }

    renderCards();
    checkWinCondition();

    // Después de que la IA juega, verificamos si su efecto especial ('2' o '7') sigue activo.
    // Si lo está, la IA juega de nuevo. De lo contrario, cambiamos de turno.
    if (twoEffectActive && currentPlayer === 'player2') {
        // Si el efecto del 2/7 está activo y sigue siendo el turno de la IA, la IA juega de nuevo.
        setTimeout(aiPlay, 1500);
    } else {
        // Si no hay efecto activo o el efecto ya terminó, cambiar de turno.
        switchTurn();
    }
}


// 11. Función para el botón principal (Confirmar Mano / Tomar Montón)
if (mainActionButton) { // Verificar si el elemento existe antes de añadir el listener
    mainActionButton.addEventListener('click', () => {
        if (gameState === 'setup') {
            confirmHandSetup();
        } else if (gameState === 'playing') {
            if (!players.player1.isTurn) {
                showMessage("No es tu turno.");
                return;
            }
            showMessage("Has decidido tomar el montón de descarte.");
            twoEffectActive = false; // Si tomas el montón, cualquier efecto de '2' o '7' se anula.
            takePile(players.player1);
        }
    });
} else {
    console.error("Error: El botón con ID 'main-action-button' no fue encontrado en el DOM.");
}


// --- NUEVO BOTÓN: Reiniciar Juego ---
if (restartButton) { // Verificar si el elemento existe antes de añadir el listener
    restartButton.addEventListener('click', () => {
        initGame(); // Llama a la función de inicialización para reiniciar todo
    });
} else {
    console.error("Error: El botón con ID 'restart-button' no fue encontrado en el DOM.");
}
// ------------------------------------


// 12. Función para tomar el montón
function takePile(player) {
    player.hand = player.hand.concat(discardPile);
    discardPile = [];
    showMessage(`${player === players.player1 ? 'Has' : 'El Jugador 2 ha'} tomado el montón.`);
    shuffleDeck(player.hand);
    renderCards();
    twoEffectActive = false; // Importante: tomar el montón siempre resetea el efecto
    switchTurn(); // El que toma el montón siempre pierde el turno
}

// 13. Chequear Condición de Victoria
function checkWinCondition() {
    if (gameState !== 'playing') return false;

    if (players.player1.hand.length === 0 && players.player1.faceUp.length === 0 && players.player1.faceDown.length === 0) {
        gameState = 'gameOver'; // Establecer el estado del juego
        showMessage("¡Felicidades! ¡Has ganado el juego!");
        updateButtonStates(); // Actualizar botones al final del juego
        return true;
    } else if (players.player2.hand.length === 0 && players.player2.faceUp.length === 0 && players.player2.faceDown.length === 0) {
        gameState = 'gameOver'; // Establecer el estado del juego
        showMessage("¡El Jugador 2 ha ganado! Más suerte la próxima vez.");
        updateButtonStates(); // Actualizar botones al final del juego
        return true;
    }
    return false;
}


// 14. Mostrar mensajes en el juego
function showMessage(msg) {
    gameMessagesEl.textContent = msg;
}

// Función auxiliar para asegurar que el jugador tenga al menos 3 cartas en la mano
function ensureMinHandCards(player) {
    if (gameState !== 'playing') return; 

    while (player.hand.length < 3 && deck.length > 0) {
        player.hand.push(deck.pop());
    }
}

// --- Gestión de estados de los botones ---
function updateButtonStates() {
    if (gameState === 'setup') {
        if (mainActionButton) { // Verificar antes de usar
            mainActionButton.textContent = "Confirmar Mano y Empezar";
            mainActionButton.disabled = false;
        }
        if (restartButton) { // Verificar antes de usar
            restartButton.style.display = 'none'; // Ocultar Reiniciar
        }
    } else if (gameState === 'playing') {
        if (mainActionButton) { // Verificar antes de usar
            mainActionButton.textContent = "Tomar Montón";
            // Deshabilitar si es el turno de la IA y no está en un turno extra por un 2/7.
            // Si twoEffectActive es true y es turno de la IA, ella debe tomar la siguiente acción,
            // no el jugador.
            mainActionButton.disabled = (currentPlayer === 'player2' || twoEffectActive);
        }
        if (restartButton) { // Verificar antes de usar
            restartButton.style.display = 'none'; // Ocultar Reiniciar
        }
    } else if (gameState === 'gameOver') {
        if (mainActionButton) { // Verificar antes de usar
            mainActionButton.disabled = true; // Deshabilitar Tomar Montón
        }
        if (restartButton) { // Verificar antes de usar
            restartButton.style.display = 'inline-block'; // Mostrar Reiniciar
        }
    }
}

// --- Inicialización del Juego ---
function initGame() {
    createDeck();
    dealInitialCards();
    twoEffectActive = false; // Resetear cualquier efecto activo
    selectedSetupCard = null; // Resetear selección de setup
    selectedSetupCardElement = null; // Resetear elemento de selección

    gameState = 'setup'; // El juego siempre inicia en fase de preparación
    currentPlayer = ''; // No hay turno hasta que empiece el juego
    players.player1.isTurn = false; // No es el turno de nadie en setup
    players.player2.isTurn = false;

    renderCards(); // Renderizar las cartas para la fase de setup
    updateButtonStates(); // Actualizar el estado de los botones
    showMessage("¡Bienvenido a Etíope! Intercambia cartas entre tu mano y tus cartas boca arriba para empezar. Luego, haz clic en 'Confirmar Mano y Empezar'.");
}

// Iniciar el juego
initGame();
