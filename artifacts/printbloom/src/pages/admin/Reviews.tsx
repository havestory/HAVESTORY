import { useListReviews, useUpdateReview, useDeleteReview } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Star, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function Reviews() {
  const { data: reviews, isLoading, refetch } = useListReviews();
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();
  const { toast } = useToast();

  const handleUpdate = (id: number, data: { approved?: boolean, featured?: boolean }) => {
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
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Reviews</h1>
        <p className="text-muted-foreground mt-1">Manage customer testimonials and ratings.</p>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold">Customer</TableHead>
                <TableHead className="font-semibold">Rating</TableHead>
                <TableHead className="font-semibold">Comment</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : reviews?.map(review => (
                <TableRow key={review.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{review.customerName}<br/><span className="text-xs text-muted-foreground font-normal">{format(new Date(review.createdAt), 'MMM d, yyyy')}</span></TableCell>
                  <TableCell>
                    <div className="flex items-center text-secondary">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-muted'}`} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{review.comment}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {review.approved ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] uppercase font-bold tracking-widest w-fit">Approved</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] uppercase font-bold tracking-widest w-fit">Pending</span>
                      )}
                      {review.featured && (
                        <span className="px-2 py-0.5 bg-secondary/20 text-secondary-foreground text-[10px] uppercase font-bold tracking-widest w-fit">Featured</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {!review.approved ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-green-600" onClick={() => handleUpdate(review.id, { approved: true })} title="Approve">
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-amber-600" onClick={() => handleUpdate(review.id, { approved: false })} title="Revoke Approval">
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-none ${review.featured ? 'text-secondary' : 'text-muted-foreground'}`} onClick={() => handleUpdate(review.id, { featured: !review.featured })} title="Toggle Featured">
                        <Star className={`w-4 h-4 ${review.featured ? 'fill-current' : ''}`} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-destructive" onClick={() => handleDelete(review.id)} title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}