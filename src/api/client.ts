import PocketBase from "pocketbase";

function applicationOrigin(): string {
  return typeof window === "undefined" ? "http://127.0.0.1:8090" : window.location.origin;
}

export const pocketbase = new PocketBase(applicationOrigin());
