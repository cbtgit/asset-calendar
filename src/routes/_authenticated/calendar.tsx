import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  return (
    <>
      <p className="eyebrow">Calendar</p>
      <h1>Calendar</h1>
      <p>Calendar content will be available here.</p>
    </>
  );
}
