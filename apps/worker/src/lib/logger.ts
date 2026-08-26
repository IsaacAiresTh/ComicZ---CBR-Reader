type Level = 'info' | 'warn' | 'error';

function emit(level: Level, scope: string, message: string, extra?: unknown): void {
  const stamp = new Date().toISOString().slice(11, 19);
  const line = `${stamp} [${scope}] ${message}`;
  if (level === 'error') console.error(line, extra ?? '');
  else if (level === 'warn') console.warn(line, extra ?? '');
  else console.log(line, extra ?? '');
}

export function createLogger(scope: string) {
  return {
    info: (message: string, extra?: unknown) => emit('info', scope, message, extra),
    warn: (message: string, extra?: unknown) => emit('warn', scope, message, extra),
    error: (message: string, extra?: unknown) => emit('error', scope, message, extra),
  };
}
