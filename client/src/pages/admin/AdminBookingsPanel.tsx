import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/dateUtils";
import { formatTimeForDisplay } from "@shared/timeSlots";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 250;
const STATUS_OPTIONS = ["pending", "confirmed", "in_progress", "completed", "cancelled", "refunded", "no_show"] as const;

function statusBadgeVariant(status: string | null | undefined) {
  if (status === "confirmed" || status === "completed") return "default";
  if (status === "cancelled") return "destructive";
  return "secondary";
}

export function AdminBookingsPanel() {
  const [page, setPage] = useState(1);
  const [pageDraft, setPageDraft] = useState("1");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextSearch = searchDraft.trim();
      if (nextSearch === search) return;
      setSearch(nextSearch);
      setPage(1);
      setPageDraft("1");
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [searchDraft, search]);

  const queryInput = useMemo(() => ({
    ...(search ? { query: search } : {}),
    ...(status ? { status } : {}),
    page,
    limit: PAGE_SIZE,
  }), [page, search, status]);

  const bookingsQuery = trpc.admin.searchBookingsFiltered.useQuery(queryInput);
  const data = bookingsQuery.data;
  const totalPages = data?.totalPages ?? 0;
  const hasFilters = Boolean(search || status);

  // A filter may reduce the total while a page request is in flight. Re-request the
  // last valid page rather than leaving the operator on a permanently empty page.
  useEffect(() => {
    if (!data || totalPages < 1 || page <= totalPages) return;
    setPage(totalPages);
    setPageDraft(String(totalPages));
  }, [data, page, totalPages]);

  useEffect(() => {
    setPageDraft(String(page));
  }, [page]);

  const commitPageDraft = () => {
    const normalized = pageDraft.trim();
    if (!/^\d+$/.test(normalized)) {
      setPageDraft(String(page));
      return;
    }

    const requestedPage = Number(normalized);
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
      setPageDraft(String(page));
      return;
    }

    const lastPage = totalPages > 0 ? totalPages : 1;
    const clampedPage = Math.min(requestedPage, lastPage);
    setPage(clampedPage);
    setPageDraft(String(clampedPage));
  };

  const changeStatus = (nextStatus: string) => {
    setStatus(nextStatus);
    setPage(1);
    setPageDraft("1");
  };

  const start = data && data.total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = data && data.total > 0 ? Math.min(page * PAGE_SIZE, data.total) : 0;
  const isWaitingForCurrentResult = bookingsQuery.isLoading || bookingsQuery.isFetching;
  const hasRows = Boolean(data?.bookings?.length);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking Management</CardTitle>
        <CardDescription>Monitor all platform bookings</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-0 flex-1 basis-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search bookings"
              placeholder="Search bookings..."
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              className="pl-9 pr-9 text-sm"
            />
            {searchDraft && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchDraft("")}
                aria-label="Clear booking search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <label className="flex min-w-40 items-center gap-2 text-sm">
            <span className="sr-only">Booking status</span>
            <select
              aria-label="Booking status"
              value={status}
              onChange={(event) => changeStatus(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
        </div>

        {bookingsQuery.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-center" role="alert">
            <p className="font-medium">We couldn’t load bookings.</p>
            <p className="mt-1 text-sm text-muted-foreground">{bookingsQuery.error?.message || "Please try again."}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => bookingsQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : isWaitingForCurrentResult ? (
          <div className="py-10 text-center text-sm text-muted-foreground" role="status">Loading bookings…</div>
        ) : hasRows ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.bookings.map((booking: any) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <p className="font-medium">{booking.serviceName || "Service"}</p>
                        <p className="font-mono text-xs text-muted-foreground">{booking.bookingNumber}</p>
                      </TableCell>
                      <TableCell>{booking.bookingDate}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatTimeForDisplay(booking.startTime)} - {formatTimeForDisplay(booking.endTime)}
                      </TableCell>
                      <TableCell className="capitalize">{booking.locationType?.replace("_", " ")}</TableCell>
                      <TableCell>{formatCurrency(parseFloat(booking.totalAmount || "0"))}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(booking.status)}>{booking.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <p aria-live="polite" className="text-muted-foreground">Showing {start}–{end} of {data!.total}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
                <label className="flex items-center gap-2 whitespace-nowrap">
                  <span>Page</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={totalPages || undefined}
                    aria-label="Go to page"
                    className="h-8 w-16"
                    value={pageDraft}
                    onChange={(event) => setPageDraft(event.target.value)}
                    onBlur={commitPageDraft}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitPageDraft();
                      }
                    }}
                  />
                  <span className="text-muted-foreground">of {totalPages}</span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Next page"
                  disabled={totalPages < 1 || page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {hasFilters ? "No bookings match the current filters." : "No bookings yet"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
