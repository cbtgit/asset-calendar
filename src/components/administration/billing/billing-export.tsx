import { useRef, useState, type FormEvent } from "react";
import { downloadBillingCsv, searchBilling, type BillingPreview } from "@/api/billing";
import { ApplicationError } from "@/api/errors";
import { Button } from "@/components/base/Button";
import { formatApplicationDateTime } from "@/lib/time";
import "./billing-export.css";

type BillingExportProps = {
  onHeadingReady?: (heading: HTMLHeadingElement | null) => void;
};

function displayAmount(amount: string): string {
  return `${amount.replace(".", ",")} kr.`;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApplicationError && error.kind === "validation") {
    return "Check the selected start and end date, then try again.";
  }
  return "We could not load the billing export. Try again.";
}

export function BillingExport({ onHeadingReady }: BillingExportProps) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [result, setResult] = useState<BillingPreview | null>(null);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadRef = useRef<HTMLButtonElement>(null);

  function updateInterval(setValue: (value: string) => void, value: string) {
    setValue(value);
    setResult(null);
    setError("");
    setValidationError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");
    setError("");
    setResult(null);
    if (!start || !end) {
      setValidationError("Select both a start and end date.");
      return;
    }
    if (end < start) {
      setValidationError("The end date must be after the start date.");
      return;
    }

    setIsSearching(true);
    try {
      setResult(await searchBilling({ start, end }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsSearching(false);
    }
  }

  async function download() {
    if (!result) return;
    setError("");
    setIsDownloading(true);
    try {
      const blob = await downloadBillingCsv({ start, end });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `billing-${start.slice(0, 10)}-${end.slice(0, 10)}.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setIsDownloading(false);
      downloadRef.current?.focus();
    }
  }

  return (
    <section className="billing-export" aria-labelledby="billing-export-title">
      <p className="eyebrow">Administration</p>
      <h1 id="billing-export-title" ref={onHeadingReady} tabIndex={-1}>
        Billing
      </h1>
      <p>Search billable bookings by date and review totals by Group/Org unit.</p>

      <form className="billing-export-form" onSubmit={submit} noValidate>
        <div className="billing-export-field">
          <label htmlFor="billing-start">Start</label>
          <input
            id="billing-start"
            name="start"
            type="date"
            value={start}
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? "billing-export-error" : undefined}
            onChange={(event) => updateInterval(setStart, event.target.value)}
          />
        </div>
        <div className="billing-export-field">
          <label htmlFor="billing-end">End</label>
          <input
            id="billing-end"
            name="end"
            type="date"
            value={end}
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? "billing-export-error" : undefined}
            onChange={(event) => updateInterval(setEnd, event.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" disabled={isSearching}>
          {isSearching ? "Searching..." : "Search"}
        </Button>
      </form>

      {validationError ? (
        <p id="billing-export-error" className="billing-export-error" role="alert">
          {validationError}
        </p>
      ) : null}
      {error ? (
        <p className="billing-export-error" role="alert">
          {error}
        </p>
      ) : null}
      {isSearching ? <p role="status">Loading billing records...</p> : null}

      {result ? (
        <div className="billing-export-results" aria-live="polite">
          <div className="billing-export-results-header">
            <Button
              ref={downloadRef}
              type="button"
              variant="secondary"
              disabled={isDownloading || result.groups.length === 0}
              onClick={() => void download()}
            >
              {isDownloading ? "Preparing CSV..." : "Download CSV"}
            </Button>
          </div>

          {result.groups.length === 0 ? (
            <p className="billing-export-empty">
              No billable records were found for this interval.
            </p>
          ) : (
            <div className="billing-export-groups">
              {result.groups.map((group) => (
                <section className="billing-export-group" key={group.name}>
                  <div className="billing-export-group-header">
                    <h3>{group.name || "Unassigned Group/Org unit"}</h3>
                    <strong>{displayAmount(group.total)}</strong>
                  </div>
                  <ul className="billing-export-records">
                    {group.records.map((record) => (
                      <li
                        className="billing-export-record"
                        key={`${record.start}-${record.end}-${record.booker}`}
                      >
                        <div>
                          <strong>{record.booker}</strong>
                          <span>{record.resource}</span>
                        </div>
                        <div>
                          <span>
                            {formatApplicationDateTime(record.start)} to{" "}
                            {formatApplicationDateTime(record.end)}
                          </span>
                          <span>{record.booking_type || "Standard booking"}</span>
                        </div>
                        <strong>{displayAmount(record.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <div className="billing-export-total">
            <span>Total for all records</span>
            <strong>{displayAmount(result.total)}</strong>
          </div>
        </div>
      ) : null}
    </section>
  );
}
