"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  EyeOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TextCell from "./cells/TextCell";
import StatusCell from "./cells/StatusCell";
import PriorityCell from "./cells/PriorityCell";
import PeopleCell from "./cells/PeopleCell";
import DateCell from "./cells/DateCell";
import NumberCell from "./cells/NumberCell";
import DropdownCell from "./cells/DropdownCell";
import CheckboxCell from "./cells/CheckboxCell";
import TagsCell from "./cells/TagsCell";
import BudgetCell from "./cells/BudgetCell";

const COLUMN_DEFAULT_WIDTH = {
  text: 200,
  number: 130,
  status: 130,
  priority: 130,
  date: 150,
  people: 150,
  dropdown: 150,
  checkbox: 80,
  tags: 160,
  budget: 150,
};

const ColumnHeader = ({ column, onUpdateColumn, onDeleteColumn, onHideColumn, userRole }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(column.title);

  const isAdmin = userRole === "admin";

  const handleBlur = () => {
    setIsEditing(false);
    if (title.trim() && title !== column.title) {
      onUpdateColumn(column.id, { title: title.trim() });
    } else {
      setTitle(column.title);
    }
  };

  return (
    <div className="relative flex items-center justify-center w-full h-full px-3 group">
      {isEditing ? (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleBlur();
            if (e.key === "Escape") {
              setTitle(column.title);
              setIsEditing(false);
            }
          }}
          className="text-xs font-semibold text-foreground bg-card border border-primary rounded px-1 py-0.5 focus:outline-none w-full text-center"
          autoFocus
        />
      ) : (
        isAdmin ? (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            title="Rename column"
            className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            {column.title}
          </button>
        ) : (
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {column.title}
          </span>
        )
      )}
      {isAdmin && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Options for column ${column.title}`}
            className="absolute right-1 rounded p-0.5 text-subtle-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onHideColumn(column.id)}>
            <EyeOff className="w-3.5 h-3.5 mr-2" />
            Hide Column
          </DropdownMenuItem>
          {column.id !== "task" && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDeleteColumn(column.id)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete Column
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      )}
    </div>
  );
};

const ItemRow = ({
  item,
  columns,
  index,
  onUpdateItem,
  onDeleteItem,
  selectedItems,
  onSelectItem,
  boardId,
  userRole,
  onSelectTask,
}) => {
  const isViewer = userRole === "viewer";
  const renderCell = (column) => {
    const value = item.data?.[column.id];
    const cellProps = {
      value,
      column,
      itemId: item.id,
      onUpdate: isViewer
        ? undefined
        : (newValue) =>
            onUpdateItem(item.id, {
              data: { ...item.data, [column.id]: newValue },
            }, item),
    };

    if (column.id === "priority" || column.type === "priority") {
      return <PriorityCell {...cellProps} />;
    }

    switch (column.type) {
      case "text":
        return <TextCell {...cellProps} />;
      case "status":
        return <StatusCell {...cellProps} />;
      case "priority":
        return <PriorityCell {...cellProps} />;
      case "people":
        return <PeopleCell {...cellProps} boardId={boardId} />;
      case "date":
        return <DateCell {...cellProps} />;
      case "number":
        return <NumberCell {...cellProps} />;
      case "dropdown":
        return <DropdownCell {...cellProps} />;
      case "checkbox":
        return <CheckboxCell {...cellProps} />;
      case "tags":
        return <TagsCell {...cellProps} />;
      case "budget":
        return <BudgetCell {...cellProps} />;
      default:
        return (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            {String(value ?? "")}
          </div>
        );
    }
  };

  const isSelected = selectedItems?.has(item.id);

  const rowTone = isSelected ? "bg-accent" : "bg-card group-hover/row:bg-muted";

  return (
    <div
      className={`group/row flex items-center border-b border-border transition-colors ${
        isSelected ? "bg-accent" : "bg-card hover:bg-muted"
      }`}
    >
      {/* Checkbox + title stay pinned while the columns scroll sideways. */}
      <div
        className={`sticky left-0 z-10 flex h-[44px] shrink-0 items-center border-r border-border/60 transition-colors ${rowTone}`}
      >
        <div className="flex w-[48px] shrink-0 items-center justify-center">
          <input
            type="checkbox"
            checked={isSelected || false}
            onChange={(e) => onSelectItem?.(item.id, e.target.checked)}
            aria-label={`Select ${item.title}`}
            className="h-4 w-4 rounded border-border accent-primary"
          />
        </div>
        <div className="flex h-full w-[168px] items-center pr-3 sm:w-[260px]">
          <button
            type="button"
            onClick={() => onSelectTask?.(item)}
            className="block truncate text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            {item.title}
          </button>
        </div>
      </div>
      {/* Dynamic Columns */}
      {columns
        .filter((col) => col.id !== "task")
        .map((column) => (
          <div
            key={column.id}
            className="shrink-0 px-2 h-[44px] flex items-center justify-center"
            style={{ width: column.width || COLUMN_DEFAULT_WIDTH[column.type] || 130 }}
          >
            {renderCell(column)}
          </div>
        ))}
      <div className="min-w-[40px] flex-1" />
    </div>
  );
};

export default function GroupSection({
  group,
  items,
  columns,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onReorderItems,
  onUpdateColumn,
  onDeleteColumn,
  onAddColumn,
  isLoading,
  selectedItems,
  onSelectItem,
  onDeleteGroup,
  onHideColumnFromGroup,
  boardId,
  userRole,
  onSelectTask,
}) {
  const canEdit = userRole === "admin" || userRole === "editor";
  const canAdmin = userRole === "admin";
  const [collapsed, setCollapsed] = useState(group.collapsed || false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    onAddItem(group.id, newTaskTitle.trim());
    setNewTaskTitle("");
    setIsAdding(false);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    onReorderItems(group.id, result.source.index, result.destination.index);
  };

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Group Header */}
      <div className="flex items-center gap-3 border-b border-border bg-muted px-4 py-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="text-muted-foreground">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: group.color || "#2563EB" }}
            aria-hidden
          />
          <span className="truncate text-sm font-semibold text-foreground">{group.title}</span>
          <span className="text-xs text-subtle-foreground">({items.length})</span>
        </button>
        {canAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Options for group ${group.title}`}
              className="rounded p-1 text-subtle-foreground hover:bg-accent hover:text-foreground"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteGroup(group.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete Group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>

      {!collapsed && (
        <div className="overflow-x-auto scroll-themed">
          <div className="w-max min-w-full">
            {/* Column Headers */}
            <div className="flex items-center border-b border-border bg-card">
              <div className="sticky left-0 z-10 flex h-[40px] shrink-0 items-center border-r border-border/60 bg-card">
                <div className="w-[48px] shrink-0" />
                <div className="flex w-[168px] items-center pr-3 sm:w-[260px]">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Task
                  </span>
                </div>
              </div>
              {columns
                .filter((col) => col.id !== "task")
                .map((column) => (
                  <div
                    key={column.id}
                    className="shrink-0 px-2 h-[40px]"
                    style={{ width: column.width || COLUMN_DEFAULT_WIDTH[column.type] || 130 }}
                  >
                    <ColumnHeader
                      column={column}
                      onUpdateColumn={onUpdateColumn}
                      onDeleteColumn={onDeleteColumn}
                      onHideColumn={(colId) =>
                        onHideColumnFromGroup(group.id, colId)
                      }
                      userRole={userRole}
                    />
                  </div>
                ))}
              <div className="min-w-[40px] flex-1">
                {canAdmin && (
                <button
                  type="button"
                  onClick={() => onAddColumn?.()}
                  className="p-2 text-subtle-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  title="Add column"
                  aria-label="Add column"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                )}
              </div>
            </div>

            {/* Items */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId={`group-${group.id}`}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="bg-card"
                  >
                    {items.length === 0 && !isLoading && (
                      <div className="sticky left-0 w-[min(100vw-3rem,40rem)] px-4 py-8 text-center text-subtle-foreground text-sm">
                        No tasks in this group yet.
                      </div>
                    )}
                    {items.map((item, index) => (
                      <Draggable
                        key={item.id}
                        draggableId={String(item.id)}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <ItemRow
                              item={item}
                              columns={columns}
                              index={index}
                              onUpdateItem={onUpdateItem}
                              onDeleteItem={onDeleteItem}
                              selectedItems={selectedItems}
                              onSelectItem={onSelectItem}
                              boardId={boardId}
                              userRole={userRole}
                              onSelectTask={onSelectTask}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {/* Add Task Row */}
                    {canEdit && (isAdding ? (
                      <div className="sticky left-0 flex w-[min(100vw-3rem,40rem)] items-center px-4 py-2 border-t border-border">
                        <div className="flex-1 min-w-[160px]">
                          <input
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddTask();
                              if (e.key === "Escape") {
                                setNewTaskTitle("");
                                setIsAdding(false);
                              }
                            }}
                            placeholder="Enter task title..."
                            aria-label="New task title"
                            className="w-full rounded border border-primary bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                            autoFocus
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={handleAddTask}
                          disabled={!newTaskTitle.trim()}
                          className="bg-primary hover:bg-primary/90 text-white rounded-lg h-8 px-3 text-xs ml-2"
                        >
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setNewTaskTitle("");
                            setIsAdding(false);
                          }}
                          className="text-muted-foreground h-8 px-2 ml-1 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="sticky left-0 w-fit px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setIsAdding(true)}
                          className="flex items-center gap-2 rounded px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/10 hover:text-primary/80"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Task
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </div>
      )}
    </div>
  );
}
