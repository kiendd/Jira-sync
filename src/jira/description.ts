export const descriptionHasLink = (
  description: string | null | undefined,
  link: string
): boolean => {
  if (typeof description !== 'string' || !link) {
    return false;
  }
  return description.includes(link);
};

export const descriptionHasIssueLinkForProject = (
  description: string | null | undefined,
  projectKey: string
): boolean => {
  if (typeof description !== 'string' || !projectKey) {
    return false;
  }
  const escapedProjectKey = projectKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `Link:\\s*https?://[^\\s]+/browse/${escapedProjectKey}-\\d+`,
    'i'
  );
  return pattern.test(description);
};

export const appendLinkToDescription = (
  description: string | null | undefined,
  link: string
): string => {
  const current = typeof description === 'string' ? description : '';
  if (descriptionHasLink(current, link)) {
    return current;
  }

  const trimmed = current.trimEnd();
  const linkLine = `Link: ${link}`;
  return trimmed ? `${trimmed}\n\n${linkLine}` : linkLine;
};
