// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import PocketBase from "pocketbase";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, expect, it } from "vite-plus/test";
import { getIntegrationRecord, updateIntegrationRecord } from "../../src/api/integration-record";
import { pocketbase } from "../../src/api/client";
import {
  useIntegrationRecordQuery,
  useUpdateIntegrationRecordMutation,
} from "../../src/hooks/use-integration-record";
import {
  startPocketBaseIntegrationHarness,
  type PocketBaseIntegrationHarness,
} from "./pocketbase-harness";

let harness: PocketBaseIntegrationHarness;
let originalBaseUrl: string;

function IntegrationProbe() {
  const record = useIntegrationRecordQuery();
  const update = useUpdateIntegrationRecordMutation();

  if (record.isPending) return <p role="status">Loading integration record…</p>;
  if (record.isError) return <p role="alert">Unable to load: {record.error.message}</p>;

  return (
    <>
      <p data-testid="record-title">{record.data.title}</p>
      <button
        type="button"
        onClick={() =>
          update.mutate({
            id: record.data.id,
            update: { title: "Updated integration record" },
          })
        }
      >
        Update record
      </button>
      {update.isError ? <p role="alert">Unable to update: {update.error.message}</p> : null}
    </>
  );
}

function renderProbe() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const route = createRootRoute({ component: IntegrationProbe });
  const router = createRouter({ routeTree: route });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeAll(async () => {
  originalBaseUrl = pocketbase.baseURL;
  harness = await startPocketBaseIntegrationHarness();
  pocketbase.baseURL = harness.baseUrl;
});

afterEach(() => {
  cleanup();
});

afterAll(async () => {
  pocketbase.baseURL = originalBaseUrl;
  if (harness) await harness.stop();
});

it("queries, mutates, and renders the cache-backed PocketBase result", async () => {
  renderProbe();
  await waitFor(() =>
    expect(screen.getByTestId("record-title").textContent).toBe("Initial integration record"),
  );

  fireEvent.click(screen.getByRole("button", { name: "Update record" }));
  await waitFor(() =>
    expect(screen.getByTestId("record-title").textContent).toBe("Updated integration record"),
  );

  const stored = await new PocketBase(harness.baseUrl)
    .collection<{ title: string }>("integration_records")
    .getFirstListItem("");
  expect(stored.title).toBe("Updated integration record");
});

it("normalizes a representative PocketBase validation failure", async () => {
  const record = await getIntegrationRecord();

  await expect(updateIntegrationRecord(record.id, { title: "" })).rejects.toMatchObject({
    kind: "validation",
    cause: expect.anything(),
  });
});
