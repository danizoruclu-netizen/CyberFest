import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { NAV_ITEMS } from "@/components/layout/nav-items";

describe("Navigation", () => {
  it("lists all sections in the intended order", () => {
    expect(NAV_ITEMS.map((i) => i.title)).toEqual([
      "Dashboard",
      "Deepfake Detection",
      "Video Analysis",
      "URL Analysis",
      "Fake News Detection",
      "Full Verification",
      "History",
      "About",
    ]);
  });

  it.each(NAV_ITEMS.map((i) => i.to))("has a page for %s", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).not.toBe(rootRouteId);
  });
});
