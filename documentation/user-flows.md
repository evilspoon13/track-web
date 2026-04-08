# User Flow Diagrams

These diagrams trace the key user journeys through the frontend. All flows start from the editor UI unless noted.

---

## 1. Authentication Flow

```mermaid
flowchart TD
    A([App loads]) --> B{VITE_AUTH_ENABLED?}
    B -- true --> C[Lazy-load AppWithAuth]
    B -- false --> D[AppNoAuth renders LandingPage]

    C --> E{Firebase auth state}
    E -- no user --> F[Render LandingPage\nsign-in form]
    F --> G[User signs in via Firebase]
    G --> H[onAuthStateChanged fires\nsave user to Firestore]
    H --> I

    D --> J[User clicks Enter / Demo]
    J --> I

    I[EditorProvider mounts\nfetch DBC + driver display] --> K[EditorLayout renders]
```

---

## 2. Widget Placement Flow

```mermaid
flowchart TD
    A([User drags widget\nfrom palette]) --> B[DragStart fires in EditorLayout\nrecord active drag item + type]
    B --> C[Widget ghost follows cursor]
    C --> D[User releases over GridCanvas]
    D --> E[DragEnd fires]
    E --> F[pixelToGrid converts\ndrop coords to col/row]
    F --> G{hasCollision?}
    G -- yes --> H[Drop ignored\nno state change]
    G -- no --> I[dispatch ADD_WIDGET\nwith col/row/cols/rows/type/id]
    I --> J[editorReducer appends widget\nsets isDirty = true]
    J --> K[GridCanvas re-renders\nnew PlacedWidget appears]
    K --> L[Widget auto-selected\nConfigPanel opens]
```

---

## 3. Widget Configuration Flow

```mermaid
flowchart TD
    A([User clicks\nPlacedWidget on canvas]) --> B[dispatch SELECT_WIDGET]
    B --> C[ConfigPanel reads\nstate.selectedWidgetId]
    C --> D[ConfigPanel shows\nwidget property fields]

    D --> E{User edits field}
    E --> F[CAN ID dropdown\nshows all frames in frameParserConfig]
    E --> G[Signal dropdown\nshows signals for selected frame]
    E --> H[Min / Max\nnumber inputs]
    E --> I[Caution / Critical\nthreshold sliders]
    E --> J[Size selector\nshows allowed sizes without collision]

    F --> K[dispatch UPDATE_WIDGET_DATA]
    G --> K
    H --> K
    I --> K
    J --> L[dispatch RESIZE_WIDGET]

    K --> M[editorReducer updates widget\nisDirty = true]
    L --> M
    M --> N[Orange dot appears\non screen tab and Save button]
```

---

## 4. Save Workflow

```mermaid
flowchart TD
    A([User clicks Save button\nin Navbar]) --> B[Save confirmation modal opens\nlists what will be saved]
    B --> C{User confirms?}
    C -- no --> D[Modal dismissed\nno change]
    C -- yes --> E[executeSave runs]

    E --> F{activeScreen isDirty?}
    F -- yes --> G[saveScreen → POST /api/graphics/screens/name\nincludes widgetToBackend conversion]
    G --> H[dispatch MARK_CLEAN\ndispatch UPDATE_ORIGINAL_NAME]

    E --> I{driverDisplayDirty?}
    I -- yes --> J[setDriverDisplay → POST /api/graphics/driver-display]
    J --> K[dispatch MARK_DRIVER_DISPLAY_CLEAN]

    E --> L{canIdsDirty?}
    L -- yes --> M[saveDbc → POST /api/dbc]
    M --> N[dispatch MARK_CAN_IDS_CLEAN]

    H --> O[Orange dots clear\nBeforeunload handler removed]
    K --> O
    N --> O

    O --> P[refreshScreens → GET /api/graphics/screens\nupdates load dropdown]
```

---

## 5. Screen Management Flow

```mermaid
flowchart LR
    subgraph Create
        A([User clicks + in ScreenTabs\nor New Screen in Navbar]) --> B[dispatch ADD_SCREEN\nauto-names Screen N]
        B --> C[New blank screen\nbecomes active]
    end

    subgraph Rename
        D([User double-clicks\nscreen tab]) --> E[Inline input appears]
        E --> F[User types new name\npresses Enter or blurs]
        F --> G[dispatch SET_SCREEN_NAME]
    end

    subgraph Delete
        H([User clicks X on tab\nor Delete in Navbar]) --> I{Only screen?}
        I -- yes --> J[Delete blocked\nminimum 1 screen]
        I -- no --> K[dispatch REMOVE_SCREEN\nnext screen becomes active]
    end

    subgraph Load from backend
        L([User opens Load dropdown\nin Navbar]) --> M[listScreens → GET /api/graphics/screens]
        M --> N[User selects a name]
        N --> O[loadScreen → GET /api/graphics/screens/name]
        O --> P[dispatch LOAD_SCREEN\nnew screen appended and made active]
    end
```

---

## 6. DBC Upload Flow

```mermaid
flowchart TD
    A([User clicks Upload DBC\nin Navbar]) --> B[File picker opens\naccepts .dbc files]
    B --> C[User selects file]
    C --> D[FileReader reads\nraw text content]
    D --> E[uploadDbc → POST /api/dbc/upload\nbody: raw DBC text]
    E --> F{Response OK?}
    F -- error --> G[Error toast shown\nno state change]
    F -- ok --> H[Response: FrameParserConfig]
    H --> I[dispatch SET_FRAME_PARSER_CONFIG\nreplaces all frame definitions]
    I --> J[canIdsDirty = true\norange dot on Save]
    J --> K[ConfigPanel CAN ID dropdowns\nnow populated with uploaded frames]

    A2([User opens CanIdConfigurator\nmanually]) --> L[User adds/edits frame\nor signal manually]
    L --> M[dispatch ADD_CAN_FRAME\nor UPDATE_CAN_FRAME\nor REMOVE_CAN_FRAME]
    M --> J
```
