export const healthKeys = {
  all: ["health"] as const,
  check: () => [...healthKeys.all, "check"] as const,
};

export const integrationRecordKeys = {
  all: ["integration-record"] as const,
  current: () => [...integrationRecordKeys.all, "current"] as const,
};

export const groupsKeys = {
  all: ["groups"] as const,
  list: () => [...groupsKeys.all, "list"] as const,
  detail: (id: string) => [...groupsKeys.all, "detail", id] as const,
};

export const tenantSettingsKeys = {
  all: ["tenant-settings"] as const,
  current: () => [...tenantSettingsKeys.all, "current"] as const,
};

export const resourcesKeys = {
  all: ["resources"] as const,
  list: () => [...resourcesKeys.all, "list"] as const,
  active: () => [...resourcesKeys.all, "active"] as const,
  detail: (id: string) => [...resourcesKeys.all, "detail", id] as const,
};

export const bookingTypesKeys = {
  all: ["booking-types"] as const,
  list: () => [...bookingTypesKeys.all, "list"] as const,
  selection: () => [...bookingTypesKeys.all, "selection"] as const,
  detail: (id: string) => [...bookingTypesKeys.all, "detail", id] as const,
};
