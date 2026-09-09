onRecordsListRequest((event) => require(`${__hooks}/record-access.cjs`).checkRecords(event));
onRecordViewRequest((event) => require(`${__hooks}/record-access.cjs`).checkRecords(event));
onRecordDeleteRequest((event) => require(`${__hooks}/record-access.cjs`).checkRecords(event));
onRecordCreateRequest((event) => require(`${__hooks}/record-access.cjs`).createRecord(event));
onRecordUpdateRequest((event) => require(`${__hooks}/record-access.cjs`).updateRecord(event));
onRecordAuthRequest((event) => require(`${__hooks}/record-access.cjs`).rejectInactive(event));
onRecordAuthWithPasswordRequest((event) =>
  require(`${__hooks}/record-access.cjs`).rejectInactive(event),
);
onRecordAuthRefreshRequest((event) =>
  require(`${__hooks}/record-access.cjs`).rejectInactive(event),
);
