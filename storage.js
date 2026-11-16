const STORAGE_KEY = "flashcards-app-state";
const STORAGE_VERSION = 1;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidDeckList(decks) {
  if (!Array.isArray(decks)) {
    return false;
  }

  const ids = new Set();
  return decks.every((deck) => {
    if (
      !isObject(deck) ||
      typeof deck.id !== "string" ||
      !deck.id ||
      ids.has(deck.id) ||
      typeof deck.name !== "string" ||
      !deck.name.trim() ||
      !Array.isArray(deck.cards)
    ) {
      return false;
    }

    ids.add(deck.id);
    return deck.cards.every((card) =>
      isObject(card) &&
      typeof card.front === "string" &&
      typeof card.back === "string"
    );
  });
}

function loadState() {
  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (storedValue === null) {
      return null;
    }

    const parsedState = JSON.parse(storedValue);
    if (
      !isObject(parsedState) ||
      parsedState.version !== STORAGE_VERSION ||
      !isValidDeckList(parsedState.decks)
    ) {
      console.warn("Saved flashcards data is invalid or uses an unsupported version. Loading default decks.");
      return null;
    }

    const activeDeckId =
      typeof parsedState.activeDeckId === "string" &&
      parsedState.decks.some((deck) => deck.id === parsedState.activeDeckId)
        ? parsedState.activeDeckId
        : parsedState.decks[0]?.id || null;

    return { decks: parsedState.decks, activeDeckId };
  } catch (error) {
    console.error("Could not load saved flashcards data. Loading default decks.", error);
    return null;
  }
}

function saveState(state) {
  try {
    if (
      !isObject(state) ||
      !isValidDeckList(state.decks) ||
      (state.activeDeckId !== null &&
        state.activeDeckId !== undefined &&
        (typeof state.activeDeckId !== "string" ||
          !state.decks.some((deck) => deck.id === state.activeDeckId)))
    ) {
      throw new TypeError("Flashcards state must contain valid decks and an active deck ID.");
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        decks: state.decks,
        activeDeckId: state.activeDeckId || null
      })
    );
    return true;
  } catch (error) {
    console.error("Could not save flashcards data.", error);
    return false;
  }
}

window.loadState = loadState;
window.saveState = saveState;
