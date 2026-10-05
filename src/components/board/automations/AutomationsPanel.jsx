"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, Clock, Info, Lock, UserPlus, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { automationsApi } from "@/lib/api/automations";
import { cn } from "@/lib/utils";

// Each recipe is executed by the database (supabase/schema.sql §9b), so it
// runs for every change — whoever makes it and from wherever.
const RECIPES = [
  {
    id: "notify_status_change",
    icon: Bell,
    name: "Notify assignees on status change",
    description: "Everyone assigned to a task is notified when its status changes.",
  },
  {
    id: "notify_owner_on_done",
    icon: CheckCircle2,
    name: "Tell the board owner when a task is done",
    description: "The board owner is notified whenever a task moves to Done.",
  },
  {
    id: "subitems_done_parent",
    icon: CheckCircle2,
    name: "Close the parent when all subtasks are done",
    description: "Once every subtask is Done, the parent task is set to Done too.",
  },
  {
    id: "assign_creator",
    icon: UserPlus,
    name: "Assign new tasks to their creator",
    description: "A task created without an owner is assigned to the person who created it.",
  },
  {
    id: "due_date_reminder",
    icon: Clock,
    name: "Due date reminders",
    description: "Assignees of unfinished tasks are reminded the day before and on the due date.",
    needsCron: true,
  },
];

export default function AutomationsPanel({ board, canAdmin, onClose }) {
  const queryClient = useQueryClient();
  const boardId = board?.id;
  const queryKey = ["automations", boardId];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => automationsApi.list(boardId),
    enabled: Boolean(boardId),
  });

  const { data: capabilities } = useQuery({
    queryKey: ["automations", "capabilities"],
    queryFn: () => automationsApi.capabilities(),
    staleTime: 10 * 60 * 1000,
  });

  const toggle = useMutation({
    mutationFn: ({ recipe, enabled }) => automationsApi.set(boardId, recipe, enabled),
    onMutate: async ({ recipe, enabled }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old = []) => [
        ...old.filter((row) => row.recipe !== recipe),
        { recipe, enabled },
      ]);
      return { previous };
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error(err.message);
    },
    onSuccess: (_data, { enabled, recipe }) => {
      const name = RECIPES.find((r) => r.id === recipe)?.name;
      toast.success(`${name} ${enabled ? "enabled" : "disabled"}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const enabledById = Object.fromEntries(rows.map((row) => [row.recipe, row.enabled]));
  const cronAvailable = capabilities?.cron !== false;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-themed sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Zap className="h-4 w-4" />
            </span>
            Automations
          </DialogTitle>
          <DialogDescription>
            Rules for <span className="font-medium text-foreground">{board?.title}</span>. They run in the
            database, for every change made by anyone on this board.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Always on: people are notified when they are assigned to a task, when someone comments on
            a task they are assigned to or discussing, and when they are @mentioned.
          </p>
        </div>

        {!canAdmin && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" /> Only board admins can change automations.
          </p>
        )}

        <ul className="divide-y divide-border rounded-xl border border-border">
          {RECIPES.map((recipe) => {
            const Icon = recipe.icon;
            const enabled = Boolean(enabledById[recipe.id]);
            const blocked = recipe.needsCron && !cronAvailable;
            const switchId = `automation-${recipe.id}`;
            return (
              <li key={recipe.id} className="flex items-start gap-3 p-4">
                <span
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                    enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <label htmlFor={switchId} className="block font-medium text-foreground">
                    {recipe.name}
                  </label>
                  <p className="mt-0.5 text-sm text-muted-foreground">{recipe.description}</p>
                  {blocked && (
                    <p className="mt-1 text-xs text-warning">
                      Needs the pg_cron extension (Supabase → Database → Extensions), then re-run schema.sql.
                    </p>
                  )}
                </div>
                <Switch
                  id={switchId}
                  checked={enabled}
                  disabled={!canAdmin || isLoading || blocked || toggle.isPending}
                  onCheckedChange={(checked) => toggle.mutate({ recipe: recipe.id, enabled: checked })}
                  aria-label={recipe.name}
                />
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
