export const logger = {
  info: (obj: Record<string, unknown>, msg: string) =>
    console.log(JSON.stringify({ level: "info", ts: new Date().toISOString(), msg, ...obj })),
  warn: (obj: Record<string, unknown>, msg: string) =>
    console.warn(JSON.stringify({ level: "warn", ts: new Date().toISOString(), msg, ...obj })),
  error: (obj: Record<string, unknown>, msg: string) =>
    console.error(JSON.stringify({ level: "error", ts: new Date().toISOString(), msg, ...obj })),
};
