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
  date: 140,
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
    <div className="flex items-center gap-2 group px-3 py-2 min-w-[120px]">
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
          className="text-xs font-semibold text-[#323338] bg-white border border-[#0073EA] rounded px-1 py-0.5 focus:outline-none w-full"
          autoFocus
        />
      ) : (
        <span
          className={`text-xs font-semibold text-[#676879] uppercase tracking-wide truncate ${isAdmin ? "cursor-pointer hover:text-[#323338]" : ""}`}
          onClick={() => isAdmin && setIsEditing(true)}
        >
          {column.title}
        </span>
      )}
      {isAdmin && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="opacity-0 group-hover:opacity-100 text-[#A0A0A0] hover:text-[#323338] transition-opacity ml-auto">
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
              className="text-red-600"
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
            }),
    };

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
          <div className="px-3 py-2 text-sm text-[#676879]">
            {String(value ?? "")}
          </div>
        );
    }
  };

  const isSelected = selectedItems?.has(item.id);

  return (
    <div
      className={`flex items-center border-b border-[#E1E5F3] hover:bg-[#F5F6F8]/50 transition-colors ${
        isSelected ? "bg-[#0073EA]/5" : ""
      }`}
    >
      {/* Drag Handle + Checkbox */}
      <div className="shrink-0 flex items-center gap-2 px-2 w-[60px]">
        <input
          type="checkbox"
          checked={isSelected || false}
          onChange={(e) => onSelectItem?.(item.id, e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-[#0073EA] focus:ring-[#0073EA]"
        />
      </div>
      {/* Task Title */}
      <div className="flex-1 min-w-[160px] px-3 py-2">
        <span className="text-sm text-[#323338] font-medium truncate block">
          {item.title}
        </span>
      </div>
      {/* Dynamic Columns */}
      {columns
        .filter((col) => col.id !== "task")
        .map((column) => (
          <div
            key={column.id}
            className="shrink-0 px-2"
            style={{ width: column.width || COLUMN_DEFAULT_WIDTH[column.type] || 130 }}
          >
            {renderCell(column)}
          </div>
        ))}
      <div className="shrink-0 w-10" />
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
}) {
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
    <div className="border-b border-[#E1E5F3] last:border-b-0">
      {/* Group Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-[#F5F6F8] border-b border-[#E1E5F3] cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <button className="text-[#676879] hover:text-[#323338]">
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: group.color || "#0073EA" }}
        />
        <span className="font-semibold text-[#323338] text-sm">
          {group.title}
        </span>
        <span className="text-xs text-[#A0A0A0]">({items.length})</span>
        <div className="flex-1" />
        {userRole === "admin" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="text-[#A0A0A0] hover:text-[#323338] p-1 rounded hover:bg-white/50"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-red-600"
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
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Column Headers */}
            <div className="flex items-center border-b border-[#E1E5F3] bg-white">
              <div className="shrink-0 w-[60px] px-2" />
              <div className="flex-1 min-w-[160px] px-3 py-2">
                <span className="text-xs font-semibold text-[#676879] uppercase tracking-wide">
                  Task
                </span>
              </div>
              {columns
                .filter((col) => col.id !== "task")
                .map((column) => (
                  <div
                    key={column.id}
                    className="shrink-0 px-2"
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
              <div className="shrink-0 w-[40px]">
                {userRole === "admin" && (
                <button
                  onClick={() => onAddColumn?.()}
                  className="p-2 text-[#A0A0A0] hover:text-[#0073EA] hover:bg-[#0073EA]/5 rounded-lg transition-colors"
                  title="Add column"
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
                    className="bg-white"
                  >
                    {items.length === 0 && !isLoading && (
                      <div className="px-4 py-8 text-center text-[#A0A0A0] text-sm">
                        No tasks in this group. Click + to add one.
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
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {/* Add Task Row */}
                    {userRole === "admin" && (isAdding ? (
                      <div className="flex items-center px-4 py-2 border-t border-[#E1E5F3]">
                        <div className="shrink-0 w-[60px]" />
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
                            className="w-full text-sm border border-[#0073EA] rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0073EA]"
                            autoFocus
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={handleAddTask}
                          disabled={!newTaskTitle.trim()}
                          className="bg-[#0073EA] hover:bg-[#0056B3] text-white rounded-lg h-8 px-3 text-xs ml-2"
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
                          className="text-[#676879] h-8 px-2 ml-1 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="px-4 py-2 border-t border-[#E1E5F3]">
                        <button
                          onClick={() => setIsAdding(true)}
                          className="flex items-center gap-2 text-sm text-[#0073EA] hover:text-[#0056B3] font-medium px-2 py-1 rounded hover:bg-[#0073EA]/5 transition-colors"
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
