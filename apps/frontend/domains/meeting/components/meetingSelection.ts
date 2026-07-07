export function pruneSelectionToVisible(
  selectedIds: Set<string>,
  visibleIds: string[],
): Set<string> {
  if (selectedIds.size === 0) {
    return selectedIds;
  }

  const visibleSet = new Set(visibleIds);
  let changed = false;
  const next = new Set<string>();

  selectedIds.forEach((id) => {
    if (visibleSet.has(id)) {
      next.add(id);
      return;
    }
    changed = true;
  });

  return changed ? next : selectedIds;
}

export function areAllVisibleMeetingsSelected(
  selectedIds: Set<string>,
  visibleIds: string[],
): boolean {
  if (visibleIds.length === 0) {
    return false;
  }

  return visibleIds.every((id) => selectedIds.has(id));
}
