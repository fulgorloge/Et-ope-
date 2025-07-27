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

// --- Referencias a elementos del DOM ---
const player1HandEl = document.getElementById('player1-hand');
const player1FaceUpEl = document.getElementById('player1-face-up');
const player1FaceDownEl = document.getElementById('player1-face-down');
const player2HandEl = document.getElementById('player2-hand');
const player2FaceUpEl = document.getElementById('player2-face-up');
const player2FaceDownEl = document.getElementById('player2-face-down');
const discardPileEl = document.getElementById('discard-pile');
const drawButton = document.getElementById('draw-button'); // Ahora es el botón "Tomar Montón"
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
    // 3 cartas en mano, 3 boca arriba, 3 boca abajo
    for (let playerKey in players) {
        for (let i = 0; i < 3; i++) {
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
    players.player1.faceDown.forEach(() => player1FaceDownEl.appendChild(createCardElement({ value: '?', suit: '?', type: 'hidden' }, 'player1', 'faceDown')));

    // Renderizar cartas del Jugador 2 (IA) - mano y boca abajo ocultas
    players.player2.hand.forEach(() => player2HandEl.appendChild(createCardElement({ value: '?', suit: '?', type: 'hidden' }, 'player2', 'hand')));
    players.player2.faceUp.forEach(card => player2FaceUpEl.appendChild(createCardElement(card, 'player2', 'faceUp')));
    players.player2.faceDown.forEach(() => player2FaceDownEl.appendChild(createCardElement({ value: '?', suit: '?', type: 'hidden' }, 'player2', 'faceDown')));

    // Renderizar solo la última carta del montón de descarte
    if (discardPile.length > 0) {
        discardPileEl.appendChild(createCardElement(discardPile[discardPile.length - 1], 'discard', 'top'));
    }
}

// 5. Crear elemento HTML de una carta (con gestión de clics)
function createCardElement(card, owner, area) {
    const cardEl = document.createElement('div');
    cardEl.classList.add('card');
    cardEl.textContent = card.value;

    if (card.type === 'hidden') {
        cardEl.classList.add('hidden'); // Para cartas boca abajo o mano del oponente
    } else if (card.suit === 'Hearts' || card.suit === 'Diamonds') {
        cardEl.classList.add('red');
    }
    // Añadir data-attributes para identificar la carta al hacer clic
    cardEl.dataset.value = card.value;
    cardEl.dataset.suit = card.suit;
    cardEl.dataset.type = card.type;
    cardEl.dataset.owner = owner; // 'player1' o 'player2'
    cardEl.dataset.area = area; // 'hand', 'faceUp', 'faceDown'

    // Lógica para que el Jugador 1 pueda hacer clic en sus cartas
    if (owner === 'player1' && players.player1.isTurn) {
        // --- CAMBIO: ORDEN DE FASES DE JUEGO (Clics UI para Jugador 1) ---
        // Prioridad: 1. Mano -> 2. Boca Arriba -> 3. Boca Abajo
        const p1 = players.player1;

        if (area === 'hand' && p1.hand.length > 0) {
            // Siempre se puede jugar de la mano si hay cartas
            cardEl.addEventListener('click', () => playCard(card, 'hand'));
        } else if (area === 'faceUp' && p1.hand.length === 0 && p1.faceUp.length > 0) {
            // Solo se puede jugar de boca arriba si la mano está vacía
            cardEl.addEventListener('click', () => playCard(card, 'faceUp'));
        } else if (area === 'faceDown' && p1.hand.length === 0 && p1.faceUp.length === 0 && deck.length === 0 && p1.faceDown.length > 0) {
            // Solo se puede jugar de boca abajo si la mano está vacía,
            // las cartas boca arriba están vacías Y el mazo está vacío.
            cardEl.addEventListener('click', () => playCard(card, 'faceDown', cardEl));
        } else {
            // Si la carta no está en la fase de juego activa, no es clicable
            cardEl.classList.add('disabled'); // Opcional: añade una clase para indicar que no es clicable
        }
        // -----------------------------------------------------------------
    }
    return cardEl;
}

// 6. Lógica para Jugar una Carta
async function playCard(cardToPlay, fromArea, clickedElement = null) {
    if (!players[currentPlayer].isTurn) {
        showMessage("No es tu turno.");
        return;
    }

    const p = players[currentPlayer]; // Referencia al jugador actual

    // --- CAMBIO: ORDEN DE FASES DE JUEGO (Validación en playCard) ---
    // Asegurar que la carta se juega desde la fase correcta
    if (fromArea === 'hand' && p.hand.length === 0) {
        showMessage("Error: No tienes cartas en tu mano para jugar.");
        return;
    }
    if (fromArea === 'faceUp' && (p.hand.length > 0 || p.faceUp.length === 0)) {
        showMessage("Debes jugar las cartas de tu mano primero, o no tienes cartas boca arriba.");
        return;
    }
    if (fromArea === 'faceDown' && (p.hand.length > 0 || p.faceUp.length > 0 || deck.length > 0 || p.faceDown.length === 0)) {
        showMessage("Solo puedes jugar cartas boca abajo si tu mano y tus cartas boca arriba están vacías, y el mazo está agotado.");
        return;
    }
    // ------------------------------------------------------------------

    let actualCardToPlay = cardToPlay;
    let cardIndex;
    let playedSuccessfully = false;

    if (fromArea === 'faceDown') {
        actualCardToPlay = p.faceDown.shift();
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

    await handleSpecialCards(actualCardToPlay);

    renderCards();
    checkWinCondition();

    if (!twoEffectActive) {
        switchTurn();
    }
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
    // Resetear el efecto del 2 (o 7) si la carta actual no es un 2.
    // Esto es crucial para que el turno cambie después de la segunda carta del combo del 2,
    // o para que el turno pase después de que un 7 fue jugado y su efecto se aplicó.
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

    // --- Efecto del 2 ---
    if (playedCard.value === '2') {
        showMessage("¡Has jugado un 2! Tira otra carta.");
        twoEffectActive = true; // Activa la bandera para permitir otro turno
        return; // Salir, ya que el jugador lanzará otra carta
    }

    // --- CAMBIO AÑADIDO: EFECTO DEL 7 (Revertir Sentido) ---
    if (playedCard.value === '7') {
        showMessage("¡Has jugado un 7! ¡El sentido del juego se ha revertido! Te toca de nuevo.");
        // Para dos jugadores, "revertir sentido" significa que el turno se queda con el jugador actual.
        // La bandera 'twoEffectActive' evitará que 'switchTurn()' se ejecute al final del ciclo de juego.
        twoEffectActive = true;
        return; // Salir, ya que el turno se mantiene para este jugador.
    }
    // --------------------------------------------------------

    // --- Efecto de Trío ---
    // Chequear las últimas 3 cartas jugadas (incluyendo la actual)
    if (discardPile.length >= 3) {
        const lastThreeCards = discardPile.slice(-3);
        // Necesitamos normalizar los valores, especialmente si hay Jokers
        // Un Joker toma el valor de la carta que lo acompaña en el trío
        let potentialTrioValue = null;
        const nonJokerCards = lastThreeCards.filter(c => c.type !== 'joker' && c.type !== 'joker-chosen');

        if (nonJokerCards.length > 0) {
            potentialTrioValue = nonJokerCards[0].value;
        } else if (lastThreeCards.length === 3 && lastThreeCards.every(c => c.type === 'joker' || c.type === 'joker-chosen')) {
            // Si son 3 jokers, el jugador debería decidir qué valor representa el trío
            if (currentPlayer === 'player1') {
                const chosenValue = await askForJokerValue(); // Preguntar al jugador el valor del trío de Jokers
                if (chosenValue) {
                    potentialTrioValue = chosenValue;
                } else {
                    return; // Jugador canceló, no se forma el trío
                }
            } else { // IA elige un valor para el trío de Jokers (básico)
                potentialTrioValue = values[Math.floor(Math.random() * values.length)];
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

                // Quemar cartas de ese valor en las manos de TODOS los jugadores
                for (let playerKey in players) {
                    players[playerKey].hand = players[playerKey].hand.filter(card => {
                        // Un Joker en la mano TAMBIÉN se quema si su valor elegido PUEDE ser el valor del trío
                        if (card.value === potentialTrioValue || card.type === 'joker' || card.type === 'joker-chosen') {
                            return false; // Eliminar la carta
                        }
                        return true; // Mantener la carta
                    });
                }
                renderCards(); // Volver a renderizar para mostrar las manos actualizadas
            }
        }
    }
}


// 9. Cambiar de Turno
function switchTurn() {
    // Solo cambiar de turno si el efecto del 2 (o 7) NO está activo
    if (!twoEffectActive) {
        players[currentPlayer].isTurn = false;
        currentPlayer = (currentPlayer === 'player1') ? 'player2' : 'player1';
        players[currentPlayer].isTurn = true;
        showMessage(`Es el turno de ${currentPlayer === 'player1' ? 'Jugador 1' : 'Jugador 2'}.`);

        // Si es el turno de la IA (player2), debería hacer un movimiento
        if (currentPlayer === 'player2') {
            setTimeout(aiPlay, 1500); // Dar un pequeño retraso para la IA
        }
    }
}

// 10. Lógica de la IA (Jugador 2)
async function aiPlay() {
    const aiPlayer = players.player2;
    const topCard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
    let played = false;
    let cardToPlay = null;
    let fromArea = '';

    const findBestPlay = (cards) => {
        const sortedCards = [...cards].sort((a, b) => getValueNumber(a.value) - getValueNumber(b.value));
        for (let card of sortedCards) {
            if (isValidPlay(card, topCard)) {
                return card;
            }
        }
        return null;
    };

    // --- CAMBIO: ORDEN DE FASES DE JUEGO (Prioridad de la IA) ---

    // 1. Intentar jugar de la mano si tiene cartas en mano
    if (aiPlayer.hand.length > 0) {
        cardToPlay = findBestPlay(aiPlayer.hand);
        if (cardToPlay) {
            fromArea = 'hand';
        }
    }

    // 2. Si mano vacía, intentar jugar de boca arriba
    if (!cardToPlay && aiPlayer.hand.length === 0 && aiPlayer.faceUp.length > 0) {
        cardToPlay = findBestPlay(aiPlayer.faceUp);
        if (cardToPlay) {
            fromArea = 'faceUp';
        }
    }
    
    // 3. Si mano y boca arriba vacías Y mazo vacío, intentar jugar de boca abajo
    if (!cardToPlay && aiPlayer.hand.length === 0 && aiPlayer.faceUp.length === 0 && deck.length === 0 && aiPlayer.faceDown.length > 0) {
        // La IA simplemente intenta la primera carta boca abajo.
        // La validación de si es jugable ocurre en el if/else anidado.
        const revealedCard = aiPlayer.faceDown[0]; // Mira la carta, no la quita aún
        showMessage(`El Jugador 2 ha revelado una carta boca abajo.`); // Se anuncia la revelación antes de saber si es válida

        if (isValidPlay(revealedCard, topCard)) {
            cardToPlay = aiPlayer.faceDown.shift(); // Ahora sí la quita
            fromArea = 'faceDown';
        } else {
            // Si la carta boca abajo no es válida, la IA toma el montón.
            // Esto es una excepción a la jugada normal, por eso se maneja aquí directamente.
            showMessage(`El Jugador 2 no pudo jugar su carta boca abajo y toma el montón.`);
            takePile(aiPlayer);
            renderCards(); // Renderizar después de tomar el montón
            checkWinCondition();
            if (!twoEffectActive) {
                switchTurn();
            }
            return; // Termina el turno de la IA aquí.
        }
    }

    // Procesar la jugada encontrada (o si no se encontró ninguna)
    if (cardToPlay) {
        let sourceArray;
        if (fromArea === 'hand') sourceArray = aiPlayer.hand;
        else if (fromArea === 'faceUp') sourceArray = aiPlayer.faceUp;
        // Si fromArea es 'faceDown', la carta ya fue shift-eada en el bloque de arriba.

        if (fromArea !== 'faceDown') { // Si no es de boca abajo, la removemos del array.
            const index = sourceArray.findIndex(c => c.value === cardToPlay.value && c.suit === cardToPlay.suit);
            sourceArray.splice(index, 1);
        }
        
        discardPile.push(cardToPlay);
        showMessage(`El Jugador 2 ha jugado un ${cardToPlay.value} de ${cardToPlay.suit || 'Comodín'}.`);
        played = true;
        ensureMinHandCards(aiPlayer);
        await handleSpecialCards(cardToPlay);
    }
    // ------------------------------------------------------------------

    // Si la IA no pudo jugar nada de ninguna de sus áreas (después de considerar todas las fases), toma el montón.
    if (!played) {
        showMessage(`El Jugador 2 no pudo jugar ninguna carta. ¡Toma el montón!`);
        takePile(aiPlayer);
    }

    renderCards();
    checkWinCondition();

    if (!twoEffectActive) {
        switchTurn();
    }
}


// 11. Función para el botón de "Tomar Montón" (para el Jugador 1)
drawButton.addEventListener('click', () => {
    if (!players.player1.isTurn) {
        showMessage("No es tu turno.");
        return;
    }

    showMessage("Has decidido tomar el montón de descarte.");
    takePile(players.player1);
});

// 12. Función para tomar el montón
function takePile(player) {
    player.hand = player.hand.concat(discardPile);
    discardPile = [];
    showMessage(`${player === players.player1 ? 'Has' : 'El Jugador 2 ha'} tomado el montón.`);
    shuffleDeck(player.hand);
    renderCards();
    twoEffectActive = false; // Asegurar que el efecto del 2 o 7 se reinicie
    switchTurn(); // Después de tomar el montón, el turno siempre pasa
}

// 13. Chequear Condición de Victoria
function checkWinCondition() {
    // Un jugador gana cuando se queda sin cartas en mano, boca arriba y boca abajo
    if (players.player1.hand.length === 0 && players.player1.faceUp.length === 0 && players.player1.faceDown.length === 0) {
        showMessage("¡Felicidades! ¡Has ganado el juego!");
        // Aquí puedes agregar lógica para reiniciar o terminar el juego
        // Por ejemplo, deshabilitar interacciones o mostrar un botón de "Reiniciar"
        return true;
    } else if (players.player2.hand.length === 0 && players.player2.faceUp.length === 0 && players.player2.faceDown.length === 0) {
        showMessage("¡El Jugador 2 ha ganado! Más suerte la próxima vez.");
        // Aquí puedes agregar lógica para reiniciar o terminar el juego
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
    while (player.hand.length < 3 && deck.length > 0) {
        player.hand.push(deck.pop());
        // Puedes ajustar este mensaje si se repite mucho, o hacerlo más general.
        // showMessage(`${player === players.player1 ? 'Has' : 'El Jugador 2 ha'} robado una carta para reponer su mano (mínimo de 3).`);
    }
    if (player.hand.length < 3 && deck.length === 0) {
        // showMessage("No quedan cartas en el mazo para reponer la mano al mínimo de 3.");
    }
}

// --- Inicialización del Juego ---
function initGame() {
    createDeck();
    dealInitialCards();
    currentPlayer = 'player1'; // El Jugador 1 empieza
    players.player1.isTurn = true;
    renderCards();
    showMessage("¡El juego Etíope ha comenzado! Es tu turno.");
}

// Iniciar el juego
initGame();
