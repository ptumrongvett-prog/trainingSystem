/**
 * topicMap.ts — Topic ID → metadata mapping.
 * Names are placeholders until the user populates them.
 */

import type { TopicMeta } from '../types';

/**
 * Registry of known topics.
 * TopicID → metadata. Add names here as they become available.
 */
const TOPIC_REGISTRY: Record<string, TopicMeta> = {
  RMKT00001: { name: '', category: 'General', requiredBy: ['all'], frequency: 'annual' },
  RMKT00002: { name: '', category: 'General', requiredBy: ['all'], frequency: 'annual' },
  RMKT00003: { name: '', category: 'General', requiredBy: ['all'], frequency: 'annual' },
  RMKT00004: { name: '', category: 'General', requiredBy: ['all'], frequency: 'annual' },
  RMKT00005: { name: '', category: 'General', requiredBy: ['all'], frequency: 'annual' },
  RMKT00006: { name: '', category: 'General', requiredBy: ['all'], frequency: 'annual' },
  RMKT00010: { name: '', category: 'General', requiredBy: ['all'], frequency: 'annual' },
};

/** Get display name for a topic. Shows "(Name missing)" if not mapped. */
export function getTopicName(topicId: string): string {
  const meta = TOPIC_REGISTRY[topicId];
  if (meta && meta.name) return meta.name;
  return topicId;
}

/** Check if a topic name is missing */
export function isTopicNameMissing(topicId: string): boolean {
  const meta = TOPIC_REGISTRY[topicId];
  return !meta || !meta.name;
}

/** Get full topic metadata */
export function getTopicMeta(topicId: string): TopicMeta | null {
  return TOPIC_REGISTRY[topicId] || null;
}

/** Get topic category */
export function getTopicCategory(topicId: string): string {
  return TOPIC_REGISTRY[topicId]?.category || 'Uncategorized';
}

/** Check if a topic is required for a given department */
export function isTopicRequiredFor(topicId: string, department: string): boolean {
  const meta = TOPIC_REGISTRY[topicId];
  if (!meta) return false;
  if (meta.requiredBy.includes('all')) return true;
  return meta.requiredBy.some(d => d.toLowerCase() === department.toLowerCase());
}

/** Get all topics required for a department */
export function getRequiredTopicsForDept(department: string): string[] {
  return Object.entries(TOPIC_REGISTRY)
    .filter(([, meta]) =>
      meta.requiredBy.includes('all') ||
      meta.requiredBy.some(d => d.toLowerCase() === department.toLowerCase())
    )
    .map(([id]) => id);
}

/** Get all known topic IDs */
export function getAllTopicIds(): string[] {
  return Object.keys(TOPIC_REGISTRY);
}

/** Dynamically discover topics from assignments data */
export function discoverTopics(assignments: { TopicID: string }[]): string[] {
  const seen = new Set<string>();
  for (const a of assignments) {
    if (a.TopicID) seen.add(a.TopicID);
  }
  return Array.from(seen).sort();
}

/** Register or update a topic in the registry (runtime) */
export function registerTopic(topicId: string, meta: Partial<TopicMeta>): void {
  const existing = TOPIC_REGISTRY[topicId] || { name: '', category: 'Uncategorized', requiredBy: ['all'], frequency: 'annual' };
  TOPIC_REGISTRY[topicId] = { ...existing, ...meta };
}
