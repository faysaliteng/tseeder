/**
 * Minimal type-safe router for Cloudflare Workers
 */

type Handler<Env> = (req: Request, env: Env, ctx: RouterContext) => Promise<Response>;
type Middleware<Env> = (req: Request, env: Env, ctx: RouterContext) => Promise<Response | null>;

interface RouterContext {
  params: Record<string, string>;
  query: Record<string, string>;
  user?: { id: string; role: string };
}

export class Router<Env> {
  private routes: Array<{
    method: string;
    pattern: URLPattern;
    rawPath: string;
    middlewares: Middleware<Env>[];
    handler: Handler<Env>;
  }> = [];

  private addRoute(
    method: string,
    path: string,
    middlewares: Middleware<Env>[],
    handler: Handler<Env>,
  ) {
    this.routes.push({
      method,
      pattern: new URLPattern({ pathname: path }),
      rawPath: path,
      middlewares,
      handler,
    });
  }

  get(path: string, middlewares: Middleware<Env>[], handler: Handler<Env>) {
    this.addRoute("GET", path, middlewares, handler);
  }
  post(path: string, middlewares: Middleware<Env>[], handler: Handler<Env>) {
    this.addRoute("POST", path, middlewares, handler);
  }
  patch(path: string, middlewares: Middleware<Env>[], handler: Handler<Env>) {
    this.addRoute("PATCH", path, middlewares, handler);
  }
  delete(path: string, middlewares: Middleware<Env>[], handler: Handler<Env>) {
    this.addRoute("DELETE", path, middlewares, handler);
  }
  all(path: string, middlewares: Middleware<Env>[], handler: Handler<Env>) {
    this.addRoute("*", path, middlewares, handler);
  }

  async handle(req: Request, env: Env, execCtx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    for (const route of this.routes) {
      if (route.method !== "*" && route.method !== req.method) continue;

      const match = route.pattern.exec(url);
      if (!match) continue;

      const ctx: RouterContext = {
        params: (match.pathname.groups as Record<string, string>) ?? {},
        query: Object.fromEntries(url.searchParams),
      };

      // Run middlewares
      for (const mw of route.middlewares) {
        const result = await mw(req, env, ctx);
        if (result) return result; // middleware short-circuited
      }

      return route.handler(req, env, ctx);
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  }
}
