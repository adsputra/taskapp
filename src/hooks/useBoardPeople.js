import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { userApi } from "@/lib/api/user";

/**
 * Everyone who can work on a board: the owner plus active members, with
 * their profile names. Used for assigning people and for @mentions.
 *
 * @returns {{ people: { id: string, email: string, full_name?: string, role: string }[], isLoading: boolean }}
 */
export function useBoardPeople(board) {
  const ownerId = board?.user_id;
  const boardMembers = board?.board_members;

  const activeMembers = useMemo(
    () => (boardMembers || []).filter((m) => m.status === "active" && m.user_id),
    [boardMembers]
  );

  const ids = useMemo(
    () => [ownerId, ...activeMembers.map((m) => m.user_id)].filter(Boolean).sort(),
    [ownerId, activeMembers]
  );

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["board-people", board?.id, ids.join(",")],
    queryFn: () => userApi.profilesByIds(ids),
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
  });

  const people = useMemo(() => {
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const list = [];
    if (ownerId) {
      const owner = byId.get(ownerId);
      if (owner?.email) list.push({ ...owner, email: owner.email.toLowerCase(), role: "owner" });
    }
    for (const member of activeMembers) {
      if (member.user_id === ownerId) continue;
      const profile = byId.get(member.user_id);
      list.push({
        id: member.user_id,
        email: (member.email || profile?.email || "").toLowerCase(),
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        role: member.role,
      });
    }
    return list.filter((person) => person.email);
  }, [profiles, activeMembers, ownerId]);

  return { people, isLoading };
}
