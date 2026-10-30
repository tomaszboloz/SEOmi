import { readJsonStorage, removeStorage, writeJsonStorage } from '@/services/storage';
import { checkBusinessGoal, type GoalCheck } from '@/services/siteFocus/businessGoal';
import { notifyFocusConfigChanged } from './configEvents';
import { focusGoalKey, validFocusProject } from './keys';

/** The saved per-project business goal (#82); a stored value that no longer validates reads as none. */
export const readBusinessGoal = (projectId: string | null | undefined): string | undefined => {
  if (!validFocusProject(projectId)) return undefined;
  const checked = checkBusinessGoal(readJsonStorage(focusGoalKey(projectId), null));
  return checked.ok ? checked.value : undefined;
};

/**
 * Saves the goal after validation. Empty input clears it so the topic falls back to anchors or
 * detection; invalid input is rejected and the stored goal is left unchanged.
 */
export const writeBusinessGoal = (projectId: string, input: string | null | undefined): GoalCheck | { ok: true; value: '' } => {
  if ((input ?? '').trim() === '') {
    if (validFocusProject(projectId)) { removeStorage(focusGoalKey(projectId)); notifyFocusConfigChanged(projectId); }
    return { ok: true, value: '' };
  }
  const checked = checkBusinessGoal(input);
  if (checked.ok && validFocusProject(projectId)) { writeJsonStorage(focusGoalKey(projectId), checked.value); notifyFocusConfigChanged(projectId); }
  return checked;
};
