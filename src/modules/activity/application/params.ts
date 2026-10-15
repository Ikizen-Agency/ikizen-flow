import { firstParam, type SearchParamsRecord } from "../../customers/application/list-params";
import { ACTIVITY_CATEGORIES, ACTIVITY_ENTITY_TYPES, type ActivityCategory, type ActivityEntityType } from "../domain/activity";
import type { ActivityFeedQuery } from "./ports";

const positiveInt = (value: string | undefined) => (value && /^\d{1,9}$/.test(value) && Number(value) > 0 ? Number(value) : undefined);

/** URL state of /activity: `?category=`, `?member=<member id>`, `?entity=customer|order|task`, `?page=`. */
export function parseActivityParams(params: SearchParamsRecord): ActivityFeedQuery & { page: number } {
  const query: ActivityFeedQuery & { page: number } = { page: positiveInt(firstParam(params.page)) ?? 1 };
  const category = firstParam(params.category);
  if (ACTIVITY_CATEGORIES.includes(category as ActivityCategory)) query.category = category as ActivityCategory;
  const actorId = positiveInt(firstParam(params.member));
  if (actorId) query.actorId = actorId;
  const entity = firstParam(params.entity);
  if (ACTIVITY_ENTITY_TYPES.includes(entity as ActivityEntityType)) query.entityType = entity as ActivityEntityType;
  return query;
}
