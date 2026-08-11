import { useListMessages, useUpdateMessage, useDeleteMessage } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trash2, CheckCircle, Mail, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function Messages() {
  const { data: messages, isLoading, refetch } = useListMessages();
  const updateMsg = useUpdateMessage();
  const deleteMsg = useDeleteMessage();
  const { toast } = useToast();

  const handleMarkRead = (id: number, isRead: boolean) => {
    updateMsg.mutate({ id, data: { isRead } }, {
      onSuccess: () => refetch()
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this message?')) {
      deleteMsg.mutate({ id }, {
        onSuccess: () => {
          toast({ title: 'Message deleted' });
          refetch();
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Inquiries & Messages</h1>
        <p className="text-muted-foreground mt-1">Contact form submissions from the public website.</p>
      </div>

      <Card className="rounded-none border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-semibold">From</TableHead>
                <TableHead className="font-semibold">Subject</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : messages?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <Mail className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No messages found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                messages?.map(msg => (
                  <TableRow key={msg.id} className={`hover:bg-muted/30 ${!msg.isRead ? 'bg-primary/5' : ''}`}>
                    <TableCell>
                      <div>
                        <p className={`font-medium ${!msg.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{msg.fullName}</p>
                        <p className="text-xs text-muted-foreground">{msg.email || msg.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className={!msg.isRead ? 'font-medium' : ''}>{msg.subject}</TableCell>
                    <TableCell className="text-sm">{format(new Date(msg.createdAt), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {!msg.isRead ? (
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 text-[10px] uppercase font-bold tracking-widest">Unread</span>
                      ) : (
                        <span className="px-2 py-1 bg-muted text-muted-foreground text-[10px] uppercase font-bold tracking-widest">Read</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="rounded-none h-8 text-xs" onClick={() => !msg.isRead && handleMarkRead(msg.id, true)}>
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-none border-border">
                            <DialogHeader>
                              <DialogTitle className="font-serif text-xl">{msg.subject}</DialogTitle>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                              <div className="flex justify-between items-center text-sm pb-4 border-b border-border">
                                <div>
                                  <p className="font-semibold">{msg.fullName}</p>
                                  <p className="text-muted-foreground">{msg.email}</p>
                                  <p className="text-muted-foreground">{msg.phone}</p>
                                </div>
                                <div className="text-right text-muted-foreground">
                                  {format(new Date(msg.createdAt), 'MMM d, yyyy h:mm a')}
                                </div>
                              </div>
                              <div className="pt-2 text-sm leading-relaxed whitespace-pre-wrap">
                                {msg.message}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        {!msg.isRead && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-green-600" onClick={() => handleMarkRead(msg.id, true)} title="Mark Read">
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-destructive" onClick={() => handleDelete(msg.id)} title="Delete">
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