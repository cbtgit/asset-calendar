import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import luxon3Plugin from "@fullcalendar/luxon3";
import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import daLocale from "@fullcalendar/core/locales/da";
import { useNavigate } from "@tanstack/react-router";
import { isAdministrator } from "@/api/auth";
import type { CalendarBooking } from "@/api/bookings";
import { BookingDetail } from "@/components/calendar/booking-detail";
import { BookingForm } from "@/components/calendar/booking-form";
import { useCalendarResourcesQuery } from "@/hooks/use-calendar-resources";
import { useAuth } from "@/hooks/use-auth";
import { useBookingsQuery } from "@/hooks/use-bookings";
import {
  getCalendarSearchFromDatesSet,
  type CalendarSearch,
  type CalendarView,
} from "@/lib/calendar";
import dayjs from "dayjs";
import {
  APPLICATION_TIME_ZONE,
  applicationDateTimeToUtc,
  calendarDateStringToApplicationDateTime,
  formatApplicationDate,
} from "@/lib/time";
import "./calendar-surface.css";

type CalendarSurfaceProps = {
  search: CalendarSearch;
};

type BookingDraft =
  | { kind: "create"; start?: string; end?: string; date?: string }
  | { kind: "detail"; booking: CalendarBooking };

const MOBILE_QUERY = "(width < 48rem)";
let mobileMediaQuery: MediaQueryList | undefined;

function getMobileMediaQuery() {
  if (typeof window === "undefined") return undefined;
  mobileMediaQuery ??= window.matchMedia(MOBILE_QUERY);
  return mobileMediaQuery;
}

function subscribeToMobileQuery(onChange: () => void) {
  const query = getMobileMediaQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

function getMobileSnapshot() {
  return getMobileMediaQuery()?.matches ?? false;
}

function getDesktopSnapshot() {
  return false;
}

function fallbackRange(date: string, view: CalendarView) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (view === "month" ? 35 : view === "week" ? 7 : 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function CalendarSurface({ search }: CalendarSurfaceProps) {
  const navigate = useNavigate({ from: "/calendar" });
  const auth = useAuth();
  const isMobile = useSyncExternalStore(
    subscribeToMobileQuery,
    getMobileSnapshot,
    getDesktopSnapshot,
  );
  const resources = useCalendarResourcesQuery();
  const activeResources = resources.data ?? [];
  const selectedResource = activeResources.find((resource) => resource.id === search.resource);
  const firstActiveResourceId = activeResources[0]?.id ?? "";
  const effectiveView: CalendarView = isMobile ? "day" : search.view;
  const [visibleRange, setVisibleRange] = useState(() => fallbackRange(search.date, effectiveView));
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const initialView =
    effectiveView === "month"
      ? "dayGridMonth"
      : `timeGrid${effectiveView[0].toUpperCase()}${effectiveView.slice(1)}`;
  const bookings = useBookingsQuery({
    resourceId: selectedResource?.id ?? "",
    start: visibleRange.start,
    end: visibleRange.end,
  });
  const events = useMemo<EventInput[]>(
    () =>
      (bookings.data ?? []).map((booking) => ({
        id: booking.id,
        title: booking.booker_display_name,
        start: booking.start,
        end: booking.end,
        extendedProps: { booking },
      })),
    [bookings.data],
  );

  useEffect(() => {
    if (resources.isPending || resources.isError) return;
    if (search.resource || activeResources.length !== 1) return;

    const nextResource = firstActiveResourceId;
    if (nextResource === search.resource) return;

    void navigate({
      search: (current) => ({ ...current, resource: nextResource }),
      replace: true,
    });
  }, [
    activeResources.length,
    firstActiveResourceId,
    navigate,
    resources.isError,
    resources.isPending,
    search.resource,
  ]);

  useEffect(() => {
    if (isMobile && search.view !== "day") {
      void navigate({
        search: (current) => ({ ...current, view: "day" }),
        replace: true,
      });
    }
  }, [isMobile, navigate, search.view]);

  function updateSearch(changes: Partial<CalendarSearch>) {
    void navigate({
      search: (current) => ({ ...current, ...changes }),
    });
  }

  if (resources.isPending) {
    return <p role="status">Loading calendar resources...</p>;
  }

  if (resources.isError) {
    return <p role="alert">Unable to load calendar resources: {resources.error.message}</p>;
  }

  return (
    <section className="calendar-surface" aria-labelledby="calendar-title">
      <header className="calendar-heading">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1 id="calendar-title">Resource calendar</h1>
        </div>
        <label className="calendar-mobile-resource">
          <span>Resource</span>
          <select
            value={selectedResource?.id ?? ""}
            onChange={(event) => updateSearch({ resource: event.target.value })}
            disabled={activeResources.length === 0}
          >
            <option value="" disabled>
              Select a resource
            </option>
            {activeResources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {activeResources.length === 0 ? (
        <div className="calendar-empty" role="status">
          <strong>No active resources</strong>
          <p>Create an active resource before opening its calendar.</p>
        </div>
      ) : (
        <div className="calendar-layout">
          <aside className="calendar-resource-panel" aria-label="Calendar resources">
            <div className="calendar-resource-panel-heading">
              <span className="calendar-panel-label">Resources</span>
              <span>{activeResources.length}</span>
            </div>
            <div className="calendar-resource-list">
              {activeResources.map((resource) => (
                <button
                  className="calendar-resource-button"
                  data-selected={resource.id === selectedResource?.id ? "true" : undefined}
                  aria-pressed={resource.id === selectedResource?.id}
                  key={resource.id}
                  type="button"
                  onClick={() => updateSearch({ resource: resource.id })}
                >
                  <span>{resource.name}</span>
                  <span aria-hidden="true">{resource.id === selectedResource?.id ? "●" : "○"}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="calendar-frame">
            {selectedResource ? (
              bookingDraft ? (
                bookingDraft.kind === "detail" ? (
                  <BookingDetail
                    booking={bookingDraft.booking}
                    isAdministrator={isAdministrator(auth.user)}
                    onClose={() => setBookingDraft(null)}
                  />
                ) : (
                  <BookingForm
                    resourceId={selectedResource.id}
                    resourceName={selectedResource.name}
                    isAdministrator={isAdministrator(auth.user)}
                    initialStart={bookingDraft.start}
                    initialEnd={bookingDraft.end}
                    initialDate={bookingDraft.date}
                    onCancel={() => setBookingDraft(null)}
                    onSuccess={() => setBookingDraft(null)}
                  />
                )
              ) : (
                <>
                  {bookings.isError ? (
                    <p className="calendar-booking-error" role="alert">
                      Unable to load bookings: {bookings.error.message}
                    </p>
                  ) : null}
                  <FullCalendar
                    key={`${search.date}:${effectiveView}:${selectedResource.id}`}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, luxon3Plugin]}
                    timeZone={APPLICATION_TIME_ZONE}
                    initialDate={search.date}
                    initialView={initialView}
                    firstDay={1}
                    locales={[daLocale]}
                    locale="da"
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: isMobile ? "" : "dayGridMonth,timeGridWeek,timeGridDay",
                    }}
                    buttonText={{ today: "I dag", month: "Måned", week: "Uge", day: "Dag" }}
                    slotDuration="00:15:00"
                    slotLabelInterval="01:00:00"
                    slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                    eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                    allDaySlot={false}
                    nowIndicator
                    editable={false}
                    selectable={false}
                    eventStartEditable={false}
                    eventDurationEditable={false}
                    events={events}
                    dateClick={(click: DateClickArg) => {
                      if (effectiveView === "month" || click.allDay) {
                        setBookingDraft({
                          kind: "create",
                          date: formatApplicationDate(click.date),
                        });
                        return;
                      }
                      const localStart = calendarDateStringToApplicationDateTime(click.dateStr);
                      const localEnd = dayjs
                        .tz(localStart, APPLICATION_TIME_ZONE)
                        .add(1, "hour")
                        .format("YYYY-MM-DDTHH:mm");
                      setBookingDraft({
                        kind: "create",
                        start: applicationDateTimeToUtc(localStart),
                        end: applicationDateTimeToUtc(localEnd),
                      });
                    }}
                    eventClick={(click: EventClickArg) => {
                      const booking = click.event.extendedProps.booking as
                        | CalendarBooking
                        | undefined;
                      if (booking) setBookingDraft({ kind: "detail", booking });
                    }}
                    datesSet={(range: DatesSetArg) => {
                      const nextRange = {
                        start: range.start.toISOString(),
                        end: range.end.toISOString(),
                      };
                      setVisibleRange((current) =>
                        current.start === nextRange.start && current.end === nextRange.end
                          ? current
                          : nextRange,
                      );
                      const nextSearch = getCalendarSearchFromDatesSet(range);
                      if (nextSearch.view !== search.view || nextSearch.date !== search.date) {
                        updateSearch(nextSearch);
                      }
                    }}
                  />
                </>
              )
            ) : (
              <div className="calendar-empty" role="status">
                <strong>Resource unavailable</strong>
                <p>Select an active resource to view its calendar.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
