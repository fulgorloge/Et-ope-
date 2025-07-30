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
