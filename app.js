const defaultDecks = [
  {
    id: "getting-started",
    name: "Getting started",
    cards: [
      {
        front: "What is a flashcard?",
        back: "A study tool with a prompt on one side and its answer on the other."
      },
      {
        front: "How do you study a card?",
        back: "Read the front, recall the answer, then flip the card to check."
      }
    ]
  },
  {
    id: "web-basics",
    name: "Web basics",
    cards: [
      {
        front: "What does HTML describe?",
        back: "The structure and meaning of content on a web page."
      },
      {
        front: "What does CSS control?",
        back: "The presentation and layout of web content."
      }
    ]
  }
];

const savedState = window.loadState();
let decks = savedState ? savedState.decks : defaultDecks;

const deckList = document.querySelector("#deck-list");
const deckTitle = document.querySelector("#deck-title");
const cardPosition = document.querySelector("#card-position");
const searchInput = document.querySelector("#card-search");
const flashcard = document.querySelector("#flashcard");
const cardFrontFace = document.querySelector("#card-front-face");
const cardBackFace = document.querySelector("#card-back-face");
const flashcardScene = document.querySelector("#flashcard-scene");
const cardControls = document.querySelector(".card-controls");
const emptyState = document.querySelector("#empty-state");
const emptyStateTitle = document.querySelector("#empty-state-title");
const emptyStateMessage = document.querySelector("#empty-state-message");
const emptyStateAction = document.querySelector("#empty-state-action");
const emptyStateIcons = [
  document.querySelector("#empty-decks-icon"),
  document.querySelector("#empty-cards-icon"),
  document.querySelector("#no-results-icon")
];
const flashcardFront = document.querySelector("#flashcard-front");
const flashcardBack = document.querySelector("#flashcard-back");
const previousButton = document.querySelector("#previous-card");
const nextButton = document.querySelector("#next-card");
const flipButton = document.querySelector("#flip-card");
const shuffleButton = document.querySelector("#shuffle-cards");
const newDeckButton = document.querySelector("#new-deck");
const newCardButton = document.querySelector("#new-card");
const studyModeToggle = document.querySelector("#study-mode-toggle");
const editCardButton = document.querySelector("#edit-card");
const deleteCardButton = document.querySelector("#delete-card");
const deckDialog = document.querySelector("#deck-dialog");
const deleteDeckDialog = document.querySelector("#delete-deck-dialog");
const newCardDialog = document.querySelector("#new-card-dialog");
const deleteCardDialog = document.querySelector("#delete-card-dialog");
const deckForm = document.querySelector("#deck-form");
const newCardForm = document.querySelector("#new-card-form");
const deckDialogHeading = document.querySelector("#deck-dialog-heading");
const deckNameInput = document.querySelector("#deck-name");
const saveDeckButton = document.querySelector("#save-deck");
const deleteDeckMessage = document.querySelector("#delete-deck-message");
const confirmDeleteDeckButton = document.querySelector("#confirm-delete-deck");
const cardFrontInput = document.querySelector("#card-front");
const cardBackInput = document.querySelector("#card-back");
const newCardHeading = document.querySelector("#new-card-heading");
const saveCardButton = document.querySelector("#save-card");
const deleteCardMessage = document.querySelector("#delete-card-message");
const confirmDeleteCardButton = document.querySelector("#confirm-delete-card");

let activeDeckId =
  savedState?.activeDeckId && decks.some((deck) => deck.id === savedState.activeDeckId)
    ? savedState.activeDeckId
    : decks[0]?.id || null;
let currentIndex = 0;
let isFlipped = false;
let shuffledCards = null;
let nextDeckId = Math.max(0, ...decks.map((deck) => {
  const match = /^deck-(\d+)$/.exec(deck.id);
  return match ? Number(match[1]) : 0;
})) + 1;
let editingDeckId = null;
let pendingDeleteDeckId = null;
let editingCard = null;
let pendingDeleteCard = null;
let studyModeActive = false;
let appliedSearchQuery = "";
let searchDebounceTimer = null;

function canFocus(element) {
  return (
    element instanceof HTMLElement &&
    element.isConnected &&
    !element.matches(":disabled") &&
    !element.closest('[aria-hidden="true"], [inert]') &&
    window.getComputedStyle(element).visibility !== "hidden" &&
    element.getClientRects().length > 0
  );
}

class AccessibleModal {
  constructor(dialog) {
    this.dialog = dialog;
    this.opener = null;
    this.returnFocusFallback = null;

    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.close();
    });

    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.close();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = [...dialog.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter(canFocus);

      if (!focusableElements.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    });

    dialog.addEventListener("close", () => {
      const fallback = this.returnFocusFallback;
      const opener = this.opener;

      this.opener = null;
      this.returnFocusFallback = null;

      window.requestAnimationFrame(() => {
        const focusTarget = typeof fallback === "function" ? fallback() : fallback;
        const target = canFocus(opener) ? opener : focusTarget;
        if (canFocus(target)) {
          target.focus();
        }
      });
    });
  }

  open(opener = document.activeElement, initialFocus = null, returnFocusFallback = null) {
    if (this.dialog.open) {
      return;
    }

    this.opener = opener;
    this.returnFocusFallback = returnFocusFallback;
    this.dialog.showModal();
    (initialFocus || this.dialog.querySelector(
      'input:not([type="hidden"]), textarea, button:not([data-modal-close])'
    ) || this.dialog).focus();
  }

  close(returnFocusFallback = this.returnFocusFallback) {
    if (!this.dialog.open) {
      return;
    }

    this.returnFocusFallback = returnFocusFallback;
    this.dialog.close();
  }
}

const deckModal = new AccessibleModal(deckDialog);
const deleteDeckModal = new AccessibleModal(deleteDeckDialog);
const cardModal = new AccessibleModal(newCardDialog);
const deleteCardModal = new AccessibleModal(deleteCardDialog);

function getActiveDeck() {
  return decks.find((deck) => deck.id === activeDeckId) || null;
}

function getVisibleCards() {
  const deck = getActiveDeck();
  if (!deck) {
    return [];
  }

  const cards = shuffledCards || deck.cards;
  return cards.filter((card) =>
    `${card.front} ${card.back}`.toLocaleLowerCase().includes(appliedSearchQuery)
  );
}

function resetSearch() {
  if (searchDebounceTimer !== null) {
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
  searchInput.value = "";
  appliedSearchQuery = "";
}

function persistState() {
  window.saveState({ decks, activeDeckId });
}

function deckFocusFallback(deckId) {
  return () =>
    deckList.querySelector(`[data-deck-id="${deckId}"]`) ||
    deckList.querySelector('[aria-pressed="true"]') ||
    newDeckButton;
}

function renderDecks() {
  deckList.replaceChildren();

  for (const deck of decks) {
    const item = document.createElement("li");
    item.className = "deck-list-item";

    const selectButton = document.createElement("button");
    selectButton.className = "deck-button";
    selectButton.type = "button";
    selectButton.dataset.deckId = deck.id;
    selectButton.textContent = deck.name;

    selectButton.setAttribute("aria-pressed", String(deck.id === activeDeckId));

    selectButton.addEventListener("click", () => {
      enterStudyMode(deck.id, true);
    });

    const actions = document.createElement("div");
    actions.className = "deck-actions";
    actions.setAttribute("role", "group");
    actions.setAttribute("aria-label", `${deck.name} actions`);

    const editButton = document.createElement("button");
    editButton.className = "deck-action-button";
    editButton.type = "button";
    editButton.textContent = "Rename";
    editButton.setAttribute("aria-label", `Rename ${deck.name}`);
    editButton.addEventListener("click", () => openEditDeck(deck, editButton));

    const deleteButton = document.createElement("button");
    deleteButton.className = "deck-action-button deck-delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete ${deck.name}`);
    deleteButton.addEventListener("click", () => openDeleteDeck(deck, deleteButton));

    actions.append(editButton, deleteButton);
    item.append(selectButton, actions);
    deckList.append(item);
  }
}

function renderCard() {
  const deck = getActiveDeck();
  const cards = getVisibleCards();
  const card = cards[currentIndex];

  if (!deck) {
    deckTitle.textContent = "No decks yet";
    cardPosition.textContent = "Create a deck to get started";
    flashcard.classList.remove("is-flipped");
    flashcard.setAttribute("aria-label", "Empty flashcard");
    flashcardFront.textContent = "Create a deck to start studying.";
    flashcardBack.textContent = "";
    cardFrontFace.setAttribute("aria-hidden", "false");
    cardBackFace.setAttribute("aria-hidden", "true");
    newCardButton.disabled = true;
    studyModeToggle.disabled = true;
    shuffleButton.disabled = true;
    flipButton.disabled = true;
    previousButton.disabled = true;
    nextButton.disabled = true;
    editCardButton.disabled = true;
    deleteCardButton.disabled = true;
    flipButton.setAttribute("aria-pressed", "false");
    showEmptyState(
      "No decks yet",
      "Create a deck to organize your flashcards and start studying.",
      "Create a deck",
      "new-deck",
      0
    );
    return;
  }

  newCardButton.disabled = false;
  studyModeToggle.disabled = false;
  shuffleButton.disabled = deck.cards.length < 2;
  deckTitle.textContent = deck.name;
  cardPosition.textContent = cards.length
    ? appliedSearchQuery
      ? `${cards.length} ${cards.length === 1 ? "match" : "matches"} - ${currentIndex + 1} of ${cards.length}`
      : `${currentIndex + 1} of ${cards.length} cards`
    : appliedSearchQuery
      ? "0 matches"
      : "No cards";

  if (!card) {
    isFlipped = false;
    flashcard.classList.remove("is-flipped");
    flashcard.setAttribute("aria-label", "Empty flashcard");
    flashcardFront.textContent = appliedSearchQuery
      ? "No cards found. Try a different keyword or clear your search."
      : "This deck is empty. Add a card to get started.";
    flashcardBack.textContent = "";
    cardFrontFace.setAttribute("aria-hidden", "false");
    cardBackFace.setAttribute("aria-hidden", "true");
    flipButton.disabled = true;
    previousButton.disabled = true;
    nextButton.disabled = true;
    editCardButton.disabled = true;
    deleteCardButton.disabled = true;
    flipButton.setAttribute("aria-pressed", "false");
    showEmptyState(
      appliedSearchQuery ? "No cards found" : "No cards yet",
      appliedSearchQuery
        ? "Try a different keyword, or clear your search to see every card in this deck."
        : "Add a front and back to create your first flashcard in this deck.",
      appliedSearchQuery ? "Clear search" : "Add your first card",
      appliedSearchQuery ? "clear-search" : "new-card",
      appliedSearchQuery ? 2 : 1
    );
    return;
  }

  showFlashcard();
  flashcardFront.textContent = card.front;
  flashcardBack.textContent = card.back;
  flashcard.classList.toggle("is-flipped", isFlipped);
  flashcard.setAttribute("aria-label", isFlipped ? "Flashcard back" : "Flashcard front");
  cardFrontFace.setAttribute("aria-hidden", String(isFlipped));
  cardBackFace.setAttribute("aria-hidden", String(!isFlipped));
  flipButton.disabled = false;
  previousButton.disabled = currentIndex === 0;
  nextButton.disabled = currentIndex === cards.length - 1;
  editCardButton.disabled = false;
  deleteCardButton.disabled = false;
  flipButton.setAttribute("aria-pressed", String(isFlipped));
}

function render() {
  renderDecks();
  renderCard();
}

function showEmptyState(title, message, actionLabel, action, iconIndex) {
  emptyStateTitle.textContent = title;
  emptyStateMessage.textContent = message;
  emptyStateAction.textContent = actionLabel;
  emptyStateAction.dataset.action = action;
  emptyStateIcons.forEach((icon, index) => {
    icon.toggleAttribute("hidden", index !== iconIndex);
  });
  emptyState.hidden = false;
  flashcardScene.hidden = true;
  cardControls.hidden = true;
}

function showFlashcard() {
  emptyState.hidden = true;
  flashcardScene.hidden = false;
  cardControls.hidden = false;
}

function exitStudyMode() {
  if (!studyModeActive) {
    return;
  }

  document.removeEventListener("keydown", handleStudyKeydown);
  studyModeActive = false;
  studyModeToggle.textContent = "Enter Study Mode";
  studyModeToggle.setAttribute("aria-pressed", "false");
}

function enterStudyMode(deckId, restoreDeckFocus = false) {
  const deck = decks.find((item) => item.id === deckId);
  if (!deck) {
    return false;
  }

  exitStudyMode();
  activeDeckId = deck.id;
  currentIndex = 0;
  isFlipped = false;
  shuffledCards = null;
  resetSearch();
  studyModeActive = true;
  studyModeToggle.textContent = "Exit Study Mode";
  studyModeToggle.setAttribute("aria-pressed", "true");
  document.addEventListener("keydown", handleStudyKeydown);
  persistState();
  render();
  if (restoreDeckFocus) {
    deckList.querySelector(`[data-deck-id="${deck.id}"]`)?.focus();
  }
  return true;
}

function handleStudyKeydown(event) {
  if (!studyModeActive || document.querySelector("dialog[open]") || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    exitStudyMode();
    studyModeToggle.focus();
    return;
  }

  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']"))
  ) {
    return;
  }

  const cards = getVisibleCards();
  if (!cards.length) {
    return;
  }

  if (event.key === "ArrowLeft" && currentIndex > 0) {
    event.preventDefault();
    currentIndex -= 1;
    isFlipped = false;
    renderCard();
  } else if (event.key === "ArrowRight" && currentIndex < cards.length - 1) {
    event.preventDefault();
    currentIndex += 1;
    isFlipped = false;
    renderCard();
  } else if (event.key === " " || event.key.toLowerCase() === "f") {
    if (event.key === " " && target instanceof HTMLElement && target.closest("button, a")) {
      return;
    }

    event.preventDefault();
    isFlipped = !isFlipped;
    renderCard();
  }
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function openEditDeck(deck, opener) {
  editingDeckId = deck.id;
  deckDialogHeading.textContent = "Rename deck";
  saveDeckButton.textContent = "Save changes";
  deckNameInput.value = deck.name;
  deckModal.open(opener, deckNameInput, deckFocusFallback(deck.id));
}

function openDeleteDeck(deck, opener) {
  pendingDeleteDeckId = deck.id;
  deleteDeckMessage.textContent = `Delete "${deck.name}" and its ${deck.cards.length} cards? This cannot be undone.`;
  deleteDeckModal.open(opener, confirmDeleteDeckButton, deckFocusFallback(activeDeckId));
}

function openNewDeckDialog(opener) {
  editingDeckId = null;
  deckDialogHeading.textContent = "Create a deck";
  saveDeckButton.textContent = "Create deck";
  deckForm.reset();
  deckModal.open(opener, deckNameInput, newDeckButton);
}

studyModeToggle.addEventListener("click", () => {
  if (studyModeActive) {
    exitStudyMode();
  } else if (activeDeckId) {
    enterStudyMode(activeDeckId);
  }
});

document.querySelectorAll("[data-modal-close]").forEach((button) => {
  button.addEventListener("click", () => {
    const modal = [deckModal, deleteDeckModal, cardModal, deleteCardModal].find(
      (candidate) => candidate.dialog === button.closest("dialog")
    );
    modal?.close();
  });
});

deckDialog.addEventListener("close", () => {
  deckForm.reset();
  editingDeckId = null;
});

newCardDialog.addEventListener("close", () => {
  newCardForm.reset();
  editingCard = null;
});

deleteCardDialog.addEventListener("close", () => {
  pendingDeleteCard = null;
});

deckForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = deckNameInput.value.trim();

  if (!name) {
    deckNameInput.setCustomValidity("Enter a deck name.");
    deckNameInput.reportValidity();
    deckNameInput.setCustomValidity("");
    return;
  }

  if (editingDeckId) {
    const deck = decks.find((item) => item.id === editingDeckId);
    if (!deck) {
      return;
    }
    deck.name = name;
    const updatedDeckId = deck.id;
    persistState();
    deckModal.close(deckFocusFallback(updatedDeckId));
    render();
    return;
  }

  const deck = {
    id: `deck-${nextDeckId}`,
    name,
    cards: []
  };
  nextDeckId += 1;
  decks.push(deck);
  deckModal.close();
  enterStudyMode(deck.id);
});

confirmDeleteDeckButton.addEventListener("click", () => {
  const deletedDeckId = pendingDeleteDeckId;
  const deletedIndex = decks.findIndex((deck) => deck.id === deletedDeckId);
  if (deletedIndex < 0) {
    return;
  }

  decks.splice(deletedIndex, 1);
  let replacementDeck = null;
  if (activeDeckId === deletedDeckId) {
    replacementDeck = decks[Math.min(deletedIndex, decks.length - 1)] || null;
  }

  pendingDeleteDeckId = null;
  deleteDeckModal.close(deckFocusFallback(activeDeckId));
  if (replacementDeck) {
    enterStudyMode(replacementDeck.id);
  } else if (activeDeckId === deletedDeckId) {
    exitStudyMode();
    activeDeckId = null;
    currentIndex = 0;
    isFlipped = false;
    shuffledCards = null;
    resetSearch();
    render();
    persistState();
  } else {
    persistState();
    render();
  }
});

deleteDeckDialog.addEventListener("close", () => {
  pendingDeleteDeckId = null;
});

newCardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const front = cardFrontInput.value.trim();
  const back = cardBackInput.value.trim();

  if (!front || !back) {
    const emptyInput = front ? cardBackInput : cardFrontInput;
    emptyInput.setCustomValidity("Complete both sides of the card.");
    emptyInput.reportValidity();
    emptyInput.setCustomValidity("");
    return;
  }

  const deck = getActiveDeck();
  if (!deck) {
    return;
  }

  if (editingCard) {
    const cardIndex = deck.cards.indexOf(editingCard);
    if (cardIndex < 0) {
      return;
    }

    editingCard.front = front;
    editingCard.back = back;
    currentIndex = cardIndex;
  } else {
    deck.cards.push({ front, back });
    currentIndex = deck.cards.length - 1;
  }

  persistState();
  isFlipped = false;
  shuffledCards = null;
  resetSearch();
  cardModal.close();
  render();
});

searchInput.addEventListener("input", () => {
  if (searchDebounceTimer !== null) {
    window.clearTimeout(searchDebounceTimer);
  }

  searchDebounceTimer = window.setTimeout(() => {
    appliedSearchQuery = searchInput.value.trim().toLocaleLowerCase();
    searchDebounceTimer = null;
    currentIndex = 0;
    isFlipped = false;
    renderCard();
  }, 300);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const cards = getVisibleCards();
  const card = cards[currentIndex];

  switch (button.dataset.action) {
    case "new-deck":
      openNewDeckDialog(button);
      break;
    case "new-card":
      editingCard = null;
      newCardForm.reset();
      newCardHeading.textContent = "Create a card";
      saveCardButton.textContent = "Create card";
      cardModal.open(button, cardFrontInput, newCardButton);
      break;
    case "clear-search":
      resetSearch();
      currentIndex = 0;
      isFlipped = false;
      renderCard();
      searchInput.focus();
      break;
    case "edit-card":
      if (!card) {
        return;
      }
      editingCard = card;
      cardFrontInput.value = card.front;
      cardBackInput.value = card.back;
      newCardHeading.textContent = "Edit card";
      saveCardButton.textContent = "Save changes";
      cardModal.open(button, cardFrontInput, newCardButton);
      break;
    case "delete-card":
      if (!card) {
        return;
      }
      pendingDeleteCard = card;
      deleteCardMessage.textContent = `Delete this card from "${getActiveDeck().name}"? This cannot be undone.`;
      deleteCardModal.open(button, confirmDeleteCardButton, newCardButton);
      break;
    case "confirm-delete-card": {
      const deck = getActiveDeck();
      const cardIndex = deck?.cards.indexOf(pendingDeleteCard) ?? -1;
      if (cardIndex < 0) {
        return;
      }

      deck.cards.splice(cardIndex, 1);
      persistState();
      shuffledCards = null;
      currentIndex = Math.min(currentIndex, Math.max(0, getVisibleCards().length - 1));
      isFlipped = false;
      render();
      deleteCardModal.close(newCardButton);
      break;
    }
    case "shuffle-cards": {
      const deck = getActiveDeck();
      if (!deck) {
        return;
      }

      shuffledCards = shuffle(deck.cards);
      currentIndex = 0;
      isFlipped = false;
      renderCard();
      break;
    }
    case "previous-card":
      if (currentIndex > 0) {
        currentIndex -= 1;
        isFlipped = false;
        renderCard();
      }
      break;
    case "next-card":
      if (currentIndex < cards.length - 1) {
        currentIndex += 1;
        isFlipped = false;
        renderCard();
      }
      break;
    case "flip-card":
      if (card) {
        isFlipped = !isFlipped;
        renderCard();
      }
      break;
    default:
      break;
  }
});

if (activeDeckId) {
  enterStudyMode(activeDeckId);
} else {
  render();
}
