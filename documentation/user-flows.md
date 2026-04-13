# User Flow Diagrams

These diagrams trace the key user journeys through the frontend. All flows start from the editor UI unless noted.

---

## 1. Authentication Flow

```mermaid
flowchart TD
    A([App loads]) --> B{VITE_AUTH_ENABLED?}
    B -- true --> C[Lazy-load AppWithAuth]
    B -- false --> D[AppNoAuth renders EditorLayout directly]

    C --> E{Firebase auth state}
    E -- no user --> F[LandingPage\nsign-in form]
    F --> G[User signs in via Firebase]
    G --> H[onAuthStateChanged fires\nsave user profile to Firestore]
    H --> I{listScreens throws\nDeviceNotRegisteredError?}
    I -- yes --> J[No Device Linked screen\nRetry / Sign out]
    I -- no --> K

    D --> K

    K[EditorProvider mounts\nfetch DBC + screens + prefs in parallel] --> L[TelemetryProvider mounts\nopen /ws/client + auth]
    L --> M[EditorLayout renders]

    Note1[During load:\nuseDeferredSkeleton shows\nEditorSkeleton after 150 ms]
    K -.-> Note1
```

---

## 2. Widget Placement Flow

```mermaid
flowchart TD
    A([User drags widget\nfrom palette]) --> B[DragStart fires in EditorLayout\nrecord active type]
    B --> C[DragOverlay ghost follows cursor]
    C --> D[User releases over GridCanvas]
    D --> E[DragEnd fires]
    E --> F[pixelToGrid converts\ndrop coords to col/row]
    F --> G{defaultSize fits\nafter clampToGrid?}
    G -- yes --> I[dispatch ADD_WIDGET\nwith default size]
    G -- no --> H{Any allowed size fits?}
    H -- yes --> I2[dispatch ADD_WIDGET\nwith fallback size]
    H -- no --> X[Drop ignored\nno state change]
    I --> J[editorReducer appends widget\nsets isDirty = true]
    I2 --> J
    J --> K[GridCanvas re-renders\nnew PlacedWidget appears]
    K --> L[Widget auto-selected\nConfigPanel opens]
```

---

## 3. Widget Configuration Flow

```mermaid
flowchart TD
    A([User clicks PlacedWidget\non canvas]) --> B[dispatch SELECT_WIDGET]
    B --> C[ConfigPanel reads\nstate.selectedWidgetId]
    C --> D[ConfigPanel shows\nwidget property fields]

    D --> E{User edits field}
    E --> F[Frame dropdown\nAnimatedSelect over frameParserConfig]
    E --> G[Signal dropdown\nfrom selected frame's signals]
    E --> H[Unit text input]
    E --> I[Min / Max / Caution / Critical]
    E --> J[Alarm toggle switch]
    E --> K[Size dropdown\nallowed sizes filtered by hasCollision]
    E --> L["Graph-only: Mode, Max Points,<br/>Window (time_series) or X-axis (xy)"]

    F --> M[dispatch UPDATE_WIDGET_DATA]
    G --> M
    H --> M
    I --> M
    J --> M
    L --> M
    K --> N[dispatch RESIZE_WIDGET]

    M --> O[editorReducer sets\nscreen.isDirty = true]
    N --> O
    O --> P[Teal dot appears\non tab and Save button]
```

---

## 4. Save Workflow

```mermaid
flowchart TD
    A([User clicks Save\nin Navbar]) --> B[Save modal opens\nlists screens + CAN IDs]
    B --> C{User confirms?}
    C -- no --> D[Modal dismissed\nno change]
    C -- yes --> E[executeSave runs]

    E --> F[targets = every dirty screen\nfallback to activeScreen]

    F --> G[Promise.all target.map\nsaveScreen → POST /api/graphics/screens]
    G --> H[per target:\nUPDATE_ORIGINAL_NAME\n+ MARK_CLEAN]

    E --> I{canIdsDirty?}
    I -- yes --> J[saveDbc → POST /api/dbc]
    J --> K[dispatch MARK_CAN_IDS_CLEAN]

    H --> L[Teal dots clear\nbeforeunload handler detaches]
    K --> L

    L --> M["'Saved!' toast for 2 s<br/>resets to 'Save'"]
```

Screen prefs auto-save on a separate 400 ms debounce — not part of this modal flow.

---

## 5. Screen Management Flow

```mermaid
flowchart LR
    subgraph Create
        A([User clicks + New Screen]) --> B[dispatch ADD_SCREEN\nauto-names Screen N]
        B --> C[New draft screen becomes active]
    end

    subgraph Rename
        D([User double-clicks\nscreen tab]) --> E[Inline input appears]
        E --> F[User types new name\npresses Enter]
        F --> G{Unique?}
        G -- no --> G2[inline error\nname already in use]
        G -- yes --> H[deleteScreen oldName\nthen saveScreen newName]
        H --> I[dispatch SET_SCREEN_NAME\n+ UPDATE_ORIGINAL_NAME\n+ RENAME_SCREEN_IN_PREFS]
    end

    subgraph Pin / Reorder
        J([Hover tab → click pin icon]) --> K[dispatch TOGGLE_PIN_SCREEN\n400 ms debounce auto-saves prefs]
        L([Drag unpinned tab\nby its row]) --> M[arrayMove the order\ndispatch REORDER_SCREENS]
    end

    subgraph Bulk Delete
        N([Select checkboxes on\nunpinned, saved tabs]) --> O[Header shows\nN selected + trash icon]
        O --> P[Click trash → confirm modal]
        P --> Q[Promise.all deleteScreen each\ndispatch REMOVE_SCREENS_BY_IDS]
    end

    subgraph Cross-tab sync
        R([Another tab saves or deletes a screen]) --> S[WSS message arrives]
        S --> T[TelemetryProvider dispatches\nUPSERT_SCREEN or REMOVE_SCREEN_BY_NAME]
    end
```

`UPSERT_SCREEN` is a no-op against locally dirty screens so concurrent edits across tabs don't clobber in-progress work.

---

## 6. DBC Upload Flow

```mermaid
flowchart TD
    A([User clicks Upload\nin Navbar DBC section]) --> B[File picker opens\naccepts .dbc\ncase-insensitive extension check]
    B --> C[User selects file]
    C --> D[file.text reads raw content]
    D --> E[uploadDbc → POST /api/dbc/upload]
    E --> F{Response OK?}
    F -- error --> G[Status shows error\nfile picker reset]
    F -- ok --> H[Response: FrameParserConfig]
    H --> I[dispatch SET_FRAME_PARSER_CONFIG]
    I --> J[dispatch MARK_CAN_IDS_CLEAN\nupload itself is the save]
    J --> K[ConfigPanel Frame dropdowns\nre-populate]

    A2([Or: edit via CanIdConfigurator\nin ConfigPanel]) --> L[Add / edit / remove\nframes and signals]
    L --> M[dispatch ADD_CAN_FRAME\nor UPDATE_CAN_FRAME\nor REMOVE_CAN_FRAME]
    M --> N[canIdsDirty = true\nrequires Save to persist]
```

DBC upload is the fast path — the backend writes `dbc/content` itself and the frontend marks clean immediately. Manual edits via `CanIdConfigurator` require a subsequent Save.

---

## 7. Device Team Management

```mermaid
flowchart TD
    A([User opens Device tab]) --> B[GET /api/device]
    B --> C{Response}
    C -- 403 --> D[No Device Linked view\nwith captive-portal instructions]
    C -- 200 --> E[Render Device ID\n+ online/offline dot\n+ team members list]

    E --> F{User edits members?}
    F -- add email --> G[Append to local list\ndirty = true]
    F -- remove email --> H[Filter from local list\ndirty = true]

    G --> I[Click Save]
    H --> I
    I --> J[POST /api/device/team-members]
    J --> K{OK?}
    K -- yes --> L["Saved" status 2 s\ndirty = false]
    K -- no --> M[Error status]
```

Adding an email that corresponds to an existing Firebase user also updates `users/{uid}.device_id` on the backend, so that user gets immediate access on their next sign-in.
