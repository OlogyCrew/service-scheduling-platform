import type { QueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc";

export type HeadMeta = {
  title: string;
  description: string;
  canonicalPath: string;
  noindex?: boolean;
  notFound?: boolean;
};

type Caller = {
  category: { getBySlug: (input: { slug: string }) => Promise<any>; getById: (input: { id: number }) => Promise<any> };
  service: { getById: (input: { id: number }) => Promise<any>; listByCategory: (input: { categoryId: number }) => Promise<any> };
  provider: { getBySlug: (input: { slug: string }) => Promise<any>; getById: (input: { id: number }) => Promise<any>; listByCategory: (input: { categoryId: number }) => Promise<any> };
  promotion: { getActiveForDisplay: () => Promise<any> };
};

const base: HeadMeta = { title: "OlogyCrew — Local work, well done", description: "Find independent local professionals on OlogyCrew. Explore services, compare providers, and book directly.", canonicalPath: "/" };
const key = (proc: any, input?: any) => getQueryKey(proc, input, "query");
const set = (qc: QueryClient, proc: any, input: any, data: unknown) => qc.setQueryData(key(proc, input), data);
const pathPart = (url: string) => url.split("?")[0].replace(/\/+$/, "") || "/";
const safe = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value.trim() : fallback;

export async function prefetchForPath(url: string, queryClient: QueryClient, caller: Caller): Promise<HeadMeta> {
  const path = pathPart(url);
  const categoryMatch = path.match(/^\/category\/([^/]+)$/);
  if (categoryMatch) {
    const slug = decodeURIComponent(categoryMatch[1]);
    const category = await caller.category.getBySlug({ slug });
    set(queryClient, trpc.category.getBySlug, { slug }, category);
    if (!category) return { ...base, canonicalPath: path, noindex: true, notFound: true };
    const input = { categoryId: category.id };
    const [services, providers, promotions] = await Promise.all([
      caller.service.listByCategory(input), caller.provider.listByCategory(input), caller.promotion.getActiveForDisplay(),
    ]);
    set(queryClient, trpc.service.listByCategory, input, services);
    set(queryClient, trpc.provider.listByCategory, input, providers);
    set(queryClient, trpc.promotion.getActiveForDisplay, undefined, promotions);
    const name = safe(category.name, "Service category");
    return { title: `${name} Services | OlogyCrew`, description: `Explore ${name.toLowerCase()} services from independent local professionals on OlogyCrew.`, canonicalPath: path };
  }

  const serviceMatch = path.match(/^\/service\/(\d+)$/);
  if (serviceMatch) {
    const id = Number(serviceMatch[1]);
    const service = await caller.service.getById({ id });
    set(queryClient, trpc.service.getById, { id }, service);
    if (!service) return { ...base, canonicalPath: path, noindex: true, notFound: true };
    const providerInput = { id: service.providerId };
    const provider = await caller.provider.getById(providerInput);
    set(queryClient, trpc.provider.getById, providerInput, provider);
    if (service.categoryId) {
      const categoryInput = { id: service.categoryId };
      const category = await caller.category.getById(categoryInput);
      set(queryClient, trpc.category.getById, categoryInput, category);
    }
    const name = safe(service.name, "Service");
    return { title: `${name} | OlogyCrew`, description: safe(service.description, `Book ${name.toLowerCase()} from a trusted local professional on OlogyCrew.`), canonicalPath: path };
  }

  const providerMatch = path.match(/^(?:\/p\/|\/)([^/]+)$/);
  if (providerMatch && !["browse", "experiences", "featured", "help", "privacy", "terms", "pricing", "platform", "for-providers"].includes(providerMatch[1])) {
    const slug = decodeURIComponent(providerMatch[1]);
    try {
      const provider = await caller.provider.getBySlug({ slug });
      set(queryClient, trpc.provider.getBySlug, { slug }, provider);
      if (!provider) return { ...base, canonicalPath: path, noindex: true, notFound: true };
      const publicProvider = provider.provider || provider;
      const name = safe(publicProvider.businessName || publicProvider.displayName || publicProvider.name, "Local professional");
      return { title: `${name} | OlogyCrew`, description: safe(publicProvider.bio || publicProvider.description, `Explore ${name}'s services, profile, and availability on OlogyCrew.`), canonicalPath: path };
    } catch (error) {
      if ((error instanceof TRPCClientError && error.data?.code === "NOT_FOUND") || (error as any)?.code === "NOT_FOUND") return { ...base, canonicalPath: path, noindex: true, notFound: true };
      throw error;
    }
  }
  return { ...base, canonicalPath: path, noindex: path.startsWith("/admin") || path.startsWith("/provider/") || path.startsWith("/my-") };
}
