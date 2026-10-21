import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getAdminNavGroups, getAdminSectionLabel } from "./adminNavigation";

type Props = { isOwnerAdmin: boolean; activeSection: string };
export function AdminNavigation({ isOwnerAdmin, activeSection }: Props) {
  const [compact, setCompact] = React.useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => { setCompact(query.matches); setOpen(false); };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  React.useEffect(() => { setOpen(false); }, [activeSection, isOwnerAdmin]);
  const list = <TabsList aria-label="Admin sections" className="ology-admin-nav-list">
    {getAdminNavGroups(isOwnerAdmin).map(group => <div key={group.label} className="ology-admin-nav-group" role="group" aria-label={group.label}>
      <p className="ology-admin-nav-group-label">{group.label}</p>
      {group.items.map(item => <TabsTrigger key={item.id} value={item.id} className="ology-admin-nav-item" onClick={() => setOpen(false)}>
        <item.icon className="h-4 w-4" aria-hidden="true" /><span>{item.label}</span>
      </TabsTrigger>)}
    </div>)}
  </TabsList>;
  if (!compact) return <aside className="ology-admin-sidebar" aria-label="Admin navigation">
    <div className="ology-admin-sidebar-title">Admin workspace<span>Platform management</span></div>
    {list}
  </aside>;
  return <div className="ology-admin-mobile-nav">
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button variant="outline" className="ology-admin-menu-trigger" aria-label={`Admin sections — ${getAdminSectionLabel(activeSection)}`}>
        <Menu className="h-4 w-4" aria-hidden="true" /><span>Sections</span><strong>{getAdminSectionLabel(activeSection)}</strong>
      </Button></SheetTrigger>
      <SheetContent side="left" className="ology-admin-drawer">
        <SheetHeader><SheetTitle>Admin sections</SheetTitle><SheetDescription>Choose a workspace.</SheetDescription></SheetHeader>
        {list}
      </SheetContent>
    </Sheet>
  </div>;
}
