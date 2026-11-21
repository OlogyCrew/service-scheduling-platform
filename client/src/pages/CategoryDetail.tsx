import { useEffect, useMemo, useState } from "react";
import { formatDuration } from "../../../shared/duration";
import { getServiceTypeLabel } from "../../../shared/serviceTypeLabels";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, CalendarDays, Clock, MapPin, Search, SlidersHorizontal, Sparkles, Star, User, X } from "lucide-react";
import { Link, useParams } from "wouter";
import { NavHeader } from "@/components/shared/NavHeader";
import { OfficialBadge } from "@/components/OfficialBadge";
import { SaveProviderButton } from "@/components/SaveProviderButton";
import { CATEGORY_ICONS } from "@/lib/categoryIcons";
import { DirectoryBreadcrumbs } from "@/components/shared/DirectoryBreadcrumbs";
import "./CategoryDetail.css";

function formatCurrency(value: string | number | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  const hasRealCents = num % 1 !== 0;
  return hasRealCents ? `$${num.toFixed(2)}` : `$${Math.round(num)}`;
}

function formatTime12(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function ResponseTimeBadge({ providerId }: { providerId: number }) {
  const { data } = trpc.provider.getResponseTime.useQuery({ providerId });
  if (!data || data.avgMinutes === null) return null;
  return <span className="ology-category-response">Responds in ~{data.label}</span>;
}

function AvailabilityQuickView({ providerId }: { providerId: number }) {
  const { data } = trpc.provider.getNextAvailable.useQuery({ providerId, days: 7 });
  if (!data || !data.hasAvailability) return null;

  return (
    <div className="ology-category-availability">
      <span className="ology-category-availability-label"><CalendarDays size={16} aria-hidden="true" /> Next available</span>
      <div className="ology-category-slots">
        {data.slots.map((slot, i) => (
          <span className="ology-category-slot" key={`${slot.dayName}-${slot.startTime}-${i}`}>
            {slot.dayName.slice(0, 3)} {formatTime12(slot.startTime)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ServicePrice({ service, isOfficial }: { service: any; isOfficial?: boolean }) {
  if (isOfficial) return <span className="ology-category-price">FREE DEMO</span>;
  if (service.pricingModel === "custom_quote") return <span className="ology-category-price">Request quote</span>;
  if (service.pricingModel === "consultation") return <span className="ology-category-price">Free consultation</span>;
  if (service.pricingModel === "hourly" && service.hourlyRate) {
    return <span className="ology-category-price">{formatCurrency(service.hourlyRate)}/hr</span>;
  }
  if ((service.pricingModel === "fixed" || service.pricingModel === "package") && service.basePrice) {
    return <span className="ology-category-price">{formatCurrency(service.basePrice)}</span>;
  }
  return null;
}

function ServiceTile({ service, isOfficial = false }: { service: any; isOfficial?: boolean }) {
  return (
    <Link href={`/service/${service.id}`} className="ology-category-service">
      <span className="ology-category-service-top">
        <span className="ology-category-service-name">{service.name}</span>
        <ServicePrice service={service} isOfficial={isOfficial} />
      </span>
      {service.description && <span className="ology-category-service-description">{service.description}</span>}
      <span className="ology-category-service-details">
        <span className="ology-category-type">{getServiceTypeLabel(service.serviceType, service.categoryId)}</span>
        {service.durationMinutes && <span className="ology-category-duration"><Clock size={14} aria-hidden="true" /> {formatDuration(service.durationMinutes)}</span>}
      </span>
      <span className="ology-category-service-action">
        {service.pricingModel === "custom_quote" ? "View Service & Request Quote" : "View service"}
        <ArrowRight size={15} aria-hidden="true" />
      </span>
    </Link>
  );
}

export default function CategoryDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: category, isLoading: categoryLoading, isError: categoryError } = trpc.category.getBySlug.useQuery({ slug: slug! });
  const { data: services, isLoading: servicesLoading, isError: servicesError } = trpc.service.listByCategory.useQuery(
    { categoryId: category?.id! },
    { enabled: !!category?.id },
  );
  const { data: providers, isLoading: providersLoading, isError: providersError } = trpc.provider.listByCategory.useQuery(
    { categoryId: category?.id! },
    { enabled: !!category?.id },
  );
  const { data: activePromotions } = trpc.promotion.getActiveForDisplay.useQuery();
  const promotedProviderIds = useMemo(() => new Set<number>(activePromotions?.map((p: any) => p.promotion.providerId) ?? []), [activePromotions]);

  const [showFilters, setShowFilters] = useState(false);
  const [locationFilter, setLocationFilter] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    setShowFilters(false);
    setLocationFilter("");
    setMinRating(0);
    setMaxPrice(null);
    setServiceTypeFilter("all");
    setVisibleCount(12);
  }, [slug]);

  const hasActiveFilters = !!locationFilter || minRating > 0 || maxPrice !== null || serviceTypeFilter !== "all";
  const clearFilters = () => {
    setLocationFilter("");
    setMinRating(0);
    setMaxPrice(null);
    setServiceTypeFilter("all");
  };

  // Keep the existing provider, price, location, rating, promotion and type semantics.
  const servicesByProvider = useMemo(() => {
    const sorted = new Map<number, { provider: any; services: any[] }>();
    if (!services || !providers) return sorted;
    const map = new Map<number, { provider: any; services: any[] }>();
    for (const service of services) {
      if (maxPrice !== null) {
        const price = parseFloat(service.basePrice || service.hourlyRate || "0");
        if (price > maxPrice && price > 0) continue;
      }
      if (serviceTypeFilter !== "all" && service.serviceType !== serviceTypeFilter) continue;
      if (!map.has(service.providerId)) {
        const provider = providers.find((p: any) => p.id === service.providerId);
        if (provider) map.set(service.providerId, { provider, services: [] });
      }
      map.get(service.providerId)?.services.push(service);
    }
    const promoted: [number, { provider: any; services: any[] }][] = [];
    const regular: [number, { provider: any; services: any[] }][] = [];
    for (const [id, entry] of Array.from(map.entries())) {
      const provider = entry.provider;
      if (locationFilter) {
        const loc = [provider.city, provider.state, provider.zipCode].filter(Boolean).join(" ").toLowerCase();
        if (!loc.includes(locationFilter.toLowerCase())) continue;
      }
      if (minRating > 0 && parseFloat(provider.averageRating || "0") < minRating) continue;
      (promotedProviderIds.has(id) ? promoted : regular).push([id, entry]);
    }
    for (const [id, entry] of [...promoted, ...regular]) sorted.set(id, entry);
    return sorted;
  }, [services, providers, locationFilter, minRating, maxPrice, serviceTypeFilter, promotedProviderIds]);

  const dataLoading = categoryLoading || (category && (servicesLoading || providersLoading));
  const icon = category ? CATEGORY_ICONS[category.id] || "📦" : "📦";
  const realProviders = providers?.filter((provider: any) => !provider.isOfficial && provider.profileSlug).slice(0, 3) ?? [];
  const liveProviderCount = providers?.filter((provider: any) => !provider.isOfficial).length ?? 0;
  const hasOfficialDemo = providers?.some((provider: any) => provider.isOfficial) ?? false;
  const matchingLiveProviders = Array.from(servicesByProvider.values()).filter(({ provider }) => !provider.isOfficial).length;
  const matchingDemo = Array.from(servicesByProvider.values()).some(({ provider }) => provider.isOfficial);
  const ungroupedServices = !hasActiveFilters && servicesByProvider.size === 0 && !!services?.length && !dataLoading;

  return (
    <div className="ology-category-page">
      <NavHeader />
      <main id="category-main">
        {category && <DirectoryBreadcrumbs items={[{ label: "Home", href: "/" }, { label: "Browse", href: "/browse" }, { label: category.name }]} />}
        {!category ? (
          <section className="ology-category-state" role={categoryError ? "alert" : "status"}>
            {categoryLoading ? (
              <p>Loading category…</p>
            ) : (
              <>
                <h1>{categoryError ? "We couldn’t load this category" : "Category not found"}</h1>
                <p>Browse available services and find someone who can help.</p>
                <Link href="/browse">Explore services <ArrowRight size={16} aria-hidden="true" /></Link>
              </>
            )}
          </section>
        ) : (
          <>
            <section className="ology-category-hero" aria-labelledby="category-title">
              <div className="ology-category-hero-inner">
                <div className="ology-category-intro">
                  <Link href="/browse" className="ology-category-breadcrumb"><ArrowLeft size={16} aria-hidden="true" /> Explore all services</Link>
                  <p className="ology-category-eyebrow">FIND YOUR PERSON · EXPLORE THE WORK</p>
                  <div className="ology-category-heading"><span className="ology-category-icon" aria-hidden="true">{icon}</span><h1 id="category-title">{category.name}</h1></div>
                  {category.description && <p className="ology-category-description">{category.description}</p>}
                  <div className="ology-category-hero-facts" aria-label="Category details">
                    {category.isMobileEnabled && <span>Mobile services available</span>}
                    {category.isFixedLocationEnabled && <span>In-shop services available</span>}
                    {category.isVirtualEnabled && <span>Virtual services available</span>}
                    {services && <span>{services.length} service{services.length !== 1 ? "s" : ""}</span>}
                    {providers && <span>{liveProviderCount ? `${liveProviderCount} provider${liveProviderCount !== 1 ? "s" : ""}` : "No live providers yet"}</span>}
                    {hasOfficialDemo && <span>Official demo available</span>}
                  </div>
                  <a className="ology-category-hero-link" href="#category-results">{liveProviderCount ? "Explore providers" : hasOfficialDemo ? "Explore the demo" : "Explore services"} <ArrowRight size={17} aria-hidden="true" /></a>
                </div>
                <div className="ology-category-feature" aria-label="Providers in this category">
                  <div className="ology-category-feature-glow" aria-hidden="true" />
                  <span className="ology-category-feature-kicker">THE PEOPLE BEHIND THE WORK</span>
                  {realProviders.length > 0 ? (
                    <div className="ology-category-feature-people">
                      {realProviders.map((provider: any) => (
                        <Link className="ology-category-feature-person" href={`/${provider.profileSlug}`} key={provider.id}>
                          {provider.profilePhotoUrl ? <img src={provider.profilePhotoUrl} alt="" loading="lazy" /> : <span aria-hidden="true"><User size={22} /></span>}
                          <span>{provider.businessName}</span>
                        </Link>
                      ))}
                    </div>
                  ) : <span className="ology-category-feature-icon" aria-hidden="true">{icon}</span>}
                  <p>{realProviders.length ? "See real provider profiles, compare services, and choose the next step that fits." : hasOfficialDemo ? "Try a sample booking flow here. The official demo is not a live service provider." : "No provider profiles here yet. Explore more categories as professionals join."}</p>
                </div>
              </div>
            </section>

            <section className="ology-category-content" id="category-results" aria-labelledby="category-results-title">
              <div className="ology-category-section-head">
                <div><span className="ology-category-section-kicker">PEOPLE & SERVICES</span><h2 id="category-results-title">Find the right fit.</h2><p>Explore a provider or open a service to see its details before booking or requesting a quote.</p></div>
                {servicesByProvider.size > 0 && <span className="ology-category-result-count" aria-live="polite">{matchingLiveProviders ? `${matchingLiveProviders} provider${matchingLiveProviders !== 1 ? "s" : ""} available${matchingDemo ? " · official demo" : ""}` : "Official demo only"}</span>}
              </div>

              <div className="ology-category-filters" aria-label="Filter category providers">
                <div className="ology-category-filter-row">
                  <label className="ology-category-location">
                    <Search size={18} aria-hidden="true" />
                    <span className="sr-only">Filter by city, state, or ZIP code</span>
                    <input type="search" placeholder="City, state or ZIP" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} />
                  </label>
                  <button type="button" className="ology-category-filter-toggle" aria-expanded={showFilters} aria-controls="category-advanced-filters" onClick={() => setShowFilters(!showFilters)}>
                    <SlidersHorizontal size={17} aria-hidden="true" /> Filters {hasActiveFilters && <span className="ology-category-filter-indicator" aria-label="Active filters" />}
                  </button>
                  <div className="ology-category-rating-quick" role="group" aria-label="Minimum provider rating">
                    {[3, 4, 4.5].map((rating) => (
                      <button type="button" key={rating} aria-pressed={minRating === rating} onClick={() => setMinRating(minRating === rating ? 0 : rating)}><Star size={14} aria-hidden="true" /> {rating}+</button>
                    ))}
                  </div>
                  {hasActiveFilters && <button type="button" className="ology-category-filter-clear" onClick={clearFilters}><X size={15} aria-hidden="true" /> Clear filters</button>}
                </div>
                {showFilters && (
                  <div className="ology-category-advanced" id="category-advanced-filters">
                    <label htmlFor="category-max-price">Maximum listed price<input id="category-max-price" type="number" placeholder="Any price" min={0} value={maxPrice ?? ""} onChange={(event) => setMaxPrice(event.target.value ? Number(event.target.value) : null)} /></label>
                    <label htmlFor="category-service-type">Service type<select id="category-service-type" value={serviceTypeFilter} onChange={(event) => setServiceTypeFilter(event.target.value)}>
                      <option value="all">All types</option><option value="fixed_location">At my location</option><option value="mobile">Mobile</option><option value="virtual">Virtual</option><option value="hybrid">Hybrid</option><option value="flexible">Flexible</option><option value="teams">Microsoft Teams</option><option value="zoom">Zoom</option>
                    </select></label>
                    <label htmlFor="category-min-rating">Minimum rating<select id="category-min-rating" value={minRating} onChange={(event) => setMinRating(Number(event.target.value))}>
                      <option value={0}>Any rating</option><option value={3}>3+ stars</option><option value={3.5}>3.5+ stars</option><option value={4}>4+ stars</option><option value={4.5}>4.5+ stars</option>
                    </select></label>
                    <p>Filters narrow this category’s current listings. Open a service for availability and booking details.</p>
                  </div>
                )}
              </div>

              {servicesError || providersError ? (
                <div className="ology-category-empty" role="alert"><h3>We couldn’t load these listings</h3><p>Please try again to see the latest providers and services.</p><button type="button" onClick={() => window.location.reload()}>Try again</button></div>
              ) : dataLoading ? (
                <p className="ology-category-empty" role="status">Finding providers and services…</p>
              ) : servicesByProvider.size > 0 ? (
                <>
                  <div className="ology-category-list">
                    {Array.from(servicesByProvider.entries()).slice(0, visibleCount).map(([providerId, { provider, services: providerServices }]) => {
                      const profileUrl = provider.profileSlug ? `/${provider.profileSlug}` : null;
                      const providerIdentity = <><span className="ology-category-avatar">{provider.profilePhotoUrl ? <img src={provider.profilePhotoUrl} alt="" loading="lazy" /> : <User size={27} aria-hidden="true" />}</span><span className="ology-category-provider-name">{provider.businessName}</span></>;
                      return (
                        <article className="ology-category-provider" key={providerId}>
                          <div className="ology-category-provider-header">
                            <div className="ology-category-provider-info">
                              <div className="ology-category-provider-title">
                                {profileUrl ? <Link href={profileUrl} className="ology-category-provider-identity">{providerIdentity}</Link> : <span className="ology-category-provider-identity">{providerIdentity}</span>}
                                {provider.isOfficial && <OfficialBadge size="sm" />}
                                {promotedProviderIds.has(providerId) && <span className="ology-category-promoted"><Sparkles size={12} aria-hidden="true" /> Promoted</span>}
                              </div>
                              <div className="ology-category-provider-meta">
                                {(provider.city || provider.state) && <span><MapPin size={15} aria-hidden="true" /> {[provider.city, provider.state].filter(Boolean).join(", ")}</span>}
                                {parseFloat(provider.averageRating || "0") > 0 && <span><Star size={15} aria-hidden="true" /> {parseFloat(provider.averageRating).toFixed(1)}</span>}
                                <ResponseTimeBadge providerId={providerId} />
                              </div>
                            </div>
                            <div className="ology-category-provider-actions"><SaveProviderButton providerId={providerId} />{profileUrl && <Link href={profileUrl} className="ology-category-profile-link">View profile <ArrowRight size={16} aria-hidden="true" /></Link>}</div>
                          </div>
                          <AvailabilityQuickView providerId={providerId} />
                          <div className="ology-category-provider-services"><h3>Services from {provider.businessName}</h3><div className="ology-category-service-grid">{providerServices.map((service: any) => <ServiceTile key={service.id} service={service} isOfficial={!!provider.isOfficial} />)}</div></div>
                        </article>
                      );
                    })}
                  </div>
                  {visibleCount < servicesByProvider.size && <div className="ology-category-more"><button type="button" onClick={() => setVisibleCount((count) => count + 12)}>Load more providers ({servicesByProvider.size - visibleCount} remaining)</button></div>}
                </>
              ) : ungroupedServices ? (
                <div className="ology-category-ungrouped"><p>Explore the available services in this category.</p><div className="ology-category-service-grid">{services?.map((service: any) => <ServiceTile key={service.id} service={service} />)}</div></div>
              ) : (
                <div className="ology-category-empty" role="status">
                  <span aria-hidden="true">{icon}</span>
                  <h3>{hasActiveFilters ? "No providers match these filters" : "No services here yet"}</h3>
                  <p>{hasActiveFilters ? "Try a different location or broaden your filters." : "Explore other categories while providers add services here."}</p>
                  {hasActiveFilters ? <button type="button" onClick={clearFilters}>Clear filters</button> : <Link href="/browse">Explore all services <ArrowRight size={16} aria-hidden="true" /></Link>}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
