import { afterEach, expect, it, vi } from "vite-plus/test";
import { pocketbase } from "./client";
import { downloadBillingCsv, searchBilling } from "./billing";

afterEach(() => {
  pocketbase.authStore.clear();
  vi.restoreAllMocks();
});

function saveAdministrator() {
  pocketbase.authStore.save("token", {
    id: "admin-1",
    collectionId: "users",
    collectionName: "users",
    email: "admin@example.test",
    role: "administrator",
  });
}

const interval = {
  start: "2026-09-01",
  end: "2026-10-01",
};

it("searches the server-generated billing preview with only the selected interval", async () => {
  saveAdministrator();
  const preview = { start: interval.start, end: interval.end, groups: [], total: "0.00" };
  const send = vi.spyOn(pocketbase, "send").mockResolvedValue(preview as never);

  await expect(searchBilling(interval)).resolves.toEqual(preview);
  expect(send).toHaveBeenCalledWith("/api/billing/export?start=2026-09-01&end=2026-10-01", {
    method: "GET",
  });
});

it("requests the CSV representation separately for the selected interval", async () => {
  saveAdministrator();
  const csv = new Blob(["start,end\r\n"]);
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(csv, { status: 200, headers: { "content-type": "text/csv" } }));

  const downloaded = await downloadBillingCsv(interval);
  expect(downloaded.type).toBe("text/csv");
  await expect(downloaded.text()).resolves.toBe("start,end\r\n");
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/api/billing/export?start=2026-09-01&end=2026-10-01&format=csv"),
    { headers: { Authorization: "token" } },
  );
});
