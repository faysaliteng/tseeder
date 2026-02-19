import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminArticles, ApiArticle } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Edit2, Trash2, Eye, EyeOff,
  FileText, Clock, Tag, User, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  published: "bg-success/15 text-success border-success/30",
  draft:     "bg-warning/15 text-warning border-warning/30",
  archived:  "bg-muted/20 text-muted-foreground border-border",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminBlog() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<ApiArticle | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-articles", statusFilter, search, page],
    queryFn: () => adminArticles.list({ status: statusFilter, q: search || undefined, page }),
    staleTime: 30_000,
  });

  const articles = data?.articles ?? [];
  const meta = data?.meta;

  const togglePublish = useMutation({
    mutationFn: (id: string) => adminArticles.togglePublish(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
      toast({ title: res.status === "published" ? "Article published" : "Article unpublished" });
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminArticles.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
      setDeleteTarget(null);
      setDeleteConfirm("");
      toast({ title: "Article deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Blog / CMS
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage articles, tutorials, and guides
            </p>
          </div>
          <Button onClick={() => navigate("/admin/blog/new")} className="gap-2">
            <Plus className="w-4 h-4" />
            New Article
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search titles…"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          {meta && (
            <span className="text-sm text-muted-foreground ml-auto">
              {meta.total} article{meta.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Table */}
        <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/30 hover:bg-transparent">
                <TableHead className="text-muted-foreground font-semibold">Title</TableHead>
                <TableHead className="text-muted-foreground font-semibold hidden md:table-cell">Category</TableHead>
                <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                <TableHead className="text-muted-foreground font-semibold hidden lg:table-cell">Published</TableHead>
                <TableHead className="text-muted-foreground font-semibold hidden xl:table-cell">Author</TableHead>
                <TableHead className="text-muted-foreground font-semibold hidden xl:table-cell">Read time</TableHead>
                <TableHead className="text-right text-muted-foreground font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border/20">
                    <TableCell colSpan={7}>
                      <div className="h-4 bg-muted/30 rounded animate-pulse w-3/4" />
                    </TableCell>
                  </TableRow>
                ))
              )}
              {!isLoading && articles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No articles found</p>
                    <p className="text-sm mt-1">Create your first article to get started.</p>
                  </TableCell>
                </TableRow>
              )}
              {articles.map(a => (
                <TableRow key={a.id} className="border-border/20 hover:bg-muted/5">
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-semibold text-foreground text-sm leading-snug max-w-xs truncate">
                        {a.title}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">/{a.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Tag className="w-3.5 h-3.5" />
                      {a.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
                      STATUS_COLORS[a.status] ?? STATUS_COLORS.archived,
                    )}>
                      {a.status}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {formatDate(a.publishedAt)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                      {a.authorName ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {a.readTime ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Edit */}
                      <Link to={`/admin/blog/${a.id}/edit`}>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      </Link>

                      {/* Publish / Unpublish */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "w-8 h-8",
                          a.status === "published"
                            ? "text-success hover:text-warning"
                            : "text-muted-foreground hover:text-success",
                        )}
                        title={a.status === "published" ? "Unpublish" : "Publish"}
                        onClick={() => togglePublish.mutate(a.id)}
                        disabled={togglePublish.isPending}
                      >
                        {a.status === "published" ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-muted-foreground hover:text-destructive"
                        onClick={() => { setDeleteTarget(a); setDeleteConfirm(""); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {meta.page} of {meta.totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) { setDeleteTarget(null); setDeleteConfirm(""); } }}>
        <AlertDialogContent className="glass-premium border-destructive/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Article
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                You are about to permanently delete <strong className="text-foreground">"{deleteTarget?.title}"</strong>.
                This action cannot be undone.
              </span>
              <span className="block text-sm">
                Type <strong className="text-destructive font-mono">{deleteTarget?.slug}</strong> to confirm:
              </span>
              <Input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={deleteTarget?.slug}
                className="border-destructive/40 focus-visible:ring-destructive/40"
                autoFocus
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={deleteConfirm !== deleteTarget?.slug || deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete Article"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
