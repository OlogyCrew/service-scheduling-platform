import type { Request, Response } from "express";
import { appRouter } from "../routers";
import { createContext } from "./context";

export async function buildSsrPrefetch(req: Request, res: Response) {
  const ctx = await createContext({ req, res, info: {} as never });
  return appRouter.createCaller(ctx);
}
