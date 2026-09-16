onRecordsListRequest((event) => require(`${__hooks}/record-access.cjs`).checkRecords(event));
onRecordViewRequest((event) => require(`${__hooks}/record-access.cjs`).checkRecords(event));
onRecordDeleteRequest((event) => require(`${__hooks}/record-access.cjs`).deleteRecord(event));
onRecordCreateRequest((event) => require(`${__hooks}/record-access.cjs`).createRecord(event));
onRecordUpdateRequest((event) => require(`${__hooks}/record-access.cjs`).updateRecord(event));
onRecordAuthRequest((event) => require(`${__hooks}/record-access.cjs`).rejectInactive(event));
onRecordAuthWithPasswordRequest((event) =>
  require(`${__hooks}/record-access.cjs`).rejectInactive(event),
);
onRecordAuthRefreshRequest((event) =>
  require(`${__hooks}/record-access.cjs`).rejectInactive(event),
);
routerAdd("GET", "/api/groups", (event) =>
  require(`${__hooks}/record-access.cjs`).groupsProjectionRoute(event),
);
routerAdd("GET", "/api/groups/{id}", (event) =>
  require(`${__hooks}/record-access.cjs`).groupsProjectionRoute(event),
);
routerAdd("GET", "/api/calendar/resources", (event) =>
  require(`${__hooks}/record-access.cjs`).calendarResourcesRoute(event),
);
routerAdd("GET", "/api/calendar/bookings", (event) =>
  require(`${__hooks}/record-access.cjs`).calendarBookingsRoute(event),
);
routerAdd("POST", "/api/calendar/bookings", (event) =>
  require(`${__hooks}/record-access.cjs`).calendarBookingCreateRoute(event),
);
routerAdd("GET", "/api/calendar/bookings/{id}", (event) =>
  require(`${__hooks}/record-access.cjs`).calendarBookingDetailRoute(event),
);
routerAdd("PATCH", "/api/calendar/bookings/{id}", (event) =>
  require(`${__hooks}/record-access.cjs`).calendarBookingUpdateRoute(event),
);
routerAdd("DELETE", "/api/calendar/bookings/{id}", (event) =>
  require(`${__hooks}/record-access.cjs`).calendarBookingDeleteRoute(event),
);
