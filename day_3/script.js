let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

const clean = (t) => String(t).trim().replace(/\s+/g, " ");
const searchNotes = (word) => notes.filter((n) => n.text.toLowerCase().includes(String(word).toLowerCase()));
const longestNote = () => (notes.length ? notes.reduce((a, n) => (n.text.length > a.text.length ? n : a)) : null);
const isDuplicate = (text) => notes.some((n) => clean(n.text).toLowerCase() === clean(text).toLowerCase());

function countByCategory() {
  const counts = { personal: 0, work: 0, study: 0 };
  for (const n of notes) counts[n.category] = (counts[n.category] || 0) + 1;
  return counts;
}

const getSummary = () =>
  `${notes.length} ${notes.length === 1 ? "note" : "notes"}: ` +
  Object.entries(countByCategory()).map(([cat, num]) => `${num} ${cat}`).join(", ") + ".";

function addNote(text, category) {
  const t = clean(text);
  const reason = t.length < 1 || t.length > 200 ? "text must be 1-200 characters"
    : !["personal", "work", "study"].includes(category) ? "category must be personal, work or study"
    : isDuplicate(t) ? "duplicate note" : "";
  if (reason) { console.log(`Not added: ${reason}.`); return false; }
  notes.push({ id: Math.max(0, ...notes.map((n) => n.id)) + 1, text: t, category });
  return true;
}

// Tests
console.log(searchNotes("MILK")); 
console.log(searchNotes("zebra")); 
console.log(longestNote()); 
console.log(countByCategory()); 
console.log(getSummary()); 
console.log(isDuplicate("  CALL   mum "));
console.log(isDuplicate("Walk the dog")); 

const saved = notes; notes = []; 
console.log(longestNote()); 
console.log(getSummary()); 
notes = saved;

console.log(addNote("Walk the dog", "personal")); 
console.log(addNote("call MUM", "personal")); 
console.log(addNote("", "work")); 
console.log(addNote("Learn CSS", "hobby")); 
console.log(getSummary());