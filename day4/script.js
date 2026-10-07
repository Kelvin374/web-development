// 1. Select DOM Elements
const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearBtn = document.querySelector("#clear-btn");
const addBtn = document.querySelector("#add-btn");
const themeToggle = document.querySelector("#theme-toggle");
const notesList = document.querySelector("#notes-list");
const savedNotesCount = document.querySelector("#saved-notes-count");

// 2. Storage Keys
const DRAFT_KEY = "quicknotes_draft";
const THEME_KEY = "quicknotes_theme";
const NOTES_KEY = "quicknotes_list";

// 3. Notes State Management
let notes = loadNotes();

function loadNotes() {
  const saved = localStorage.getItem(NOTES_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveNotes() {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function renderNotes() {
  if (!notesList) return;
  notesList.innerHTML = "";

  if (notes.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.classList.add("empty-state");
    emptyLi.textContent = "No notes saved yet. Write a note above and click \"Add Note\"!";
    notesList.appendChild(emptyLi);
  } else {
    notes.forEach((note) => {
      const li = document.createElement("li");
      li.classList.add("note-item");

      const textSpan = document.createElement("span");
      textSpan.classList.add("note-item-text");
      textSpan.textContent = note.text;

      const delBtn = document.createElement("button");
      delBtn.classList.add("btn-delete");
      delBtn.textContent = "Delete";
      delBtn.setAttribute("type", "button");
      delBtn.addEventListener("click", () => deleteNote(note.id));

      li.appendChild(textSpan);
      li.appendChild(delBtn);
      notesList.appendChild(li);
    });
  }

  if (savedNotesCount) {
    savedNotesCount.textContent = notes.length === 1 ? "1 note" : `${notes.length} notes`;
  }
}

function addNote() {
  const text = noteText.value.trim();
  if (text === "") return;

  if (noteText.value.length > 200) {
    alert("Cannot add note: note length exceeds the 200 characters limit.");
    return;
  }

  notes.unshift({ id: Date.now(), text: text });
  saveNotes();
  renderNotes();

  // Clear input and draft after successfully adding note
  clearNote();
}

function deleteNote(id) {
  notes = notes.filter((n) => n.id !== id);
  saveNotes();
  renderNotes();
}

// 4. Counter and Character Limit Logic
function updateCounters() {
  const text = noteText.value;
  const numChars = text.length;

  // Calculate word count (0 when empty or only whitespace)
  const trimmed = text.trim();
  const numWords = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

  // Display counters: "N / 200 characters" and "N words"
  charCount.textContent = `${numChars} / 200 characters`;
  wordCount.textContent = `${numWords} words`;

  // Warning class when over 180 chars, Over class when over 200 chars
  if (numChars > 200) {
    charCount.classList.add("over");
    charCount.classList.remove("warning");
  } else if (numChars > 180) {
    charCount.classList.add("warning");
    charCount.classList.remove("over");
  } else {
    charCount.classList.remove("warning");
    charCount.classList.remove("over");
  }
}

// 5. Save Draft on Input
function handleInput() {
  updateCounters();
  localStorage.setItem(DRAFT_KEY, noteText.value);
}

// 6. Clear Button and Reset Logic
function clearNote() {
  noteText.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounters();
  noteText.focus();
}

// 7. Theme Toggle Logic
function setTheme(isDark) {
  if (isDark) {
    document.body.classList.add("dark");
    themeToggle.textContent = "Light mode";
  } else {
    document.body.classList.remove("dark");
    themeToggle.textContent = "Dark mode";
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const isDark = savedTheme === "dark";
  setTheme(isDark);
}

function toggleTheme() {
  const isDarkNow = !document.body.classList.contains("dark");
  setTheme(isDarkNow);
  localStorage.setItem(THEME_KEY, isDarkNow ? "dark" : "light");
}

// 8. Restore Draft on Page Load
function initDraft() {
  const savedDraft = localStorage.getItem(DRAFT_KEY);
  if (savedDraft !== null) {
    noteText.value = savedDraft;
  }
  updateCounters();
}

// 9. Event Listeners
noteText.addEventListener("input", handleInput);

clearBtn.addEventListener("click", clearNote);

if (addBtn) {
  addBtn.addEventListener("click", addNote);
}

noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    clearNote();
  } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    addNote();
  }
});

themeToggle.addEventListener("click", toggleTheme);

// 10. Initial Load Setup
initTheme();
initDraft();
renderNotes();
