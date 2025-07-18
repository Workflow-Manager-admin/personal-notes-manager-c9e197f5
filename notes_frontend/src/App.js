import React, { useState, useEffect } from "react";
import "./App.css";

/**
 * Modern, responsive Notes App with authentication (login/signup), CRUD for notes, token handling,
 * backend API integration, and sidebar navigation.
 */

/* ---- API Helper Functions ---- */

const API_BASE =
  process.env.REACT_APP_API_BASE ||
  "http://localhost:8000"; // Update as needed for deployment

// PUBLIC_INTERFACE
async function apiRequest(endpoint, method = "GET", data = null, token = null) {
  /** Helper for calling backend API, handles auth and errors. */
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (data) opts.body = JSON.stringify(data);

  // Try/catch for network/response errors
  try {
    const resp = await fetch(`${API_BASE}${endpoint}`, opts);
    const contentType = resp.headers.get("content-type");
    // Supports error payloads and 204 (No Content)
    let body = null;
    if (resp.status !== 204 && contentType && contentType.includes("application/json")) {
      body = await resp.json();
    }
    if (!resp.ok) {
      throw new Error(body?.detail || resp.statusText || "API error");
    }
    return body;
  } catch (e) {
    throw e;
  }
}

/* ---- Components ---- */

// PUBLIC_INTERFACE
function Sidebar({ user, onLogout, selected, setSelectedView }) {
  /** App sidebar for navigation and user info. */
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo">🗒️ Notes</span>
      </div>
      <nav className="sidebar-nav">
        <button
          className={selected === "notes" ? "active" : ""}
          onClick={() => setSelectedView("notes")}
        >
          📝 Notes
        </button>
        <button
          className={selected === "account" ? "active" : ""}
          onClick={() => setSelectedView("account")}
        >
          👤 Account
        </button>
      </nav>
      {user && (
        <footer className="sidebar-footer">
          <div className="user-info">
            <span>{user.username}</span>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </footer>
      )}
    </aside>
  );
}

// PUBLIC_INTERFACE
function LoginSignup({ onAuth, errorMsg }) {
  /** Combined login/signup form for user authentication. */
  const [isSignup, setIsSignup] = useState(false);
  const [fields, setFields] = useState({
    username: "",
    password: "",
    confirm: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) =>
    setFields({ ...fields, [e.target.name]: e.target.value });

  // PUBLIC_INTERFACE
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!fields.username || !fields.password || (isSignup && !fields.confirm)) {
        throw new Error("Fill all fields.");
      }
      if (isSignup && fields.password !== fields.confirm) {
        throw new Error("Passwords do not match.");
      }
      const endpoint = isSignup ? "/signup" : "/login";
      const result = await apiRequest(
        endpoint,
        "POST",
        { username: fields.username, password: fields.password },
        null
      );
      onAuth(result); // result: { token, user: {username, ...} }
    } catch (err) {
      onAuth(null, err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>{isSignup ? "Sign Up" : "Log In"}</h2>
        {errorMsg && <div className="auth-error">{errorMsg}</div>}
        <input
          type="text"
          name="username"
          placeholder="Username"
          autoComplete="username"
          value={fields.username}
          onChange={handleChange}
          disabled={submitting}
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          value={fields.password}
          onChange={handleChange}
          disabled={submitting}
        />
        {isSignup && (
          <input
            type="password"
            name="confirm"
            placeholder="Confirm Password"
            autoComplete="new-password"
            value={fields.confirm}
            onChange={handleChange}
            disabled={submitting}
          />
        )}
        <button className="btn-primary" disabled={submitting}>
          {submitting
            ? isSignup
              ? "Signing up..."
              : "Logging in..."
            : isSignup
            ? "Sign Up"
            : "Log In"}
        </button>
        <p>
          {isSignup ? "Have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            className="plain-link"
            onClick={() => setIsSignup((s) => !s)}
            disabled={submitting}
          >
            {isSignup ? "Log In" : "Sign Up"}
          </button>
        </p>
      </form>
    </div>
  );
}

// PUBLIC_INTERFACE
function NotesMain({ token }) {
  /** Main notes CRUD UI: list, create, edit, delete notes. */
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState(null);
  const [editing, setEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [pending, setPending] = useState(false);

  // Fetch notes on mount or on CRUD
  useEffect(() => {
    async function fetchNotes() {
      setLoading(true);
      setErrorMsg("");
      try {
        const data = await apiRequest("/notes", "GET", null, token); // Assumed endpoint
        setNotes(data.notes || []);
      } catch (err) {
        setErrorMsg(err.message || "Failed to fetch notes");
      } finally {
        setLoading(false);
      }
    }
    if (token) fetchNotes();
  }, [token]);

  // Filter notes by search term
  const filteredNotes = notes.filter(
    (n) =>
      n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.body?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // PUBLIC_INTERFACE
  const handleNoteSave = async (note) => {
    setPending(true);
    try {
      let result;
      if (note.id) {
        // Edit
        result = await apiRequest(`/notes/${note.id}`, "PUT", note, token);
        setNotes((prev) =>
          prev.map((n) => (n.id === note.id ? result.note : n))
        );
      } else {
        // Create
        result = await apiRequest("/notes", "POST", note, token);
        setNotes((prev) => [result.note, ...prev]);
      }
      setSelectedNote(result.note);
      setEditing(false);
      setErrorMsg("");
    } catch (err) {
      setErrorMsg(err.message || "Save failed");
    }
    setPending(false);
  };

  // PUBLIC_INTERFACE
  const handleNoteDelete = async (id) => {
    if (!window.confirm("Delete this note?")) return;
    setPending(true);
    try {
      await apiRequest(`/notes/${id}`, "DELETE", null, token);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setSelectedNote(null);
      setEditing(false);
      setErrorMsg("");
    } catch (err) {
      setErrorMsg(err.message || "Delete failed");
    }
    setPending(false);
  };

  // Start editing selected note
  const startEdit = () => setEditing(true);

  // Start making new note
  const startCreate = () => {
    setSelectedNote({ title: "", body: "" });
    setEditing(true);
  };

  // Exit edit/create mode
  const cancelEdit = () => setEditing(false);

  /* ---- Render ---- */
  return (
    <div className="notes-main">
      <div className="notes-main-header">
        <h2>Your Notes</h2>
        <button className="btn-primary" onClick={startCreate}>
          + Add Note
        </button>
        <input
          type="search"
          className="search-bar"
          placeholder="Search notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search notes"
        />
      </div>
      {errorMsg && <div className="error-banner">{errorMsg}</div>}
      {loading ? (
        <div className="loader">Loading notes...</div>
      ) : (
        <div className="notes-list-section">
          <NotesList
            notes={filteredNotes}
            onSelect={setSelectedNote}
            selectedId={selectedNote?.id}
          />
        </div>
      )}
      <div className="note-detail-section">
        {editing ? (
          <NoteEditor
            note={selectedNote}
            onSave={handleNoteSave}
            onCancel={cancelEdit}
            saving={pending}
          />
        ) : selectedNote ? (
          <NoteView
            note={selectedNote}
            onEdit={startEdit}
            onDelete={handleNoteDelete}
            deleting={pending}
          />
        ) : (
          <div className="note-empty">Select a note to view.</div>
        )}
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
function NotesList({ notes, onSelect, selectedId }) {
  /** List of all notes, highlighting the selected note. */
  if (!notes.length) return <div className="notes-empty">No notes yet.</div>;
  return (
    <ul className="notes-list">
      {notes.map((note) => (
        <li
          key={note.id}
          className={note.id === selectedId ? "selected" : ""}
          onClick={() => onSelect(note)}
        >
          <div className="note-title">{note.title || <em>No Title</em>}</div>
          <div className="note-body-preview">
            {(note.body || "").slice(0, 60)}
            {note.body && note.body.length > 60 ? "..." : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}

// PUBLIC_INTERFACE
function NoteView({ note, onEdit, onDelete, deleting }) {
  /** Read-only view of a note, with edit/delete actions. */
  if (!note) return null;
  return (
    <div className="note-view">
      <h3>{note.title}</h3>
      <div className="note-view-body">{note.body}</div>
      <div className="note-view-footer">
        <button className="btn-secondary" onClick={onEdit}>
          Edit
        </button>
        <button
          className="btn-danger"
          onClick={() => onDelete(note.id)}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
function NoteEditor({ note, onSave, onCancel, saving }) {
  /** Form for creating or editing a note. */
  const [fields, setFields] = useState({ title: note?.title || "", body: note?.body || "" });
  useEffect(() => {
    setFields({ title: note?.title || "", body: note?.body || "" });
  }, [note]);

  const handleChange = (e) =>
    setFields({ ...fields, [e.target.name]: e.target.value });

  // PUBLIC_INTERFACE
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fields.title && !fields.body) return;
    onSave({ ...note, ...fields });
  };

  return (
    <form className="note-editor" onSubmit={handleSubmit}>
      <input
        type="text"
        name="title"
        placeholder="Title"
        value={fields.title}
        onChange={handleChange}
        disabled={saving}
      />
      <textarea
        name="body"
        placeholder="Note text..."
        rows={8}
        value={fields.body}
        onChange={handleChange}
        disabled={saving}
      />
      <div className="note-editor-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---- Main App ---- */

function App() {
  // Auth state
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedView, setSelectedView] = useState("notes");

  // PUBLIC_INTERFACE
  const handleAuth = (result, errMsg) => {
    if (result && result.token && result.user) {
      setToken(result.token);
      setUser(result.user);
      setErrorMsg("");
      localStorage.setItem("token", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));
    } else {
      setErrorMsg(errMsg || "Invalid credentials.");
    }
  };

  // PUBLIC_INTERFACE
  const handleLogout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  // Expire token on mount if needed, handle refresh token here if present in backend.

  // Responsive layout: toggle sidebar on small screens, can be extended if needed

  return (
    <div className="app-root">
      {user && token ? (
        <>
          <Sidebar
            user={user}
            onLogout={handleLogout}
            selected={selectedView}
            setSelectedView={setSelectedView}
          />
          <main className="main-content">
            {selectedView === "notes" ? (
              <NotesMain token={token} />
            ) : (
              <div className="account-view">
                <h2>Account Info</h2>
                <div>
                  <b>Username:</b> {user.username}
                </div>
                <div>
                  <button className="btn-danger" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </main>
        </>
      ) : (
        <LoginSignup onAuth={handleAuth} errorMsg={errorMsg} />
      )}
    </div>
  );
}

export default App;
