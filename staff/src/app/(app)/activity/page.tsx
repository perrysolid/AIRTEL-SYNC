"use client";

import { useApi } from "@/lib/api";
import type { FeedEvent } from "@/lib/types";
import { useMe } from "@/components/Shell";
import { Feed } from "@/components/Feed";
import { Empty, LiveDot, Loading, PageHead } from "@/components/ui";

export default function Activity() {
  const me = useMe();
  const { data } = useApi<{ events: FeedEvent[] }>("/api/staff/feed", 10_000);
  return (
    <>
      <PageHead
        title={me.role === "admin" ? "What the team is doing" : "Activity"}
        sub={me.role === "sales" ? "Everything on your leads and orders in the last 7 days." : "Every call, order update and report from the salesman and the supervisor, and every owner who needs a person. Last 7 days."}
        right={<LiveDot />}
      />
      {!data ? <Loading /> : data.events.length ? <div className="card p-2">{<Feed events={data.events} />}</div> : <Empty>Nothing yet this week.</Empty>}
    </>
  );
}
