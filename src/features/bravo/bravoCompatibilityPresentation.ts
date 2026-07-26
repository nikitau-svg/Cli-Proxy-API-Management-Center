import type { BravoCompatibilityFixKind, BravoCompatibilityModel } from '@/services/api';

export type BravoCompatibilityStatusFilter = 'all' | 'action' | 'supported';
export type BravoCompatibilityKindFilter = 'all' | BravoCompatibilityFixKind;

const searchableModelText = (model: BravoCompatibilityModel): string =>
  [
    model.provider,
    model.model,
    model.displayName,
    model.baseModel,
    ...model.routeIds,
    ...model.reasons.flatMap((reason) => [reason.code, reason.message]),
    ...model.fixes.flatMap((fix) => [
      fix.kind,
      fix.title,
      fix.reason,
      fix.target,
      ...(fix.reasonCodes ?? []),
      ...(fix.targets ?? []),
    ]),
  ]
    .join(' ')
    .toLowerCase();

export const filterBravoCompatibilityModels = (
  models: BravoCompatibilityModel[],
  query: string,
  status: BravoCompatibilityStatusFilter,
  kind: BravoCompatibilityKindFilter
): BravoCompatibilityModel[] => {
  const normalizedQuery = query.trim().toLowerCase();
  return models.filter((model) => {
    if (status === 'supported' && model.classification !== 'supported') return false;
    if (status === 'action' && model.classification === 'supported') return false;
    if (
      kind !== 'all' &&
      model.classification !== `${kind}_fix` &&
      !model.requiredFixes.includes(`${kind}_fix`) &&
      !model.requiredFixes.includes(kind) &&
      !model.fixes.some((fix) => fix.kind === kind)
    ) {
      return false;
    }
    return !normalizedQuery || searchableModelText(model).includes(normalizedQuery);
  });
};
