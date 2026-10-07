import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Share2, Eye, Send, Trash2, RefreshCw, AlertCircle, CheckCircle2, Clock, XCircle, Plus, Calendar } from "lucide-react";
import {
  ADMIN_SOCIAL_PLATFORMS,
  ADMIN_SOCIAL_PLATFORM_OPTIONS,
  isAdminSocialPlatform,
  type AdminSocialPlatform,
} from "../../../shared/adminSocialPlatforms";
import { SOCIAL_POST_TEMPLATES, type SocialPostTemplate } from "../../../shared/socialPostTemplates";

export default function AdminSocialMedia() {
  const [previewContent, setPreviewContent] = useState<{
    content: string; postType: string; categoryName?: string;
    postId: number; mediaUrl?: string | null; mediaAlt?: string | null; targetUrl?: string | null;
  } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<AdminSocialPlatform[]>([...ADMIN_SOCIAL_PLATFORMS]);
  const [newTemplate, setNewTemplate] = useState<SocialPostTemplate>("customer");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const { data: posts, refetch, isLoading } = trpc.socialMedia.listPosts.useQuery();
  const { data: spotlightAvailable } = trpc.socialMedia.spotlightAvailable.useQuery();
  const previewMutation = trpc.socialMedia.previewPost.useMutation({
    onSuccess: (data) => {
      setPreviewContent(data);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const publishMutation = trpc.socialMedia.publishPost.useMutation({
    onSuccess: (data) => {
      setIsPublishing(false);
      if (data.success) {
        toast.success("Post published successfully!");
      } else {
        toast.error("Some platforms failed. Check post history for details.");
      }
      refetch();
      if (data.success) setPreviewContent(null);
    },
    onError: (err) => {
      setIsPublishing(false);
      toast.error(err.message);
    },
  });
  const createMutation = trpc.socialMedia.createPost.useMutation({
    onSuccess: (result) => {
      toast.success(result.scheduled ? "Post scheduled" : "Draft saved");
      setCreateOpen(false);
      setNewContent("");
      setSelectedPlatforms([...ADMIN_SOCIAL_PLATFORMS]);
      setNewTemplate("customer");
      setScheduleDate("");
      setScheduleTime("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const publishExistingMutation = trpc.socialMedia.publishExisting.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Post published!");
      } else {
        toast.error("Some platforms failed.");
      }
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.socialMedia.deletePost.useMutation({
    onSuccess: () => {
      toast.success("Post deleted");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePublish = (postId?: number) => {
    setIsPublishing(true);
    publishMutation.mutate(postId ? { postId } : {});
  };

  const handleCreatePost = () => {
    if (!newContent.trim()) {
      toast.error("Post content is required");
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }
    if (Boolean(scheduleDate) !== Boolean(scheduleTime)) {
      toast.error("Choose both a date and a time to schedule this post");
      return;
    }
    let scheduledAt: number | undefined;
    if (scheduleDate && scheduleTime) {
      scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).getTime();
      if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) {
        toast.error("Scheduled time must be in the future");
        return;
      }
    }
    createMutation.mutate({
      content: newContent.trim(),
      platforms: selectedPlatforms,
      template: newTemplate,
      scheduledAt,
    });
  };

  const togglePlatform = (platform: AdminSocialPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "posted": return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Posted</Badge>;
      case "failed": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "scheduled": return <Badge className="bg-purple-100 text-purple-800"><Calendar className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case "draft": return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
      default: return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const getPlatformResults = (results: any[] | null) => {
    if (!results) return null;
    const activeResults = results.filter((result: any) => isAdminSocialPlatform(result.platform));
    if (activeResults.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {activeResults.map((r: any, i: number) => (
          <Badge key={i} variant={r.success ? "outline" : "destructive"} className="text-xs">
            {r.platform}: {r.success
              ? `${r.destination === "personal_profile" ? "personal profile · " : ""}${r.format === "text" ? "text · " : r.format === "image" ? "image · " : ""}✓`
              : r.error?.substring(0, 60) || "failed"}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Social Media Auto-Posting</p>
              <p>People-first image posts are prepared for Facebook and LinkedIn every Monday at 10am UTC. You can preview the exact post or save a custom draft below.</p>
              <p className="mt-1">LinkedIn uses the connected personal profile for now. If its image upload is unavailable, the same caption posts there as text; you can share it to the OlogyCrew Page manually.</p>
              <p className="mt-1 text-blue-600">API credentials must be configured in Settings → Secrets for live posting.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Social Media Post</DialogTitle>
              <DialogDescription>
                Choose a people-first image, write your caption, and select the channels.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="post-template">Post image</Label>
                <select
                  id="post-template"
                  value={newTemplate}
                  onChange={(event) => setNewTemplate(event.target.value as SocialPostTemplate)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a43d29]"
                >
                  {(["customer", "provider", ...(spotlightAvailable ? ["spotlight" as const] : [])] as SocialPostTemplate[]).map((key) => (
                    <option key={key} value={key}>{SOCIAL_POST_TEMPLATES[key].label}</option>
                  ))}
                </select>
                <img
                  src={SOCIAL_POST_TEMPLATES[newTemplate].imagePath}
                  alt={SOCIAL_POST_TEMPLATES[newTemplate].alt}
                  className="w-full max-h-56 object-contain rounded-lg border bg-[#f5f2e9]"
                />
                <p className="text-xs text-muted-foreground">Illustrative artwork, not a photo of a listed provider. Your destination will be {SOCIAL_POST_TEMPLATES[newTemplate].destination}. DJ spotlight is available only while a verified real provider has an active service.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="post-content">Post Content</Label>
                <Textarea
                  id="post-content"
                  placeholder="Write your social media post here..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={5}
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground text-right">{newContent.length}/2000</p>
              </div>

              <div className="space-y-2">
                <Label>Platforms</Label>
                <div className="flex flex-wrap gap-4">
                  {ADMIN_SOCIAL_PLATFORM_OPTIONS.map((platform) => (
                    <div key={platform.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`platform-${platform.id}`}
                        checked={selectedPlatforms.includes(platform.id)}
                        onCheckedChange={() => togglePlatform(platform.id)}
                      />
                      <Label htmlFor={`platform-${platform.id}`} className="text-sm font-normal cursor-pointer">
                        {platform.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Schedule (optional)</Label>
                <p className="text-xs text-muted-foreground">Leave blank to save as draft. Set a date/time to schedule for later.</p>
                {import.meta.env.DEV && <p className="text-xs text-amber-800">Scheduling activates after this checkpoint is published; use drafts in preview.</p>}
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="flex h-9 min-w-[145px] flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="flex h-9 min-w-[110px] flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreatePost} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : scheduleDate && scheduleTime ? "Schedule Post" : "Save as Draft"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          onClick={() => previewMutation.mutate()}
          disabled={previewMutation.isPending}
          variant="outline"
        >
          <Eye className="h-4 w-4 mr-2" />
          {previewMutation.isPending ? "Generating..." : "AI Preview"}
        </Button>
        <Button
          onClick={() => handlePublish()}
          disabled={isPublishing}
          variant="outline"
        >
          <Send className="h-4 w-4 mr-2" />
          {isPublishing ? "Publishing..." : "Generate & publish new"}
        </Button>
        <Button variant="ghost" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Preview */}
      {previewContent && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              AI Post Preview
              <Badge variant="secondary" className="text-xs">{previewContent.postType.replace(/_/g, " ")}</Badge>
              {previewContent.categoryName && (
                <Badge variant="outline" className="text-xs">{previewContent.categoryName}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {previewContent.mediaUrl && (
              <img src={previewContent.mediaUrl} alt={previewContent.mediaAlt || "OlogyCrew social post artwork"}
                className="w-full max-h-80 object-contain rounded-xl border mb-3 bg-[#f5f2e9]" />
            )}
            <p className="text-sm whitespace-pre-wrap mb-3">{previewContent.content}</p>
            {previewContent.targetUrl && <p className="text-xs text-muted-foreground mb-3">Destination: {previewContent.targetUrl}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handlePublish(previewContent.postId)} disabled={isPublishing}>
                <Send className="h-3 w-3 mr-1" />
                Publish This
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPreviewContent(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Post History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Post History
          </CardTitle>
          <CardDescription>All social media posts — auto-generated and manually created</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading posts...</div>
          ) : !posts || posts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Share2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No posts yet. Click "Create Post" or "AI Publish Now" to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {getStatusBadge(post.status)}
                        <Badge variant="outline" className="text-xs">{post.postType.replace(/_/g, " ")}</Badge>
                        {post.categoryName && (
                          <Badge variant="secondary" className="text-xs">{post.categoryName}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {post.postedAt ? new Date(post.postedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : post.createdAt ? new Date(post.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : ""}
                        </span>
                      </div>
                      {post.mediaUrl && (
                        <img src={post.mediaUrl} alt={post.mediaAlt || "OlogyCrew social post artwork"}
                          className="w-full max-w-64 aspect-square object-contain rounded-lg border bg-[#f5f2e9] mt-2" />
                      )}
                      <p className="text-sm whitespace-pre-wrap mt-2">{post.content}</p>
                      {getPlatformResults(post.results as any)}
                      {/* Platform badges for draft/scheduled posts */}
                      {!post.results && post.platforms && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(post.platforms as string[]).filter(isAdminSocialPlatform).map((p: string) => (
                            <Badge key={p} variant="outline" className="text-xs capitalize">{p}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {(post.status === "draft" || post.status === "scheduled" || post.status === "failed" || post.status === "partial") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => publishExistingMutation.mutate({ postId: post.id })}
                          disabled={publishExistingMutation.isPending}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          {post.status === "failed" || post.status === "partial" ? "Retry remaining" : "Publish"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate({ id: post.id })}
                        disabled={deleteMutation.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
