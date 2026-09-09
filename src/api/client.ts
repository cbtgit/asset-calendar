import PocketBase from "pocketbase";

function applicationOrigin(): string {
  return typeof window === "undefined" ? "http://127.0.0.1:8090" : window.location.origin;
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | undefined;

function isAuthenticationEndpoint(response: Response): boolean {
  if (!response.url) return false;

  const pathname = new URL(response.url).pathname;
  return (
    /\/api\/collections\/[^/]+\/auth-(?:with-password|refresh)$/.test(pathname) ||
    pathname === "/api/invitations/setup"
  );
}

export const pocketbase = new PocketBase(applicationOrigin());

pocketbase.afterSend = (response, data) => {
  if ((response.status === 401 || response.status === 403) && !isAuthenticationEndpoint(response)) {
    unauthorizedHandler?.();
  }

  return data;
};

export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  unauthorizedHandler = handler;
}
