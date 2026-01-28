/**
 * Notepad Module
 * A markdown-capable note-taking application with edit/preview toggle
 * Self-contained module with dynamic UI creation and inline styles
 */

(function () {
  "use strict";

  function createNotepad(options) {
    const root = options.root;
    const themeController = options.themeController;

    // ==================== MARKDOWN PARSER LOADING ====================
    let markedLoaded = false;
    let markedLoadPromise = null;

    function loadMarked() {
      if (markedLoaded && window.marked) {
        return Promise.resolve();
      }
      if (markedLoadPromise) {
        return markedLoadPromise;
      }

      markedLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js";
        script.onload = () => {
          markedLoaded = true;
          // Configure marked for security and features
          if (window.marked) {
            window.marked.setOptions({
              breaks: true,
              gfm: true,
              headerIds: true,
            });
          }
          resolve();
        };
        script.onerror = () => reject(new Error("Failed to load marked.js"));
        document.head.appendChild(script);
      });

      return markedLoadPromise;
    }

    // ==================== CSS STYLES ====================
    const styles = `
      .notepad-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        gap: 1rem;
      }

      .notepad-header {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: center;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--color-border);
      }

      .notepad-controls {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .notepad-btn {
        padding: 0.5rem 1rem;
        border: 1px solid var(--color-border);
        background: var(--color-bg-secondary);
        color: var(--color-text);
        border-radius: 0.375rem;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        transition: all 0.2s;
      }

      .notepad-btn:hover {
        background: var(--color-bg-hover);
        border-color: var(--color-primary);
      }

      .notepad-btn.active {
        background: var(--accent);
        color: var(--bg-card);
        border-color: var(--accent);
      }

      .notepad-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .notepad-editor-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        position: relative;
      }

      .notepad-textarea {
        width: 100%;
        height: 100%;
        padding: 1rem;
        border: 1px solid var(--color-border);
        border-radius: 0.5rem;
        background: var(--color-bg-secondary);
        color: var(--color-text);
        font-family: 'Courier New', monospace;
        font-size: 0.9rem;
        line-height: 1.6;
        resize: none;
        transition: border-color 0.2s;
      }

      .notepad-textarea:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      .notepad-preview {
        width: 100%;
        height: 100%;
        padding: 1rem;
        border: 1px solid var(--color-border);
        border-radius: 0.5rem;
        background: var(--color-bg-secondary);
        color: var(--color-text);
        overflow-y: auto;
        line-height: 1.6;
      }

      .notepad-preview h1 { font-size: 2rem; margin-top: 1.5rem; margin-bottom: 1rem; }
      .notepad-preview h2 { font-size: 1.5rem; margin-top: 1.25rem; margin-bottom: 0.75rem; }
      .notepad-preview h3 { font-size: 1.25rem; margin-top: 1rem; margin-bottom: 0.5rem; }
      .notepad-preview h4 { font-size: 1.1rem; margin-top: 0.75rem; margin-bottom: 0.5rem; }
      .notepad-preview h1:first-child,
      .notepad-preview h2:first-child,
      .notepad-preview h3:first-child { margin-top: 0; }
      
      .notepad-preview p { margin-bottom: 1rem; }
      .notepad-preview ul, .notepad-preview ol { margin-bottom: 1rem; padding-left: 2rem; }
      .notepad-preview li { margin-bottom: 0.25rem; }
      .notepad-preview code { 
        background: var(--color-bg-tertiary, rgba(0,0,0,0.2));
        padding: 0.2rem 0.4rem;
        border-radius: 0.25rem;
        font-family: 'Courier New', monospace;
        font-size: 0.85em;
      }
      .notepad-preview pre {
        background: var(--color-bg-tertiary, rgba(0,0,0,0.2));
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        margin-bottom: 1rem;
      }
      .notepad-preview pre code {
        background: none;
        padding: 0;
      }
      .notepad-preview blockquote {
        border-left: 4px solid var(--color-border);
        padding-left: 1rem;
        margin-left: 0;
        margin-bottom: 1rem;
        color: var(--color-text-secondary, inherit);
      }
      .notepad-preview a {
        color: var(--color-primary);
        text-decoration: none;
      }
      .notepad-preview a:hover {
        text-decoration: underline;
      }
      .notepad-preview table {
        border-collapse: collapse;
        width: 100%;
        margin-bottom: 1rem;
      }
      .notepad-preview th, .notepad-preview td {
        border: 1px solid var(--color-border);
        padding: 0.5rem;
        text-align: left;
      }
      .notepad-preview th {
        background: var(--color-bg-tertiary, rgba(0,0,0,0.1));
        font-weight: 600;
      }

      .notepad-hidden {
        display: none;
      }

      .notepad-note-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-height: 300px;
        overflow-y: auto;
        margin-top: 0.5rem;
      }

      .notepad-note-item {
        padding: 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 0.375rem;
        background: var(--color-bg-secondary);
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .notepad-note-item:hover {
        background: var(--color-bg-hover);
        border-color: var(--color-primary);
      }

      .notepad-note-item.active {
        border-color: var(--color-primary);
        background: var(--color-bg-hover);
      }

      .notepad-note-title {
        font-weight: 500;
        flex: 1;
      }

      .notepad-note-delete {
        padding: 0.25rem 0.5rem;
        background: transparent;
        border: 1px solid var(--color-border);
        border-radius: 0.25rem;
        color: var(--color-text);
        cursor: pointer;
        font-size: 0.75rem;
        transition: all 0.2s;
      }

      .notepad-note-delete:hover {
        background: #ef4444;
        border-color: #ef4444;
        color: white;
      }

      @media (max-width: 768px) {
        .notepad-header {
          flex-direction: column;
          align-items: stretch;
        }
        .notepad-controls {
          width: 100%;
        }
        .notepad-btn {
          flex: 1;
        }
      }
    `;

    // ==================== STATE ====================
    let currentMode = "edit"; // 'edit' or 'preview'
    let currentNoteId = null;
    let notes = loadNotesFromStorage();
    let autoSaveTimeout = null;

    // ==================== STORAGE FUNCTIONS ====================
    function loadNotesFromStorage() {
      try {
        const stored = localStorage.getItem("notepad-notes");
        return stored ? JSON.parse(stored) : {};
      } catch (e) {
        console.error("Failed to load notes:", e);
        return {};
      }
    }

    function saveNotesToStorage() {
      try {
        localStorage.setItem("notepad-notes", JSON.stringify(notes));
      } catch (e) {
        console.error("Failed to save notes:", e);
      }
    }

    function generateNoteId() {
      return "note_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    }

    // ==================== UI CREATION ====================
    function createUI() {
      const container = document.createElement("div");
      container.className = "notepad-container";

      // Inject styles
      const styleEl = document.createElement("style");
      styleEl.textContent = styles;
      container.appendChild(styleEl);

      // Header
      const header = document.createElement("div");
      header.className = "notepad-header";

      const title = document.createElement("h1");
      title.textContent = "Notepad";
      title.style.margin = "0";
      title.style.flex = "1";
      header.appendChild(title);

      // Controls
      const controls = document.createElement("div");
      controls.className = "notepad-controls";

      const editBtn = document.createElement("button");
      editBtn.className = "notepad-btn active";
      editBtn.textContent = "Edit";
      editBtn.id = "notepad-edit-btn";

      const previewBtn = document.createElement("button");
      previewBtn.className = "notepad-btn";
      previewBtn.textContent = "Preview";
      previewBtn.id = "notepad-preview-btn";

      const newNoteBtn = document.createElement("button");
      newNoteBtn.className = "notepad-btn";
      newNoteBtn.textContent = "+ New Note";
      newNoteBtn.id = "notepad-new-btn";

      const exportBtn = document.createElement("button");
      exportBtn.className = "notepad-btn";
      exportBtn.textContent = "Export";
      exportBtn.id = "notepad-export-btn";

      controls.appendChild(editBtn);
      controls.appendChild(previewBtn);
      controls.appendChild(newNoteBtn);
      controls.appendChild(exportBtn);
      header.appendChild(controls);
      container.appendChild(header);

      // Note list
      const noteListContainer = document.createElement("div");
      noteListContainer.id = "notepad-note-list-container";
      noteListContainer.className = "notepad-note-list";
      container.appendChild(noteListContainer);

      // Editor wrapper
      const editorWrapper = document.createElement("div");
      editorWrapper.className = "notepad-editor-wrapper";

      // Textarea
      const textarea = document.createElement("textarea");
      textarea.className = "notepad-textarea";
      textarea.placeholder = "Start typing your note here... Supports Markdown!";
      textarea.id = "notepad-textarea";

      // Preview
      const preview = document.createElement("div");
      preview.className = "notepad-preview notepad-hidden";
      preview.id = "notepad-preview";

      editorWrapper.appendChild(textarea);
      editorWrapper.appendChild(preview);
      container.appendChild(editorWrapper);

      return {
        container,
        editBtn,
        previewBtn,
        newNoteBtn,
        exportBtn,
        textarea,
        preview,
        noteListContainer,
      };
    }

    // ==================== UI LOGIC ====================
    const ui = createUI();
    root.appendChild(ui.container);

    function switchMode(mode) {
      currentMode = mode;

      if (mode === "edit") {
        ui.editBtn.classList.add("active");
        ui.previewBtn.classList.remove("active");
        ui.textarea.classList.remove("notepad-hidden");
        ui.preview.classList.add("notepad-hidden");
      } else {
        ui.editBtn.classList.remove("active");
        ui.previewBtn.classList.add("active");
        ui.textarea.classList.add("notepad-hidden");
        ui.preview.classList.remove("notepad-hidden");
        renderPreview();
      }
    }

    async function renderPreview() {
      const text = ui.textarea.value;

      if (!text.trim()) {
        ui.preview.innerHTML = '<p style="color: var(--color-text-secondary);">No content to preview.</p>';
        return;
      }

      try {
        await loadMarked();
        const html = window.marked.parse(text);
        ui.preview.innerHTML = html;
      } catch (e) {
        ui.preview.innerHTML = '<p style="color: #ef4444;">Failed to render markdown: ' + e.message + '</p>';
      }
    }

    function autoSave() {
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        if (currentNoteId && notes[currentNoteId]) {
          notes[currentNoteId].content = ui.textarea.value;
          notes[currentNoteId].updated = Date.now();
          saveNotesToStorage();
        }
      }, 500);
    }

    function renderNoteList() {
      ui.noteListContainer.innerHTML = "";

      const noteIds = Object.keys(notes).sort((a, b) => notes[b].updated - notes[a].updated);

      if (noteIds.length === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.style.padding = "1rem";
        emptyMsg.style.textAlign = "center";
        emptyMsg.style.color = "var(--color-text-secondary)";
        emptyMsg.textContent = "No notes yet. Click '+ New Note' to create one.";
        ui.noteListContainer.appendChild(emptyMsg);
        return;
      }

      noteIds.forEach((id) => {
        const note = notes[id];
        const item = document.createElement("div");
        item.className = "notepad-note-item";
        if (id === currentNoteId) item.classList.add("active");

        const titleSpan = document.createElement("span");
        titleSpan.className = "notepad-note-title";
        titleSpan.textContent = note.title || "Untitled Note";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "notepad-note-delete";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteNote(id);
        });

        item.appendChild(titleSpan);
        item.appendChild(deleteBtn);

        item.addEventListener("click", () => loadNote(id));

        ui.noteListContainer.appendChild(item);
      });
    }

    function createNewNote() {
      const id = generateNoteId();
      const title = "Untitled Note";
      notes[id] = {
        title: title,
        content: "",
        created: Date.now(),
        updated: Date.now(),
      };
      saveNotesToStorage();
      loadNote(id);
      renderNoteList();
    }

    function loadNote(id) {
      if (!notes[id]) return;

      currentNoteId = id;
      ui.textarea.value = notes[id].content || "";
      renderNoteList();

      if (currentMode === "preview") {
        renderPreview();
      }
    }

    function deleteNote(id) {
      if (!confirm("Delete this note?")) return;

      delete notes[id];
      saveNotesToStorage();

      if (currentNoteId === id) {
        currentNoteId = null;
        ui.textarea.value = "";
      }

      renderNoteList();
    }

    function exportNote() {
      const content = ui.textarea.value;
      if (!content.trim()) {
        alert("Nothing to export!");
        return;
      }

      const note = notes[currentNoteId];
      const filename = (note ? note.title : "note") + ".md";

      const blob = new Blob([content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    // ==================== EVENT LISTENERS ====================
    ui.editBtn.addEventListener("click", () => switchMode("edit"));
    ui.previewBtn.addEventListener("click", () => switchMode("preview"));
    ui.newNoteBtn.addEventListener("click", createNewNote);
    ui.exportBtn.addEventListener("click", exportNote);
    ui.textarea.addEventListener("input", autoSave);

    // ==================== INITIALIZATION ====================
    renderNoteList();

    // Load first note or create a default one
    const noteIds = Object.keys(notes);
    if (noteIds.length > 0) {
      loadNote(noteIds[0]);
    } else {
      createNewNote();
    }

    // ==================== PUBLIC API ====================
    return {
      destroy() {
        clearTimeout(autoSaveTimeout);
        root.innerHTML = "";
      },
      onThemeChange(theme) {
        // Theme changes are handled by CSS variables
      },
    };
  }

  // Assign to window at the end
  window.createNotepad = createNotepad;
  
  // Signal that module is ready
  if (window.__moduleReady) {
    window.__moduleReady('createNotepad');
  }
})();