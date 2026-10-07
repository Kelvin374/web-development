# Library API - Books Resource

A REST API design for managing the books in a library catalogue.

## Base URL

- `https://api.library.example.com/v1`

## Resource: Books

- Path: `/books`
- Fields: `id`, `title`, `author`, `isbn`, `published_year`, `available_copies`

## Endpoints

### 1. List all books

- **Method:** `GET`
- **Path:** `/books`
- **Description:** Returns every book in the catalogue, with optional pagination.
- **Example request body:** none
- **Success status code:** `200 OK`

### 2. Get a single book

- **Method:** `GET`
- **Path:** `/books/{id}`
- **Description:** Returns one book matched by its unique identifier.
- **Example request body:** none
- **Success status code:** `200 OK`

### 3. Create a book

- **Method:** `POST`
- **Path:** `/books`
- **Description:** Adds a new book to the catalogue.
- **Example request body:**

  ```json
  {
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "isbn": "978-0-385-47454-2",
    "published_year": 1958,
    "available_copies": 3
  }
  ```

- **Success status code:** `201 Created`

### 4. Update a book

- **Method:** `PUT`
- **Path:** `/books/{id}`
- **Description:** Replaces the full record of an existing book.
- **Example request body:**

  ```json
  {
    "title": "Things Fall Apart",
    "author": "Chinua Achebe",
    "isbn": "978-0-385-47454-2",
    "published_year": 1958,
    "available_copies": 5
  }
  ```

- **Success status code:** `200 OK`

  - An alternative partial update can use `PATCH /books/{id}` with only the changed fields, also returning `200 OK`.

### 5. Delete a book

- **Method:** `DELETE`
- **Path:** `/books/{id}`
- **Description:** Removes a book from the catalogue permanently.
- **Example request body:** none
- **Success status code:** `204 No Content`

### 6. List books by author (query parameter)

- **Method:** `GET`
- **Path:** `/books?author={author}`
- **Description:** Returns only the books whose author matches the supplied query parameter.
- **Example request:** `GET /books?author=Chinua%20Achebe`
- **Example request body:** none
- **Success status code:** `200 OK`

## Error Codes

### 400 Bad Request

- The request is malformed or fails validation.
- **Example:** `POST /books` with a body that leaves `title` empty or sets `published_year` to a string such as `"nineteen fifty-eight"`.

### 404 Not Found

- The requested resource does not exist.
- **Example:** `GET /books/9999` when no book with `id` `9999` exists in the catalogue.
