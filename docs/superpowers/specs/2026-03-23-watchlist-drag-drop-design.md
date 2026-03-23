# Watchlist Drag & Drop Reorder

## Overview

Add drag-and-drop reordering for watchlists on the watchlist page. Users can freely drag watchlist cards between columns and within columns to rearrange their layout. A new bulk reorder backend endpoint ensures atomic coordinate updates.

## Decisions

- **DnD library**: `@dnd-kit` (core + sortable + utilities) — lightweight, hook-based, active maintenance
- **Backend strategy**: New bulk reorder endpoint (`POST /api/v1/watchlists/reorder`) instead of multiple individual PUT calls — atomic, consistent. Uses POST (not PUT) because this is a batch action, and to avoid route collision with `PUT /{watchlist_id}`.
- **Scope**: Full freedom — drag between columns and within columns

## Backend

### New Schema: `WatchlistReorderItem` and `WatchlistReorder`

File: `finext-fastapi/app/schemas/watchlists.py`

```python
class WatchlistReorderItem(BaseModel):
    id: PyObjectId
    coordinate: List[int] = Field(..., min_length=2, max_length=2, description="[col, row], values >= 0")

    @field_validator("coordinate")
    @classmethod
    def validate_coordinate_values(cls, v: List[int]) -> List[int]:
        if any(x < 0 for x in v):
            raise ValueError("Coordinate values must be >= 0")
        return v

class WatchlistReorder(BaseModel):
    items: List[WatchlistReorderItem] = Field(..., min_length=1)

    @model_validator(mode='after')
    def check_no_duplicates(self) -> 'WatchlistReorder':
        ids = [item.id for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate watchlist IDs in reorder request")
        coords = [tuple(item.coordinate) for item in self.items]
        if len(coords) != len(set(coords)):
            raise ValueError("Duplicate coordinates in reorder request")
        return self
```

### New CRUD: `reorder_watchlists()`

File: `finext-fastapi/app/crud/watchlists.py`

- Accept `db`, `user_id`, `reorder_data: WatchlistReorder`
- Validate all watchlist IDs belong to the user (query DB, compare counts)
- Use MongoDB `bulk_write` with `UpdateOne` operations for each item (new pattern — import `from pymongo import UpdateOne`)
- Update `coordinate` and `updated_at` for each
- Return success count (not full watchlist list — frontend already has optimistic state)

### New Route: `POST /api/v1/watchlists/reorder`

File: `finext-fastapi/app/routers/watchlists.py`

- Permission: `require_permission("watchlist", "manage_own")`
- Calls `reorder_watchlists()` CRUD function
- Returns success acknowledgement via `@api_response_wrapper()` (e.g., `{"modified_count": N}`)

## Frontend

### Dependencies

Install: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### New Component: `SortableWatchlistCard.tsx`

File: `finext-nextjs/app/(main)/watchlist/components/SortableWatchlistCard.tsx`

Thin wrapper that:
- Uses `useSortable` hook from `@dnd-kit/sortable`
- Applies `transform` and `transition` CSS from sortable
- Sets reduced opacity when actively dragging
- Passes drag handle `listeners` and `attributes` to child `WatchlistColumn`
- Keeps `WatchlistColumn.tsx` unchanged (already 430 lines, over the 150-line guideline)

### PageContent.tsx Changes

Wrap the columns layout with `DndContext` + `SortableContext` per column:

```
DndContext (sensors, collisionDetection=closestCorners, onDragStart, onDragOver, onDragEnd)
  ├── Column 0: SortableContext (verticalListSortingStrategy)
  │     ├── SortableWatchlistCard → WatchlistColumn
  │     ├── SortableWatchlistCard → WatchlistColumn
  │     └── AddButton (not draggable)
  ├── Column 1: SortableContext
  │     └── ...
  └── DragOverlay (portal to document.body to avoid scroll clipping)
        └── WatchlistColumn (preview)
```

**Sensors:**
- `PointerSensor` with activation constraint `distance: 8` (prevents accidental drag on click)
- `KeyboardSensor` for accessibility
- Auto-scroll enabled for horizontal container scroll during drag

**Collision detection:** `closestCorners` — standard for multi-container Kanban-style layouts in `@dnd-kit`.

**State management during drag:**
- `onDragStart`: Store active watchlist ID, show DragOverlay
- `onDragOver`: Track target container (column) for visual feedback. Move item between columns in local state only when crossing column boundaries (debounced, not on every event).
- `onDragEnd`: Calculate new coordinates for all affected items, call `POST /reorder`, rollback on failure. Disable further drag until API call completes.

**Coordinate recalculation:**
- After drop, iterate affected columns
- Each item gets `coordinate = [columnIndex, rowIndex]` based on its position in the column array
- Only send items whose coordinates actually changed to the reorder endpoint

### WatchlistColumn.tsx Changes

- Add drag handle icon (6-dot grip) in the card header — accepts `dragHandleProps` from parent `SortableWatchlistCard`
- Cursor: `grab` on handle, `grabbing` while dragging
- No other structural changes (component stays as-is)

### Scrolling During Drag

- `@dnd-kit` auto-scroll is enabled on the horizontal scroll container
- Mouse wheel scrolling remains functional during active drag (no drop on scroll)
- Configured via `autoScrollEnabled` on DndContext

### UX Details

- Drag handle: 6-dot grip icon on watchlist card header
- Dragged card: DragOverlay (portaled to body) shows card with slight scale and shadow
- Drop placeholder: visual indicator at target position (reduced opacity slot)
- "+" add buttons: excluded from sortable context, always pinned at column bottom
- Optimistic UI with rollback on API failure
- Drag disabled while reorder API call is in-flight (prevents race conditions)

## Files Modified

### Backend
- `finext-fastapi/app/schemas/watchlists.py` — add `WatchlistReorderItem`, `WatchlistReorder`
- `finext-fastapi/app/crud/watchlists.py` — add `reorder_watchlists()` (introduces `bulk_write` pattern with `from pymongo import UpdateOne`)
- `finext-fastapi/app/routers/watchlists.py` — add reorder route

### Frontend
- `finext-nextjs/package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- `finext-nextjs/app/(main)/watchlist/PageContent.tsx` — DndContext, drag handlers, reorder API call
- `finext-nextjs/app/(main)/watchlist/components/SortableWatchlistCard.tsx` — **new file**, useSortable wrapper
- `finext-nextjs/app/(main)/watchlist/components/WatchlistColumn.tsx` — add drag handle props to header

## Error Handling

- API failure on reorder: rollback local state to pre-drag positions
- Invalid watchlist ID in reorder: backend returns 400/404, frontend rollbacks
- Duplicate coordinates/IDs in request: backend validates and rejects with 422
- Concurrent rapid drags: drag disabled while API in-flight
- Concurrent edits: last-write-wins (acceptable for single-user watchlist)
