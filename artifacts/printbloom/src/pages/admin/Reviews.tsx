import { useListReviews, useUpdateReview, useDeleteReview } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Star, CheckCircle, XCircle, Trash2, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AdminTableError, AdminTableLoading } from '@/components/admin/AdminPageState';

export default function Reviews() {
  const { data: reviews, isLoading, isError, refetch } = useListReviews();
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();
  const { toast } = useToast();

  const handleUpdate = (id: number, data: any) => {
    updateReview.mutate({ id, data }, {
      onSuccess: () => refetch()
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this review?')) {
      deleteReview.mutate({ id }, {
        onSuccess: () => {
          toast({ title: 'Review deleted' });
          refetch();
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Client Reviews</h1>
        <p className="text-muted-foreground mt-1">Manage public testimonials.</p>
      </div>

      <Card className="rounded-none border border-border shadow-sm bg-card">
        <CardContent className="p-0">
          <Table className="admin-table">
            <TableHeader className="bg-muted/50 border-b border-border">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Client & Date</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Rating</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Review</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <AdminTableLoading columns={5} />
              ) : isError ? (
                <AdminTableError columns={5} onRetry={() => void refetch()} />
              ) : reviews?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No reviews found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                reviews?.map(review => (
                  <TableRow key={review.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell>
                      <p className="font-medium text-foreground">{review.customerName}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{format(new Date(review.createdAt), 'MMM d, yyyy')}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-secondary">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-current' : 'text-muted-foreground/30'}`} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-foreground/80">{review.comment}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {review.approved ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[9px] uppercase font-bold tracking-widest border border-green-200">Approved</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[9px] uppercase font-bold tracking-widest border border-amber-200">Pending</span>
                        )}
                        {review.featured && (
                          <span className="px-2 py-0.5 bg-secondary/10 text-secondary text-[9px] uppercase font-bold tracking-widest border border-secondary/20">Featured</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!review.approved ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-green-600 hover:bg-green-50" onClick={() => handleUpdate(review.id, { approved: true })} title="Approve">
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-amber-600 hover:bg-amber-50" onClick={() => handleUpdate(review.id, { approved: false })} title="Revoke Approval">
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-none ${review.featured ? 'text-secondary hover:bg-secondary/10' : 'text-muted-foreground hover:bg-muted'}`} onClick={() => handleUpdate(review.id, { featured: !review.featured })} title="Toggle Featured">
                          <Star className={`w-4 h-4 ${review.featured ? 'fill-current' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-destructive hover:bg-destructive/10" onClick={() => handleDelete(review.id)} title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
