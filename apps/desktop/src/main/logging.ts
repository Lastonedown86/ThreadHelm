/**
 * Structured, sanitized lifecycle logging (T028).
 *
 * Fixed event names, enum/number/boolean fields, and short strings only.
 * Anything that looks like a secret, control sequence, or free text is
 * redacted before it reaches a sink. Terminal bytes, prompts, environment
 * values, and probe output never come through here by design — callers pass
 * counts and codes, not content.
 */

export type LogValue = string | number | boolean | null | undefined;
export type LogFields = Record<string, LogValue>;

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export interface LogSink {
  write(line: string): void;
}

const EVENT_NAME = /^[a-z][a-z0-9_.]{1,80}$/;
const MAX_STRING = 200;
// Conservative: anything token-shaped is dropped, false positives are fine.
const SECRET_SHAPED =
  /(sk-[A-Za-z0-9_-]{8,}|ghp_|gho_|github_pat_|AKIA[0-9A-Z]{16}|xox[baprs]-|Bearer\s+\S+|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|[A-Fa-f0-9]{32,}|[A-Za-z0-9+/=]{40,})/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

export function sanitizeLogValue(value: LogValue): LogValue {
  if (typeof value !== 'string') return value;
  if (value.length > MAX_STRING || CONTROL_CHARS.test(value) || SECRET_SHAPED.test(value)) {
    return '[redacted]';
  }
  return value;
}

export function createLogger(sink: LogSink, base: LogFields = {}, now = () => new Date()): Logger {
  const emit = (level: 'info' | 'warn' | 'error', event: string, fields: LogFields = {}) => {
    const name = EVENT_NAME.test(event) ? event : 'log.invalid_event_name';
    const record: Record<string, LogValue> = { ts: now().toISOString(), level, event: name };
    for (const [key, value] of Object.entries({ ...base, ...fields })) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(key)) continue;
      record[key] = sanitizeLogValue(value);
    }
    sink.write(JSON.stringify(record));
  };
  return {
    info: (event, fields) => emit('info', event, fields),
    warn: (event, fields) => emit('warn', event, fields),
    error: (event, fields) => emit('error', event, fields),
    child: (fields) => createLogger(sink, { ...base, ...fields }, now),
  };
}

export const stderrSink: LogSink = {
  write(line) {
    process.stderr.write(`${line}\n`);
  },
};

export function multiSink(...sinks: LogSink[]): LogSink {
  return {
    write(line) {
      for (const sink of sinks) {
        try {
          sink.write(line);
        } catch {
          /* a failing sink must never take the coordinator down */
        }
      }
    },
  };
}
