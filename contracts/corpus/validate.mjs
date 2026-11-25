#!/usr/bin/env node
/**
 * Dependency-free validator for contracts/corpus/.
 *
 * Usage: node contracts/corpus/validate.mjs
 *
 * Checks:
 *  - unique message ids across the whole corpus
 *  - strict ISO-8601 UTC timestamps that parse and never go backwards
 *  - valid channels, directions and scam/benign labels
 *  - expectedTactics only use ids from contracts/tactics.json, with no duplicates
 *  - index.json matches every arc file (id, file, label, contact, channel, count, span)
 *  - every arc file is listed in the index and has 40–80 messages
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const corpusDir = dirname(fileURLToPath(import.meta.url));
const contractsDir = resolve(corpusDir, '..');
const DAY_MS = 86_400_000;

const CHANNELS = new Set(['gmail', 'whatsapp', 'messenger', 'sms', 'telegram']);
const LABELS = new Set(['scam', 'benign']);
const DIRECTION = new Set(['in', 'out']);
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

let tactics;
let index;
try {
  tactics = readJson(join(contractsDir, 'tactics.json'));
  index = readJson(join(corpusDir, 'index.json'));
} catch (error) {
  console.error(`Cannot read contracts: ${error.message}`);
  process.exit(1);
}

const tacticIds = tactics.tactics.map((tactic) => tactic.id);
const knownTactics = new Set(tacticIds);
const tacticOrder = new Map(tacticIds.map((id, i) => [id, i]));

check(index.version === 1, 'index.json: version must be 1');
check(index.tacticsVersion === tactics.version, `index.json: tacticsVersion must match tactics.json (${tactics.version})`);
check(Array.isArray(index.arcs) && index.arcs.length > 0, 'index.json: arcs must be a non-empty array');

const seenMessageIds = new Map();
const seenArcIds = new Set();
const seenFiles = new Set();
const indexedFiles = new Set();
const summaries = [];

function validateArc(entry) {
  const where = `index.json[${entry?.id ?? '?'}]`;
  check(nonEmptyString(entry?.id), `${where}: missing id`);
  check(nonEmptyString(entry?.file), `${where}: missing file`);
  check(LABELS.has(entry?.label), `${where}: label must be scam or benign`);
  check(nonEmptyString(entry?.contactHandle), `${where}: missing contactHandle`);
  check(CHANNELS.has(entry?.channel), `${where}: invalid channel ${entry?.channel}`);
  check(Number.isInteger(entry?.messageCount), `${where}: messageCount must be an integer`);
  check(Number.isInteger(entry?.spanDays), `${where}: spanDays must be an integer`);

  if (!nonEmptyString(entry?.id) || !nonEmptyString(entry?.file)) return;

  check(!seenArcIds.has(entry.id), `${where}: duplicate arc id`);
  seenArcIds.add(entry.id);
  check(!seenFiles.has(entry.file), `${where}: duplicate file ${entry.file}`);
  seenFiles.add(entry.file);
  check(entry.file === `${entry.id}.json`, `${where}: file must be ${entry.id}.json`);
  indexedFiles.add(entry.file);

  let arcFile;
  try {
    arcFile = readJson(join(corpusDir, entry.file));
  } catch (error) {
    errors.push(`${where}: cannot read ${entry.file}: ${error.message}`);
    return;
  }

  const arc = arcFile.arc;
  const messages = arcFile.messages;
  check(arc && typeof arc === 'object', `${where}: missing arc block`);
  if (!arc || typeof arc !== 'object') return;

  check(arc.id === entry.id, `${where}: arc.id ${arc.id} does not match index`);
  check(arc.label === entry.label, `${where}: arc.label ${arc.label} does not match index`);
  check(LABELS.has(arc.label), `${where}: label must be scam or benign`);
  check(nonEmptyString(arc.description), `${where}: missing description`);
  check(nonEmptyString(arc.contactHandle), `${where}: missing contactHandle`);
  check(arc.contactHandle === entry.contactHandle, `${where}: contactHandle does not match index`);
  check(CHANNELS.has(arc.channel), `${where}: invalid channel ${arc.channel}`);
  check(arc.channel === entry.channel, `${where}: channel does not match index`);

  check(Array.isArray(messages), `${where}: messages must be an array`);
  if (!Array.isArray(messages)) return;
  check(messages.length >= 40 && messages.length <= 80, `${where}: must have 40-80 messages, got ${messages.length}`);
  check(messages.length === entry.messageCount, `${where}: messageCount ${entry.messageCount} does not match ${messages.length}`);

  const counts = new Map(tacticIds.map((id) => [id, 0]));
  let labelledMessages = 0;
  let labelOccurrences = 0;
  let previousMs = -Infinity;

  messages.forEach((message, i) => {
    const at = `${where}.messages[${i}]${message?.id ? ` (${message.id})` : ''}`;

    check(nonEmptyString(message?.id), `${at}: missing id`);
    check(nonEmptyString(message?.timestamp), `${at}: missing timestamp`);
    check(ISO_UTC.test(message?.timestamp ?? ''), `${at}: timestamp must be strict ISO-8601 UTC (YYYY-MM-DDTHH:MM:SSZ)`);
    check(CHANNELS.has(message?.channel), `${at}: invalid channel ${message?.channel}`);
    check(nonEmptyString(message?.senderHandle), `${at}: missing senderHandle`);
    check(DIRECTION.has(message?.direction), `${at}: direction must be in or out`);
    check(nonEmptyString(message?.text), `${at}: missing text`);
    check(nonEmptyString(message?.note), `${at}: missing note`);
    check(Array.isArray(message?.expectedTactics), `${at}: expectedTactics must be an array`);

    if (nonEmptyString(message?.id)) {
      if (seenMessageIds.has(message.id)) {
        errors.push(`${at}: duplicate message id (also in ${seenMessageIds.get(message.id)})`);
      } else {
        seenMessageIds.set(message.id, `${entry.file}[${i}]`);
      }
    }

    if (nonEmptyString(message?.timestamp) && ISO_UTC.test(message.timestamp)) {
      const ms = Date.parse(message.timestamp);
      check(Number.isFinite(ms), `${at}: unparseable timestamp ${message.timestamp}`);
      if (Number.isFinite(ms)) {
        check(ms >= previousMs, `${at}: timestamp goes backwards (${message.timestamp})`);
        previousMs = ms;
      }
    }

    if (Array.isArray(message?.expectedTactics)) {
      const seen = new Set();
      message.expectedTactics.forEach((id, j) => {
        check(nonEmptyString(id), `${at}: expectedTactics[${j}] must be a string`);
        check(knownTactics.has(id), `${at}: unknown tactic ${id}`);
        if (seen.has(id)) errors.push(`${at}: duplicate tactic ${id}`);
        seen.add(id);

        const previous = message.expectedTactics[j - 1];
        if (j > 0 && knownTactics.has(previous) && knownTactics.has(id)) {
          check(tacticOrder.get(previous) < tacticOrder.get(id), `${at}: expectedTactics must follow tactics.json order`);
        }
      });
      if (message.expectedTactics.length > 0) labelledMessages += 1;
      labelOccurrences += message.expectedTactics.length;
      for (const id of message.expectedTactics) {
        if (counts.has(id)) counts.set(id, counts.get(id) + 1);
      }
    }
  });

  if (messages.length > 0) {
    const first = Date.parse(messages[0].timestamp);
    const last = Date.parse(messages[messages.length - 1].timestamp);
    if (Number.isFinite(first) && Number.isFinite(last)) {
      // Inclusive: a conversation whose first and last message are 20 days apart
      // spans 21 calendar days.
      const spanDays = Math.floor((last - first) / DAY_MS) + 1;
      check(spanDays === entry.spanDays, `${where}: spanDays ${entry.spanDays} does not match ${spanDays}`);
    }
  }

  summaries.push({
    id: entry.id,
    label: entry.label,
    messages: messages.length,
    labelledMessages,
    labelOccurrences,
    counts,
  });
}

if (Array.isArray(index.arcs)) {
  for (const entry of index.arcs) validateArc(entry);
}

// Every arc JSON in the directory must be indexed (index.json is the manifest).
const arcFilesOnDisk = readdirSync(corpusDir)
  .filter((file) => file.endsWith('.json') && file !== 'index.json')
  .sort();
for (const file of arcFilesOnDisk) {
  check(indexedFiles.has(file), `index.json: ${file} exists but is not listed`);
}

if (errors.length > 0) {
  console.error(`Corpus validation FAILED with ${errors.length} error(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`Corpus OK: ${summaries.length} arc(s), ${seenMessageIds.size} messages`);
for (const summary of summaries) {
  console.log(
    `  ${summary.id}: ${summary.label}, ${summary.messages} messages, ` +
      `${summary.labelledMessages} with tactics, ${summary.labelOccurrences} label occurrence(s)`,
  );
  for (const id of tacticIds) {
    const count = summary.counts.get(id);
    if (count > 0) console.log(`    ${id}: ${count}`);
  }
}
