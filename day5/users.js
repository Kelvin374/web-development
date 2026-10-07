// --- 1. Select DOM elements ---
const loadBtn = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusMessage = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

// --- 2. API endpoint (break this URL to test the error path) ---
const USERS_URL = "https://jsonplaceholder.typicode.com/users";

// --- 3. State ---
let users = [];

// --- 4. Status helper ---
function setStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = type ? `status-${type}` : "";
}

// --- 5. Render any array of users ---
function renderUsers(list) {
  usersList.innerHTML = "";

  if (list.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "empty-state";
    emptyLi.textContent = "No users match your filter.";
    usersList.appendChild(emptyLi);
    return;
  }

  list.forEach((user) => {
    const li = document.createElement("li");
    li.className = "user-card";

    const name = document.createElement("h2");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.className = "user-email";
    email.textContent = user.email;

    const location = document.createElement("p");
    location.textContent = `City: ${user.address.city}`;

    const company = document.createElement("p");
    company.textContent = `Company: ${user.company.name}`;

    li.appendChild(name);
    li.appendChild(email);
    li.appendChild(location);
    li.appendChild(company);
    usersList.appendChild(li);
  });
}

// --- 6. Load users from the API ---
async function loadUsers() {
  loadBtn.disabled = true;
  setStatus("Loading users...", "loading");

  try {
    const response = await fetch(USERS_URL);

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    users = data;
    renderUsers(users);
    setStatus(`Success: ${users.length} users loaded.`, "success");
  } catch (error) {
    users = [];
    renderUsers(users);
    setStatus(`Error: ${error.message}`, "error");
  } finally {
    loadBtn.disabled = false;
  }
}

// --- 7. Filter the stored array without a new request ---
function handleFilter() {
  const query = filterInput.value.trim().toLowerCase();

  if (users.length === 0) {
    return;
  }

  if (query === "") {
    renderUsers(users);
    setStatus(`Success: ${users.length} users loaded.`, "success");
    return;
  }

  const filtered = users.filter((user) =>
    user.name.toLowerCase().includes(query)
  );

  renderUsers(filtered);
  setStatus(`${filtered.length} of ${users.length} users match.`, "success");
}

// --- 8. Event listeners ---
loadBtn.addEventListener("click", loadUsers);
filterInput.addEventListener("input", handleFilter);
