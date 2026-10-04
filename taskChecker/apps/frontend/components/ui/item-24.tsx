"use client";

import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import { cn, hueFrom, initials } from "@/lib/utils";

export interface InviteTeammate {
  userId: string;
  name: string | null;
  email: string | null;
}

interface Item24Props {
  /** Members shown stacked in the header. Defaults to placeholder slots. */
  members?: InviteTeammate[];
  onInvite?: () => void;
  className?: string;
}

const PLACEHOLDERS = ["Teammate 1", "Teammate 2"];

export function Item24({ members = [], onInvite, className }: Item24Props) {
  const stack = members.slice(0, 3);
  const fillers = stack.length === 0 ? PLACEHOLDERS : [];

  return (
    <Item variant="outline" className={cn("w-full", className)}>
      <ItemHeader className="justify-start">
        <AvatarGroup>
          {stack.map((m) => {
            const tint = hueFrom(m.userId + (m.email ?? ""));
            return (
              <Avatar key={m.userId} aria-label={m.name ?? m.email ?? "Member"}>
                <AvatarFallback
                  style={{
                    background: `hsl(${tint} 45% 20%)`,
                    color: `hsl(${tint} 80% 78%)`,
                  }}
                >
                  {initials(m.name ?? m.email ?? "?")}
                </AvatarFallback>
              </Avatar>
            );
          })}
          {fillers.map((label) => (
            <Avatar key={label} aria-label={label} className="grayscale">
              <AvatarFallback>{initials(label)}</AvatarFallback>
            </Avatar>
          ))}
        </AvatarGroup>
      </ItemHeader>
      <ItemContent>
        <ItemTitle>No team members yet</ItemTitle>
        <ItemDescription>
          Invite your team to collaborate on this project.
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline" onClick={onInvite}>
          Invite
        </Button>
      </ItemActions>
    </Item>
  );
}

export default Item24;
