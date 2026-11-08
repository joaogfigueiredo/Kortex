import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { Dot } from '../ui';

export interface BoardColumn<T> {
  id: string;
  title: string;
  /** Cor neon da coluna (ponto + realce ao arrastar). */
  color: string;
  items: T[];
  /** Texto pequeno acima do título (ex.: "Desenvolvimento" para sub-níveis). */
  eyebrow?: string;
}

export interface BoardProps<T extends { id: number }> {
  columns: BoardColumn<T>[];
  renderCard: (item: T, state: { overlay: boolean }) => ReactNode;
  /** Disparado ao soltar: coluna de destino e índice final dentro dela. */
  onMove: (id: number, toColumn: string, toIndex: number) => void;
  onOpen?: (item: T) => void;
  onAdd?: (columnId: string) => void;
  /** fit = colunas dividem a largura no desktop · scroll = rolagem horizontal sempre. */
  layout?: 'fit' | 'scroll';
  emptyLabel?: string;
}

type ItemsMap<T> = Record<string, T[]>;

const COL_PREFIX = 'col:';
const isColumnId = (id: UniqueIdentifier) => String(id).startsWith(COL_PREFIX);

/**
 * Kanban genérico com dnd-kit: mouse, toque (segurar ~0,2s) e teclado
 * (Espaço pega/solta, setas movem, Esc cancela; Enter abre o card).
 */
export function Board<T extends { id: number }>({
  columns,
  renderCard,
  onMove,
  onOpen,
  onAdd,
  layout = 'fit',
  emptyLabel = 'Arraste cards para cá',
}: BoardProps<T>) {
  const fromProps = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.id, c.items])) as ItemsMap<T>,
    [columns],
  );
  const [items, setItems] = useState<ItemsMap<T>>(fromProps);
  const [activeId, setActiveId] = useState<number | null>(null);
  const origin = useRef<{ column: string; index: number; snapshot: ItemsMap<T> } | null>(null);

  // Fora de um arraste, o estado local espelha os dados vindos da API.
  useEffect(() => {
    if (activeId === null) setItems(fromProps);
  }, [fromProps, activeId]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const findColumn = (id: UniqueIdentifier, map = items): string | undefined => {
    if (isColumnId(id)) return String(id).slice(COL_PREFIX.length);
    return Object.keys(map).find((col) => map[col]!.some((it) => it.id === id));
  };

  const activeItem =
    activeId === null
      ? null
      : (Object.values(items)
          .flat()
          .find((it) => it.id === activeId) ?? null);

  function handleDragStart({ active }: DragStartEvent) {
    const column = findColumn(active.id)!;
    origin.current = {
      column,
      index: items[column]!.findIndex((it) => it.id === active.id),
      snapshot: items,
    };
    setActiveId(Number(active.id));
  }

  // Ao passar sobre outra coluna, o card "pula" para ela em tempo real.
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = findColumn(active.id);
    const to = findColumn(over.id);
    if (!from || !to || from === to) return;
    setItems((prev) => {
      const source = prev[from]!;
      const target = prev[to]!;
      const moving = source.find((it) => it.id === active.id);
      if (!moving) return prev;
      const overIndex = target.findIndex((it) => it.id === over.id);
      const insertAt = isColumnId(over.id) || overIndex < 0 ? target.length : overIndex;
      return {
        ...prev,
        [from]: source.filter((it) => it.id !== active.id),
        [to]: [...target.slice(0, insertAt), moving, ...target.slice(insertAt)],
      };
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const start = origin.current;
    origin.current = null;
    if (!over || !start) {
      if (start) setItems(start.snapshot);
      setActiveId(null);
      return;
    }
    const column = findColumn(active.id)!;
    let list = items[column]!;
    const oldIndex = list.findIndex((it) => it.id === active.id);
    const overIndex = list.findIndex((it) => it.id === over.id);
    if (overIndex >= 0 && overIndex !== oldIndex) {
      list = arrayMove(list, oldIndex, overIndex);
      setItems((prev) => ({ ...prev, [column]: list }));
    }
    const finalIndex = list.findIndex((it) => it.id === active.id);
    setActiveId(null);
    if (column !== start.column || finalIndex !== start.index) {
      onMove(Number(active.id), column, finalIndex);
    }
  }

  function handleDragCancel() {
    if (origin.current) setItems(origin.current.snapshot);
    origin.current = null;
    setActiveId(null);
  }

  const dragging = activeId !== null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Pressione Espaço para pegar o card. Use as setas para mover e Espaço para soltar. Esc cancela.',
        },
      }}
    >
      <div
        className={clsx(
          '-mx-4 flex gap-4 overflow-x-auto px-4 pt-1 pb-6 md:mx-0 md:px-1',
          !dragging && 'snap-x snap-mandatory md:snap-none',
          layout === 'fit' && 'lg:overflow-visible',
        )}
      >
        {columns.map((col) => (
          <Column
            key={col.id}
            column={col}
            items={items[col.id] ?? []}
            layout={layout}
            onAdd={onAdd}
            emptyLabel={emptyLabel}
          >
            {(items[col.id] ?? []).map((item) => (
              <SortableCard
                key={item.id}
                id={item.id}
                onOpen={onOpen ? () => onOpen(item) : undefined}
              >
                {renderCard(item, { overlay: false })}
              </SortableCard>
            ))}
          </Column>
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {activeItem && (
          <div className="rotate-2 cursor-grabbing rounded-2xl shadow-glow">
            {renderCard(activeItem, { overlay: true })}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column<T>({
  column,
  items,
  layout,
  onAdd,
  emptyLabel,
  children,
}: {
  column: BoardColumn<T>;
  items: { id: number }[];
  layout: 'fit' | 'scroll';
  onAdd?: (columnId: string) => void;
  emptyLabel: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: COL_PREFIX + column.id });
  return (
    <section
      aria-label={column.title}
      className={clsx(
        'flex w-[84vw] max-w-sm shrink-0 snap-center flex-col sm:w-80',
        layout === 'fit' && 'lg:w-auto lg:max-w-none lg:min-w-0 lg:flex-1',
      )}
    >
      <header className="mb-3 flex min-h-10 items-center gap-2.5 px-2">
        <Dot color={column.color} size={10} />
        <div className="min-w-0 flex-1">
          {column.eyebrow && (
            <p className="text-[10px] font-semibold tracking-wider text-muted uppercase">
              {column.eyebrow}
            </p>
          )}
          <h2 className="line-clamp-2 text-sm leading-tight font-semibold">{column.title}</h2>
        </div>
        <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-muted tabular-nums shadow-neu-inset-sm">
          {items.length}
        </span>
        {onAdd && (
          <button
            type="button"
            aria-label={`Adicionar em ${column.title}`}
            title="Adicionar"
            onClick={() => onAdd(column.id)}
            className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:text-accent-ink"
          >
            <Plus className="size-4" />
          </button>
        )}
      </header>

      <div
        ref={setNodeRef}
        className="flex min-h-40 flex-1 flex-col gap-3 rounded-3xl bg-bg p-3 shadow-neu-inset transition-shadow duration-200"
        style={
          isOver
            ? {
                boxShadow: `var(--shadow-neu-inset), 0 0 0 2px ${column.color}88, 0 0 24px ${column.color}33`,
              }
            : undefined
        }
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
        {items.length === 0 && (
          <p className="grid flex-1 place-items-center px-4 py-8 text-center text-xs text-muted">
            {emptyLabel}
          </p>
        )}
      </div>
    </section>
  );
}

function SortableCard({
  id,
  onOpen,
  children,
}: {
  id: number;
  onOpen?: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === 'Enter' && onOpen) {
          // Sem isso o mesmo Enter "clica" no 1º botão do modal recém-aberto.
          e.preventDefault();
          onOpen();
        }
      }}
      className={clsx(
        'touch-manipulation rounded-2xl outline-none select-none focus-visible:ring-2 focus-visible:ring-accent',
        isDragging ? 'opacity-30' : 'cursor-grab',
      )}
    >
      {children}
    </div>
  );
}
