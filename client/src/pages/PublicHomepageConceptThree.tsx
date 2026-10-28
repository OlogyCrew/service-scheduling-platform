import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, CalendarDays, Heart, House, Search, Sparkles, Star } from "lucide-react";
import { NavHeader } from "@/components/shared/NavHeader";
import { trpc } from "@/lib/trpc";
import "./prototype/PublicHomepageDemoPrototype.css";

// Editorial images from the approved Concept 3 design. These are not provider portraits.
const heroImage = "/manus-storage/ology-refined-hero_660dfae3.png";
const storyImage = "/manus-storage/ology-refined-plumber_f65b8573.png";
const markImage = "/manus-storage/ologycrew-demo-mark_075b3913.png";

// The display names preserve the demo's six-part visual taxonomy. The IDs and
// destinations resolve from the actual published OlogyCrew category query.
const categoryTiles = [
  { id: 9, label: "Home", icon: House },
  { id: 10, label: "Wellness", icon: Sparkles },
  { id: 7, label: "Beauty", icon: Heart },
  { id: 17, label: "Creative", icon: BriefcaseBusiness },
  { id: 177, label: "Events", icon: CalendarDays },
  { id: 178, label: "Professional", icon: BadgeCheck },
] as const;

const steps = [
  { number: "01 / EXPLORE", title: "Start with the job", description: "Search a service, browse a category, and compare nearby independent professionals." },
  { number: "02 / GET TO KNOW THEM", title: "See the full picture", description: "Read profiles, services, and available reviews and prices before you reach out." },
  { number: "03 / CONNECT DIRECTLY", title: "Book with confidence", description: "Choose a bookable service or request a conversation for a custom quote." },
] as const;

export default function PublicHomepageConceptThree({ forcePublicHeader = false }: { forcePublicHeader?: boolean } = {}) {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const { data: categories, isLoading: categoriesLoading, isError: categoriesError } = trpc.category.list.useQuery();
  const { data: providerResults, isLoading: providersLoading, isError: providersError } = trpc.provider.listFeatured.useQuery();

  const visibleCategories = useMemo(() => categoryTiles.flatMap((tile) => {
    const category = categories?.find((item) => item.id === tile.id);
    return category ? [{ ...tile, category }] : [];
  }), [categories]);

  // Use actual active public listings only. The official demo account and thin
  // profiles without a public URL or service description do not belong here.
  const providers = useMemo(() => (providerResults ?? [])
    .filter((provider) => !provider.isOfficial && Boolean(provider.profileSlug) && Boolean(provider.description?.trim()))
    .slice(0, 3), [providerResults]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "OlogyCrew — Local work, well done";
    return () => { document.title = previousTitle; };
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/browse?q=${encodeURIComponent(query)}` : "/browse");
  }

  return (
    <div className="min-h-screen bg-[#f5f2e9]">
      <NavHeader forcePublic={forcePublicHeader} />
      <main className="ology-refined or-live-home" id="public-homepage">
        <section className="or-hero or-wrap" aria-labelledby="public-hero-heading">
          <div className="or-hero-frame">
            <img className="or-hero-img" src={heroImage} alt="Illustrative photograph of a stylist working with a client" fetchPriority="high" />
            <div className="or-hero-content">
              <div className="or-eyebrow">OlogyCrew · Local work, well done</div>
              <h1 className="or-display" id="public-hero-heading">Good work{" "}<br />starts with <span className="or-serif">people.</span></h1>
              <p className="or-hero-copy">Find the independent professionals behind the work you love. See their services and pricing where available, then book or request a quote directly.</p>
              <form className="or-search" role="search" aria-label="Search local services and professionals" onSubmit={submitSearch}>
                <Search aria-hidden="true" />
                <label className="sr-only" htmlFor="public-hero-search">Search local services and professionals</label>
                <input id="public-hero-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="What do you need help with?" />
                <button type="submit">Find your pro</button>
              </form>
              <div className="or-hero-pathways" aria-label="One platform, two clear paths">
                <span className="or-hero-path-title">One platform. Two clear paths.</span>
                <div className="or-hero-path-links">
                  <Link href="/browse">Find a pro</Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/for-providers">Offer your services <ArrowRight aria-hidden="true" /></Link>
                </div>
              </div>
            </div>
            <div className="or-hero-note"><i aria-hidden="true" /> PEOPLE-POWERED, NEIGHBORHOOD-ROOTED</div>
          </div>
          <div className="or-proof" aria-label="OlogyCrew discovery paths">
            <p className="or-proof-intro">A better way to find the person who takes pride in getting it right.</p>
            <div className="or-proof-stats">
              <div className="or-proof-stat"><b>{categoriesLoading ? "…" : categoriesError ? "—" : visibleCategories.length}</b><span>featured categories</span></div>
              <div className="or-proof-stat"><b>{providersLoading ? "…" : providersError ? "—" : providers.length}</b><span>providers featured here</span></div>
              <div className="or-proof-stat"><b>Direct</b><span>booking or quote options</span></div>
            </div>
          </div>
        </section>

        <section className="or-section or-wrap" id="home-discover" aria-labelledby="home-categories-heading">
          <div className="or-section-head"><div><div className="or-kicker">Start with what you need</div><h2 id="home-categories-heading">Good people for{" "}<br />the work at hand.</h2></div><p>From the everyday fix to the once-in-a-lifetime plan, find someone local who knows their craft.</p></div>
          {categoriesLoading && <p className="or-data-state" role="status">Loading service categories…</p>}
          {categoriesError && <p className="or-data-state" role="alert">Categories are temporarily unavailable. <Link href="/browse">Open Explore</Link> to try again.</p>}
          {!categoriesLoading && !categoriesError && visibleCategories.length === 0 && <p className="or-data-state">No categories are available right now. <Link href="/browse">Explore all services</Link>.</p>}
          {visibleCategories.length > 0 && <div className="or-cats" aria-label="Browse by service category">
            {visibleCategories.map(({ id, label, icon: Icon, category }) => (
              <Link key={id} className="or-cat" href={`/category/${category.slug}`} aria-label={`Explore ${category.name} services on OlogyCrew`}>
                <Icon aria-hidden="true" /><b>{label}</b><small>{category.name}</small>
              </Link>
            ))}
          </div>}
          <Link className="or-all-services" href="/browse">Explore all services <ArrowRight aria-hidden="true" /></Link>
        </section>

        <section className="or-curated" id="home-professionals" aria-labelledby="home-professionals-heading">
          <div className="or-wrap">
            <div className="or-section-head"><div><div className="or-kicker">A few worth knowing</div><h2 id="home-professionals-heading">People who care about the details.</h2></div><p>Independent OlogyCrew businesses. Browse their actual profiles, services, and reviews where available.</p></div>
            {providersLoading && <p className="or-data-state" role="status">Loading provider profiles…</p>}
            {providersError && <p className="or-data-state" role="alert">Provider profiles are temporarily unavailable. <Link href="/browse">Search Explore</Link> instead.</p>}
            {!providersLoading && !providersError && providers.length === 0 && <p className="or-data-state">No provider profiles are featured right now. <Link href="/browse">Explore services</Link>.</p>}
            {providers.length > 0 && <div className="or-provider-grid">
              {providers.map((provider) => {
                const href = `/${provider.profileSlug}`;
                const hasReviews = Number(provider.totalReviews) > 0 && Number(provider.averageRating) > 0;
                return <article className="or-provider-card" key={provider.id} aria-label={provider.businessName}>
                  <div className="or-provider-media">
                    <Link className="or-provider-image-link" href={href} aria-label={`View ${provider.businessName} profile`}>
                      <span className="or-cover or-provider-photo">
                        {provider.profilePhotoUrl ? <img className="or-cover-image" src={provider.profilePhotoUrl} alt={provider.businessName} loading="lazy" /> : <span className="or-cover-initials" aria-hidden="true">{provider.businessName.slice(0, 1).toUpperCase()}</span>}
                      </span>
                    </Link>
                    <span className="or-photo-tag">{provider.categories?.[0]?.name || "Service professional"}{provider.city ? ` · ${provider.city}${provider.state ? `, ${provider.state}` : ""}` : ""}</span>
                  </div>
                  <div className="or-provider-info">
                    <div className="or-provider-title"><h3>{provider.businessName}</h3>{hasReviews && <span className="or-rating" aria-label={`${Number(provider.averageRating).toFixed(1)} out of 5 based on ${provider.totalReviews} ${Number(provider.totalReviews) === 1 ? "review" : "reviews"}`}><Star aria-hidden="true" /> {Number(provider.averageRating).toFixed(1)}<span className="or-rating-count">({provider.totalReviews})</span></span>}</div>
                    <p className="or-tagline">{provider.description?.trim() || "Explore this provider's services and profile on OlogyCrew."}</p>
                    <div className="or-provider-bottom"><span>{provider.city ? `${provider.city}${provider.state ? `, ${provider.state}` : ""}` : "OlogyCrew provider"}</span><Link className="or-open" href={href}>View profile <span aria-hidden="true">→</span></Link></div>
                  </div>
                </article>;
              })}
            </div>}
          </div>
        </section>

        <section className="or-craft" aria-label="Independent professionals deserve a better home">
          <div className="or-craft-art"><img src={storyImage} alt="Illustrative photograph of a plumber at work" loading="lazy" /><div className="or-craft-caption">THE PEOPLE BEHIND THE CRAFT • PROVIDERS NEEDED</div></div>
          <div className="or-craft-copy"><div className="or-kicker">More than a listing</div><h2>Good work has a name, a face, and a story.</h2><p>OlogyCrew brings independent service businesses and the people who need them together. Browse real services, see the available details before you book, and build a direct relationship with your pro.</p><div className="or-craft-signoff"><img src={markImage} alt="" /><span>Local expertise. Direct connection. Every time.</span></div></div>
        </section>

        <section className="or-section or-wrap" id="home-how-it-works" aria-labelledby="home-steps-heading">
          <div className="or-section-head"><div><div className="or-kicker">Simple by design</div><h2 id="home-steps-heading">Find your person.{" "}<br />Then make a plan.</h2></div><p>Clear profiles let you make a confident choice, before the first hello.</p></div>
          <div className="or-steps">{steps.map((step) => <div className="or-step" key={step.number}><span className="or-step-no">{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></div>)}</div>
        </section>

        <section className="or-pathways" id="home-two-paths" aria-labelledby="home-pathways-heading">
          <div className="or-wrap">
            <div className="or-pathways-intro">
              <div className="or-kicker">One platform, two clear paths</div>
              <h2 id="home-pathways-heading">Find your way in.</h2>
              <p>Whether you need the work done or you are the one doing it, start where you belong.</p>
            </div>
            <div className="or-pathways-grid">
              <article className="or-path-card or-path-customer" aria-labelledby="home-customer-path-heading">
                <span className="or-path-label">01 / FOR CUSTOMERS</span>
                <h3 id="home-customer-path-heading">Find someone who knows their craft.</h3>
                <p>Explore services, get to know the people behind them, and book or request a quote when you are ready.</p>
                <Link className="or-path-link" href="/browse">Explore services <ArrowRight aria-hidden="true" /></Link>
              </article>
              <article className="or-path-card or-path-provider" id="home-for-providers" aria-labelledby="home-provider-heading">
                <span className="or-path-label">02 / FOR PROVIDERS</span>
                <h3 id="home-provider-heading">Your work deserves a home of its own.</h3>
                <p>Showcase your services, manage your availability, and build direct customer relationships—all from one home for your business.</p>
                <Link className="or-path-link" href="/for-providers">Why providers choose OlogyCrew <ArrowRight aria-hidden="true" /></Link>
                <small><Link href="/pricing">See provider plans</Link> · <Link href="/demo-ologycrew">Explore a sample profile</Link></small>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
