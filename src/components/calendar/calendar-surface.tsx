import { useEffect, useSyncExternalStore } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { DatesSetArg, EventInput } from "@fullcalendar/core";
import daLocale from "@fullcalendar/core/locales/da";
import { useNavigate } from "@tanstack/react-router";
import { useCalendarResourcesQuery } from "@/hooks/use-calendar-resources";
import {
  getCalendarSearchFromDatesSet,
  type CalendarSearch,
  type CalendarView,
} from "@/lib/calendar";
import { APPLICATION_TIME_ZONE } from "@/lib/time";
import "./calendar-surface.css";

type CalendarSurfaceProps = {
  search: CalendarSearch;
};

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

export function CalendarSurface({ search }: CalendarSurfaceProps) {
  const navigate = useNavigate({ from: "/calendar" });
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
  const initialView =
    effectiveView === "month"
      ? "dayGridMonth"
      : `timeGrid${effectiveView[0].toUpperCase()}${effectiveView.slice(1)}`;

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
              <FullCalendar
                key={`${search.date}:${effectiveView}:${selectedResource.id}`}
                plugins={[dayGridPlugin, timeGridPlugin]}
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
                events={[] satisfies EventInput[]}
                datesSet={(range: DatesSetArg) => {
                  const nextSearch = getCalendarSearchFromDatesSet(range);
                  if (nextSearch.view !== search.view || nextSearch.date !== search.date) {
                    updateSearch(nextSearch);
                  }
                }}
              />
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
