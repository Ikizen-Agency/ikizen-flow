import "server-only";
import { and, asc, count, desc, eq, isNotNull, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db/connect";
import { activityEvents, members, orders } from "@/server/db/schema";
import { activityHref, type ActivityEntityType, type NewActivityEvent } from "../domain/activity";
import type { ActivityFeedQuery, ActivityRepository } from "../application/ports";

/** Activity log of one workspace. */
export class DrizzleActivityRepository implements ActivityRepository {
  constructor(
    private readonly db: Database,
    private readonly workspaceId: number,
  ) {}

  private select() {
    return this.db
      .select({
        id: activityEvents.id,
        actorName: members.name,
        message: activityEvents.message,
        category: activityEvents.category,
        entityType: activityEvents.entityType,
        entityId: activityEvents.entityId,
        createdAt: activityEvents.createdAt,
      })
      .from(activityEvents)
      .leftJoin(members, eq(members.id, activityEvents.actorId));
  }

  recent(limit: number) {
    return this.select()
      .where(eq(activityEvents.workspaceId, this.workspaceId))
      .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id)).limit(limit);
  }

  async list({ category, actorId, entityType, page = 1, pageSize = 20 }: ActivityFeedQuery) {
    const filters: SQL[] = [eq(activityEvents.workspaceId, this.workspaceId)];
    if (category) filters.push(eq(activityEvents.category, category));
    if (actorId) filters.push(eq(activityEvents.actorId, actorId));
    if (entityType) filters.push(eq(activityEvents.entityType, entityType));
    const where = and(...filters);
    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          id: activityEvents.id,
          actorName: members.name,
          message: activityEvents.message,
          category: activityEvents.category,
          entityType: activityEvents.entityType,
          entityId: activityEvents.entityId,
          createdAt: activityEvents.createdAt,
          orderReference: orders.reference,
        })
        .from(activityEvents)
        .leftJoin(members, eq(members.id, activityEvents.actorId))
        .leftJoin(orders, and(eq(activityEvents.entityType, "order"), eq(orders.id, activityEvents.entityId), eq(orders.workspaceId, this.workspaceId)))
        .where(where)
        .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ value: count() }).from(activityEvents).where(where),
    ]);
    return {
      items: rows.map(({ orderReference, ...event }) => ({ ...event, href: activityHref(event.entityType, event.entityId, orderReference) })),
      total: total?.value ?? 0,
      page,
      pageSize,
    };
  }

  forEntity(entityType: ActivityEntityType, entityId: number, limit: number) {
    return this.select()
      .where(
        and(
          eq(activityEvents.workspaceId, this.workspaceId),
          eq(activityEvents.entityType, entityType),
          eq(activityEvents.entityId, entityId),
        ),
      )
      .orderBy(desc(activityEvents.createdAt), desc(activityEvents.id))
      .limit(limit);
  }

  async record(event: NewActivityEvent) {
    await this.db.insert(activityEvents).values({ ...event, workspaceId: this.workspaceId, createdAt: event.createdAt ?? new Date() });
  }

  async originatorOf(entityType: ActivityEntityType, entityId: number) {
    const [row] = await this.db
      .select({ actorId: activityEvents.actorId })
      .from(activityEvents)
      .where(
        and(
          eq(activityEvents.workspaceId, this.workspaceId),
          eq(activityEvents.entityType, entityType),
          eq(activityEvents.entityId, entityId),
          isNotNull(activityEvents.actorId),
        ),
      )
      .orderBy(asc(activityEvents.createdAt), asc(activityEvents.id))
      .limit(1);
    return row?.actorId ?? null;
  }
}
