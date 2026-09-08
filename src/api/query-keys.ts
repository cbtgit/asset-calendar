export const healthKeys = {
  all: ["health"] as const,
  check: () => [...healthKeys.all, "check"] as const,
};

export const integrationRecordKeys = {
  all: ["integration-record"] as const,
  current: () => [...integrationRecordKeys.all, "current"] as const,
};
