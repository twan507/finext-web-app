# Watchlist Drag & Drop Reorder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-and-drop reordering of watchlist cards across a multi-column grid layout, backed by a bulk reorder API endpoint.

**Architecture:** Backend adds a `POST /reorder` endpoint that accepts an array of `{id, coordinate}` pairs and atomically updates all coordinates via MongoDB `bulk_write`. Frontend wraps the existing column layout with `@dnd-kit` contexts, adding a thin `SortableWatchlistCard` wrapper and a drag handle to `WatchlistColumn`.

**Tech Stack:** FastAPI, MongoDB (Motor), Pydantic v2, Next.js, React, MUI, `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`

**Spec:** `docs/superpowers/specs/2026-03-23-watchlist-drag-drop-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `finext-fastapi/app/schemas/watchlists.py` | Add `WatchlistReorderItem` and `WatchlistReorder` schemas |
| Modify | `finext-fastapi/app/crud/watchlists.py` | Add `reorder_watchlists()` function |
| Modify | `finext-fastapi/app/routers/watchlists.py` | Add `POST /reorder` route |
| Create | `finext-nextjs/app/(main)/watchlist/components/SortableWatchlistCard.tsx` | `useSortable` wrapper around `WatchlistColumn` |
| Modify | `finext-nextjs/app/(main)/watchlist/components/WatchlistColumn.tsx` | Accept `dragHandleProps`, render grip icon |
| Modify | `finext-nextjs/app/(main)/watchlist/PageContent.tsx` | `DndContext`, drag handlers, reorder API call |

---

## Task 1: Backend — Reorder Schemas

**Files:**
- Modify: `finext-fastapi/app/schemas/watchlists.py:1-73`

- [ ] **Step 1: Add reorder schemas at the end of the file**

Add after line 72 (after `WatchlistPublicAdmin` class):

```python
from pydantic import field_validator, model_validator

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

Note: `field_validator` and `model_validator` must be added to the existing import from `pydantic` on line 2. The existing import is:
```python
from pydantic import BaseModel, Field, ConfigDict
```
Change to:
```python
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator
```

- [ ] **Step 2: Verify the schema file has no syntax errors**

Run: `cd d:/twan_projects/finext-web-app/finext-fastapi && python -c "from app.schemas.watchlists import WatchlistReorder, WatchlistReorderItem; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add finext-fastapi/app/schemas/watchlists.py
git commit -m "feat(watchlist): add WatchlistReorder and WatchlistReorderItem schemas"
```

---

## Task 2: Backend — Reorder CRUD Function

**Files:**
- Modify: `finext-fastapi/app/crud/watchlists.py:1-172`

- [ ] **Step 1: Add the `reorder_watchlists` function**

Add the import at the top (after line 6 `from bson import ObjectId`):
```python
from pymongo import UpdateOne
```

Update the import on line 9 to include the new schema:
```python
from app.schemas.watchlists import WatchlistCreate, WatchlistUpdate, WatchlistInDB, WatchlistReorder
```

Add the function before the admin section (before line 117 `# <<<< PHẦN BỔ SUNG MỚI >>>>`):

```python
async def reorder_watchlists(db: AsyncIOMotorDatabase, user_id: PyObjectId, reorder_data: WatchlistReorder) -> int:
    """Bulk-update coordinates for multiple watchlists owned by user_id. Returns modified count."""
    if not ObjectId.is_valid(user_id):
        raise ValueError(f"Định dạng User ID không hợp lệ: {user_id}")

    item_ids = [ObjectId(item.id) for item in reorder_data.items]

    # Validate all watchlist IDs belong to this user
    count = await db[WATCHLIST_COLLECTION].count_documents({
        "_id": {"$in": item_ids},
        "user_id": ObjectId(user_id),
    })
    if count != len(item_ids):
        raise ValueError("Một hoặc nhiều watchlist không tồn tại hoặc không thuộc về bạn.")

    now = datetime.now(timezone.utc)
    operations = [
        UpdateOne(
            {"_id": ObjectId(item.id), "user_id": ObjectId(user_id)},
            {"$set": {"coordinate": item.coordinate, "updated_at": now}},
        )
        for item in reorder_data.items
    ]

    result = await db[WATCHLIST_COLLECTION].bulk_write(operations, ordered=False)
    logger.info(f"Reorder watchlists for user {user_id}: modified {result.modified_count}/{len(operations)}")
    return result.modified_count
```

- [ ] **Step 2: Verify the CRUD file has no syntax errors**

Run: `cd d:/twan_projects/finext-web-app/finext-fastapi && python -c "from app.crud.watchlists import reorder_watchlists; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add finext-fastapi/app/crud/watchlists.py
git commit -m "feat(watchlist): add reorder_watchlists CRUD with bulk_write"
```

---

## Task 3: Backend — Reorder Route

**Files:**
- Modify: `finext-fastapi/app/routers/watchlists.py:1-212`

- [ ] **Step 1: Add the reorder route**

Update imports on line 9 to include the new schema:
```python
from app.schemas.watchlists import WatchlistCreate, WatchlistPublic, WatchlistUpdate, WatchlistReorder
```

Add the route **before** the `PUT /{watchlist_id}` route (before line 95). This placement matters because FastAPI matches routes in declaration order, and `POST` on `/reorder` has no conflict with `PUT /{watchlist_id}`, but placing it early makes the intent clear:

```python
@router.post(
    "/reorder",
    response_model=StandardApiResponse[dict],
    summary="[User] Sắp xếp lại vị trí các watchlist",
    dependencies=[Depends(require_permission("watchlist", "manage_own"))],
    tags=["watchlists"],
)
@api_response_wrapper(default_success_message="Sắp xếp lại watchlist thành công.")
async def reorder_my_watchlists(
    reorder_data: WatchlistReorder,
    current_user: UserInDB = Depends(get_current_active_user),
    db: AsyncIOMotorDatabase = Depends(lambda: get_database("user_db")),
):
    try:
        modified_count = await crud_watchlists.reorder_watchlists(
            db, user_id=current_user.id, reorder_data=reorder_data
        )
        return {"modified_count": modified_count}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
```

- [ ] **Step 2: Verify the router file has no syntax errors**

Run: `cd d:/twan_projects/finext-web-app/finext-fastapi && python -c "from app.routers.watchlists import router; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add finext-fastapi/app/routers/watchlists.py
git commit -m "feat(watchlist): add POST /reorder endpoint for bulk coordinate update"
```

---

## Task 4: Frontend — Install `@dnd-kit` Packages

**Files:**
- Modify: `finext-nextjs/package.json`

- [ ] **Step 1: Install packages**

Run: `cd d:/twan_projects/finext-web-app/finext-nextjs && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 2: Verify installation**

Run: `cd d:/twan_projects/finext-web-app/finext-nextjs && node -e "require('@dnd-kit/core'); require('@dnd-kit/sortable'); require('@dnd-kit/utilities'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add finext-nextjs/package.json finext-nextjs/package-lock.json
git commit -m "chore: install @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities"
```

---

## Task 5: Frontend — Add Drag Handle to `WatchlistColumn`

**Files:**
- Modify: `finext-nextjs/app/(main)/watchlist/components/WatchlistColumn.tsx:42-51,130-179`

- [ ] **Step 1: Add `dragHandleProps` to the component interface**

On line 43 (`WatchlistColumnProps` interface), add the new optional prop. Change the interface to:

```typescript
interface WatchlistColumnProps {
    watchlist: Watchlist;
    stockDataMap: Map<string, StockData>;
    allTickers: TickerOption[];
    onDelete: () => void;
    onRename: () => void;
    onAddStock: (ticker: string) => void;
    onRemoveStock: (ticker: string) => void;
    dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}
```

- [ ] **Step 2: Accept the prop in the function signature**

On line 53, update the destructured props. Change:
```typescript
export default function WatchlistColumn({
    watchlist,
    stockDataMap,
    allTickers,
    onDelete,
    onRename,
    onAddStock,
    onRemoveStock,
}: WatchlistColumnProps) {
```
To:
```typescript
export default function WatchlistColumn({
    watchlist,
    stockDataMap,
    allTickers,
    onDelete,
    onRename,
    onAddStock,
    onRemoveStock,
    dragHandleProps,
}: WatchlistColumnProps) {
```

- [ ] **Step 3: Add the drag handle icon import**

Add to the MUI icons imports (after line 17 `import TrendingUpIcon...`):
```typescript
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
```

- [ ] **Step 4: Add drag handle in the header**

In the header section (line 131-179), add a drag handle before the watchlist name. Replace the header `<Box>` that starts at line 131 with:

Find the header Box that contains the name and buttons (lines 131-179). Inside it, before the `<Box onClick={() => setCollapsed(...)}>` block at line 142, add the drag handle:

```typescript
{/* Drag handle */}
{dragHandleProps && (
    <Box
        {...dragHandleProps}
        sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'grab',
            color: 'text.disabled',
            mr: 0.5,
            '&:hover': { color: 'text.secondary' },
            '&:active': { cursor: 'grabbing' },
        }}
    >
        <DragIndicatorIcon sx={{ fontSize: 16 }} />
    </Box>
)}
```

This should be inserted right after the opening `<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ... }}>` tag at line 131, before the `<Box onClick={() => setCollapsed(c => !c)} ...>` element at line 142.

- [ ] **Step 5: Verify the file builds correctly**

Run: `cd d:/twan_projects/finext-web-app/finext-nextjs && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to `WatchlistColumn.tsx`

- [ ] **Step 6: Commit**

```bash
git add finext-nextjs/app/(main)/watchlist/components/WatchlistColumn.tsx
git commit -m "feat(watchlist): add drag handle props to WatchlistColumn header"
```

---

## Task 6: Frontend — Create `SortableWatchlistCard` Component

**Files:**
- Create: `finext-nextjs/app/(main)/watchlist/components/SortableWatchlistCard.tsx`

- [ ] **Step 1: Create the sortable wrapper component**

Create file `finext-nextjs/app/(main)/watchlist/components/SortableWatchlistCard.tsx`:

```typescript
'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box } from '@mui/material';

interface SortableWatchlistCardProps {
    id: string;
    children: (dragHandleProps: React.HTMLAttributes<HTMLDivElement>) => React.ReactNode;
}

export default function SortableWatchlistCard({ id, children }: SortableWatchlistCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        position: 'relative' as const,
    };

    const dragHandleProps: React.HTMLAttributes<HTMLDivElement> = {
        ...(listeners ?? {}),
    };

    return (
        <Box ref={setNodeRef} style={style} {...attributes}>
            {children(dragHandleProps)}
        </Box>
    );
}
```

- [ ] **Step 2: Verify the file builds correctly**

Run: `cd d:/twan_projects/finext-web-app/finext-nextjs && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to `SortableWatchlistCard.tsx`

- [ ] **Step 3: Commit**

```bash
git add finext-nextjs/app/(main)/watchlist/components/SortableWatchlistCard.tsx
git commit -m "feat(watchlist): create SortableWatchlistCard wrapper component"
```

---

## Task 7: Frontend — Integrate DnD into `PageContent.tsx`

**Files:**
- Modify: `finext-nextjs/app/(main)/watchlist/PageContent.tsx:1-325`

This is the largest task. We modify `PageContent.tsx` to:
1. Import dnd-kit and the new `SortableWatchlistCard`
2. Set up sensors, state, and handlers
3. Wrap the column layout with `DndContext` and `SortableContext`
4. Add `DragOverlay` for the preview
5. Call the reorder API on `onDragEnd`

- [ ] **Step 1: Add imports**

Replace the imports section (lines 1-11) with:

```typescript
'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Box, Typography, Button, CircularProgress, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    closestCorners,
    type DragStartEvent,
    type DragOverEvent,
    type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';
import { fontWeight, getResponsiveFontSize, borderRadius } from 'theme/tokens';
import { useSseCache } from 'hooks/useSseCache';
import { apiClient } from 'services/apiClient';
import WatchlistColumn from './components/WatchlistColumn';
import SortableWatchlistCard from './components/SortableWatchlistCard';
import AddWatchlistDialog from './components/AddWatchlistDialog';
import ConfirmDialog from './components/ConfirmDialog';
```

- [ ] **Step 2: Add DnD state and sensors after existing state declarations**

After the existing state declarations (after line 47 `const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);`), add:

```typescript
// ── DnD state ──
const [activeId, setActiveId] = useState<string | null>(null);
const [isReordering, setIsReordering] = useState(false);
const watchlistsBeforeDrag = useRef<Watchlist[]>([]);
const watchlistsRef = useRef<Watchlist[]>([]);

// Keep ref in sync with state so handlers can read latest without stale closures
useEffect(() => { watchlistsRef.current = watchlists; }, [watchlists]);

const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
);
```

- [ ] **Step 3: Add helper to find which column a watchlist belongs to**

After the sensors declaration, add:

```typescript
// Helper: find column index for a given sortable ID
const findColumnIndex = useCallback((id: string): number => {
    const wl = watchlists.find(w => (w.id || w._id) === id);
    if (wl) return wl.coordinate[0];
    return -1;
}, [watchlists]);
```

- [ ] **Step 4: Add DnD handlers**

After the `findColumnIndex` helper, add:

```typescript
// ── DnD handlers ──
const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    watchlistsBeforeDrag.current = [...watchlists];
}, [watchlists]);

const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeWlId = active.id as string;
    const overWlId = over.id as string;
    if (activeWlId === overWlId) return;

    const activeCol = findColumnIndex(activeWlId);
    const overCol = findColumnIndex(overWlId);
    if (activeCol === -1 || overCol === -1 || activeCol === overCol) return;

    // Move item to the other column
    setWatchlists(prev => {
        const activeWl = prev.find(w => (w.id || w._id) === activeWlId);
        if (!activeWl) return prev;

        // Get items in the target column sorted by row
        const overColItems = prev
            .filter(w => w.coordinate[0] === overCol && (w.id || w._id) !== activeWlId)
            .sort((a, b) => a.coordinate[1] - b.coordinate[1]);

        // Find insertion index
        const overIndex = overColItems.findIndex(w => (w.id || w._id) === overWlId);
        const insertAt = overIndex === -1 ? overColItems.length : overIndex;

        // Insert active item at the new position
        overColItems.splice(insertAt, 0, activeWl);

        // Recalculate coordinates for the target column
        const updatedTargetItems = overColItems.map((w, idx) => ({
            ...w,
            coordinate: [overCol, idx] as [number, number],
        }));

        // Recalculate coordinates for the source column (without the active item)
        const sourceColItems = prev
            .filter(w => w.coordinate[0] === activeCol && (w.id || w._id) !== activeWlId)
            .sort((a, b) => a.coordinate[1] - b.coordinate[1])
            .map((w, idx) => ({
                ...w,
                coordinate: [activeCol, idx] as [number, number],
            }));

        // Rebuild full list
        const otherItems = prev.filter(
            w => w.coordinate[0] !== activeCol && w.coordinate[0] !== overCol
        );
        return [...otherItems, ...sourceColItems, ...updatedTargetItems];
    });
}, [findColumnIndex]);

const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    const activeWlId = active.id as string;
    const overWlId = over ? (over.id as string) : null;

    // Same-column reorder (cross-column was already handled in onDragOver)
    if (overWlId && activeWlId !== overWlId) {
        const activeCol = findColumnIndex(activeWlId);
        const overCol = findColumnIndex(overWlId);

        if (activeCol === overCol && activeCol !== -1) {
            setWatchlists(prev => {
                const colItems = prev
                    .filter(w => w.coordinate[0] === activeCol)
                    .sort((a, b) => a.coordinate[1] - b.coordinate[1]);

                const activeIdx = colItems.findIndex(w => (w.id || w._id) === activeWlId);
                const overIdx = colItems.findIndex(w => (w.id || w._id) === overWlId);

                if (activeIdx === -1 || overIdx === -1) return prev;

                const reordered = [...colItems];
                const [moved] = reordered.splice(activeIdx, 1);
                reordered.splice(overIdx, 0, moved);

                const updatedColItems = reordered.map((w, idx) => ({
                    ...w,
                    coordinate: [activeCol, idx] as [number, number],
                }));

                const otherItems = prev.filter(w => w.coordinate[0] !== activeCol);
                return [...otherItems, ...updatedColItems];
            });
        }
    }

    // Send reorder API — read latest state from ref (avoids stale closure)
    // Use requestAnimationFrame to let React flush the state update above
    requestAnimationFrame(() => {
        const current = watchlistsRef.current;
        const before = watchlistsBeforeDrag.current;

        const changed = current.filter(w => {
            const prev = before.find(b => (b.id || b._id) === (w.id || w._id));
            if (!prev) return false;
            return prev.coordinate[0] !== w.coordinate[0] || prev.coordinate[1] !== w.coordinate[1];
        });

        if (changed.length === 0) return;

        setIsReordering(true);
        const items = changed.map(w => ({
            id: w.id || w._id!,
            coordinate: w.coordinate,
        }));

        apiClient({
            url: '/api/v1/watchlists/reorder',
            method: 'POST',
            body: { items },
            requireAuth: true,
        }).catch(() => {
            // Rollback on failure
            setWatchlists(watchlistsBeforeDrag.current);
        }).finally(() => {
            setIsReordering(false);
        });
    });
}, [findColumnIndex]);
```

- [ ] **Step 5: Add the `activeWatchlist` computed value for DragOverlay**

After the DnD handlers, add:

```typescript
const activeWatchlist = useMemo(
    () => (activeId ? watchlists.find(w => (w.id || w._id) === activeId) ?? null : null),
    [activeId, watchlists],
);
```

- [ ] **Step 6: Update the `visualColumns` to produce sortable IDs**

The existing `visualColumns` memo (lines 107-137) needs a small update. It already builds columns correctly. We need to extract the sortable IDs per column for `SortableContext`. Add after `visualColumns`:

```typescript
// Extract sortable IDs per column for SortableContext
const columnSortableIds = useMemo(() => {
    return visualColumns.map(colItems =>
        colItems
            .filter((item): item is { type: 'wl'; wl: Watchlist } => item.type === 'wl')
            .map(item => item.wl.id || item.wl._id!)
    );
}, [visualColumns]);
```

- [ ] **Step 7: Wrap the columns layout with DndContext**

Replace **only** the columns rendering block (lines 239-305, the `<Box sx={{ display: 'flex', gap: 1.5, ... }}>` and its children). Do NOT touch the `AddWatchlistDialog` and `ConfirmDialog` components that follow after line 305. Replace with:

```typescript
<DndContext
    sensors={isReordering ? [] : sensors}
    collisionDetection={closestCorners}
    onDragStart={handleDragStart}
    onDragOver={handleDragOver}
    onDragEnd={handleDragEnd}
>
    <Box
        sx={{
            display: 'flex',
            gap: 1.5,
            alignItems: 'flex-start',
            overflowX: 'auto',
            '&::-webkit-scrollbar': { height: 5 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
                bgcolor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                borderRadius: 3,
            },
        }}
    >
        {visualColumns.map((colItems, colIdx) => (
            <SortableContext
                key={colIdx}
                items={columnSortableIds[colIdx] || []}
                strategy={verticalListSortingStrategy}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                        width: 260,
                        flexShrink: 0,
                    }}
                >
                    {colItems.map((item) =>
                        item.type === 'wl' ? (
                            <SortableWatchlistCard key={item.wl.id || item.wl._id} id={item.wl.id || item.wl._id!}>
                                {(dragHandleProps) => (
                                    <WatchlistColumn
                                        watchlist={item.wl}
                                        stockDataMap={stockDataMap}
                                        allTickers={allTickers}
                                        onDelete={() => handleDeleteClick(item.wl.id || item.wl._id!)}
                                        onRename={() => openRename(item.wl)}
                                        onAddStock={(ticker) =>
                                            handleUpdateStocks(item.wl, [...item.wl.stock_symbols, ticker])
                                        }
                                        onRemoveStock={(ticker) =>
                                            handleUpdateStocks(item.wl, item.wl.stock_symbols.filter(s => s !== ticker))
                                        }
                                        dragHandleProps={dragHandleProps}
                                    />
                                )}
                            </SortableWatchlistCard>
                        ) : (
                            <Box
                                key={`add-${item.coordinate[0]}-${item.coordinate[1]}`}
                                onClick={() => openCreate(item.coordinate)}
                                sx={{
                                    minHeight: 80,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: `${borderRadius.md}px`,
                                    border: `1px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    '&:hover': {
                                        bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                        borderColor: theme.palette.primary.main,
                                    },
                                }}
                            >
                                <AddIcon sx={{ fontSize: 22, color: 'text.disabled' }} />
                            </Box>
                        ),
                    )}
                </Box>
            </SortableContext>
        ))}
    </Box>

    {typeof document !== 'undefined' && createPortal(
        <DragOverlay>
            {activeWatchlist ? (
                <Box sx={{ opacity: 0.85, transform: 'scale(1.02)', boxShadow: 6 }}>
                    <WatchlistColumn
                        watchlist={activeWatchlist}
                        stockDataMap={stockDataMap}
                        allTickers={allTickers}
                        onDelete={() => {}}
                        onRename={() => {}}
                        onAddStock={() => {}}
                        onRemoveStock={() => {}}
                    />
                </Box>
            ) : null}
        </DragOverlay>,
        document.body,
    )}
</DndContext>
```

- [ ] **Step 8: Verify the build**

Run: `cd d:/twan_projects/finext-web-app/finext-nextjs && npx tsc --noEmit --pretty 2>&1 | head -40`
Expected: No type errors

- [ ] **Step 9: Commit**

```bash
git add finext-nextjs/app/(main)/watchlist/PageContent.tsx
git commit -m "feat(watchlist): integrate @dnd-kit drag-and-drop with reorder API"
```

---

## Task 8: Manual Smoke Test

- [ ] **Step 1: Start the backend**

Run: `cd d:/twan_projects/finext-web-app/finext-fastapi && python -m uvicorn app.main:app --reload --port 8000`

Verify: Open `http://localhost:8000/docs` and check that `POST /api/v1/watchlists/reorder` appears in the Swagger docs.

- [ ] **Step 2: Start the frontend**

Run: `cd d:/twan_projects/finext-web-app/finext-nextjs && npm run dev`

Verify: Open the watchlist page. Confirm:
1. Drag handle (grip icon) appears on each watchlist card header
2. Dragging a card shows the DragOverlay preview
3. Dropping in a new position within the same column reorders correctly
4. Dropping in a different column moves the card
5. Scrolling horizontally during drag works without dropping
6. After drop, coordinates update via API (check network tab)
7. Refreshing the page preserves the new order
