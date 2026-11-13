/**
 * Step cards in a scripted reply (ivy-docs T12, SCR-IVY-14, Figma 1006:5990).
 *
 * The affiliate answer is plain text a tenant edits in AI Settings — numbered
 * lines `1. **Title** — text` between an opening and a closing line. Read as
 * text (console history, a transcript) it is an ordinary list; in the widget
 * those lines become the design's tinted step cards and the lines around them
 * stay chat bubbles. Only scripted turns are split (the caller decides): an AI
 * answer that happens to number its points keeps its usual list.
 */
export interface ScriptStep {
  title: string;
  /** May be empty: a step can be a title alone. */
  text: string;
}

export interface ScriptSteps {
  /** Bubble before the cards; may be empty. */
  before: string;
  steps: ScriptStep[];
  /** Bubble after the cards; may be empty. */
  after: string;
}

const STEP_LINE = /^\s*\d{1,2}[.)]\s+(\S.*?)\s*$/;
// `**Title** — text`; the dash may be an em/en dash, a hyphen or a colon.
const BOLD_LEAD = /^\*\*(.+?)\*\*\s*(?:[—–:-]\s*)?(.*)$/;
// No bold: split on the first spaced dash ("Title — text"), never inside "1–3".
const SPACED_DASH = /\s[—–-]\s/;

function toStep(item: string): ScriptStep {
  const bold = BOLD_LEAD.exec(item);
  if (bold) return { title: bold[1].trim(), text: bold[2].trim() };
  const dash = SPACED_DASH.exec(item);
  if (dash && dash.index > 0) {
    return { title: item.slice(0, dash.index).trim(), text: item.slice(dash.index + dash[0].length).trim() };
  }
  return { title: item.trim(), text: '' };
}

/**
 * The first run of numbered lines (blank lines between them allowed) as steps,
 * with the text around it. `null` when there is no such run of at least two —
 * one numbered line is a sentence, not a list of steps.
 */
export function splitScriptSteps(body: string): ScriptSteps | null {
  const lines = body.split(/\r?\n/);
  const first = lines.findIndex((l) => STEP_LINE.test(l));
  if (first < 0) return null;
  const steps: ScriptStep[] = [];
  let last = first;
  for (let i = first; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const m = STEP_LINE.exec(lines[i]);
    if (!m) break;
    steps.push(toStep(m[1]));
    last = i;
  }
  if (steps.length < 2) return null;
  return {
    before: lines.slice(0, first).join('\n').trim(),
    steps,
    after: lines.slice(last + 1).join('\n').trim(),
  };
}
