import { SyncRule, SyncFlowConfigDoc } from '../db/models.js';
import { ProjectType, StatusChange } from './issue-state-tracker.js';

export interface MatchedRule {
  rule: SyncRule;
  statusChange: StatusChange;
}

const normalizeStatus = (status: string | null | undefined): string => {
  if (status === null || status === undefined) return '';
  return typeof status === 'string' ? status.trim() : '';
};

const matchesDirection = (
  ruleDirection: string,
  projectType: ProjectType
): boolean => {
  if (ruleDirection === 'both') return true;
  if (projectType === 'user' && ruleDirection === 'user_to_dev') return true;
  if (projectType === 'dev' && ruleDirection === 'dev_to_user') return true;
  return false;
};

const matchRule = (rule: SyncRule, statusChange: StatusChange): boolean => {
  if (!rule.enabled) return false;

  const sourceStatus = normalizeStatus(rule.sourceStatus);
  const toStatus = normalizeStatus(statusChange.toStatus);

  if (sourceStatus === '*') {
    return matchesDirection(rule.syncDirection, statusChange.projectType);
  }

  const statusMatches = sourceStatus === toStatus;
  if (!statusMatches) return false;

  return matchesDirection(rule.syncDirection, statusChange.projectType);
};

export const findMatchingRuleForStatusChange = (
  statusChange: StatusChange,
  rules: SyncRule[]
): SyncRule | null => {
  const sortedRules = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  for (const rule of sortedRules) {
    if (matchRule(rule, statusChange)) {
      return rule;
    }
  }

  return null;
};

export const matchStatusChangesToRules = (
  statusChanges: StatusChange[],
  config: SyncFlowConfigDoc
): MatchedRule[] => {
  const matched: MatchedRule[] = [];
  const unmatched: StatusChange[] = [];

  for (const change of statusChanges) {
    const rule = findMatchingRuleForStatusChange(change, config.rules);
    if (rule) {
      matched.push({ rule, statusChange: change });
    } else {
      unmatched.push(change);
    }
  }

  if (unmatched.length > 0) {
    const fallbackBehavior = config.defaultBehavior?.fallbackBehavior ?? 'ignore';
    if (fallbackBehavior !== 'ignore') {
      console.log(
        `[StatusChangeMatcher] Unmatched status changes with fallback behavior "${fallbackBehavior}":`,
        unmatched.map((c) => `${c.projectType}/${c.issueKey}: ${c.fromStatus} -> ${c.toStatus}`)
      );
    }
  }

  return matched;
};
