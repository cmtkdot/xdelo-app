
import React from 'react';
import { Message } from '@/types/entities/Message';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { Tag, Package, Calendar, DollarSign, Info } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface ProductDetailsProps {
  mainMedia: Message;
  className?: string;
}

export function ProductDetails({ mainMedia, className }: ProductDetailsProps) {
  if (!mainMedia) return null;

  const analyzedContent = mainMedia.analyzed_content || {};
  const hasCaption = !!mainMedia.caption;
  const hasProductDetails = !!(
    analyzedContent.product_name ||
    analyzedContent.vendor_uid ||
    analyzedContent.product_code ||
    analyzedContent.quantity ||
    analyzedContent.purchase_date
  );

  // Format date safely
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return '';
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Product title and processing state */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold truncate">
          {analyzedContent.product_name || 'Untitled Product'}
        </h2>
        
        {mainMedia.processing_state && (
          <Badge variant={
            mainMedia.processing_state === 'completed' ? 'default' :
            mainMedia.processing_state === 'error' ? 'destructive' :
            'secondary'
          }>
            {mainMedia.processing_state}
          </Badge>
        )}
      </div>
      
      {/* Caption display */}
      {hasCaption && (
        <div className="bg-muted/10 p-3 rounded-md">
          <p className="text-sm whitespace-pre-wrap">
            {mainMedia.caption}
          </p>
        </div>
      )}
      
      {/* Product details */}
      {hasProductDetails && (
        <div className="grid grid-cols-1 gap-2">
          {analyzedContent.product_code && (
            <div className="flex items-center space-x-2 p-2 rounded-md bg-muted/10">
              <Tag className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Product Code</p>
                <p className="text-sm font-medium">{analyzedContent.product_code}</p>
              </div>
            </div>
          )}
          
          {analyzedContent.vendor_uid && (
            <div className="flex items-center space-x-2 p-2 rounded-md bg-muted/10">
              <Tag className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Vendor</p>
                <p className="text-sm font-medium">{analyzedContent.vendor_uid}</p>
              </div>
            </div>
          )}
          
          {analyzedContent.quantity && (
            <div className="flex items-center space-x-2 p-2 rounded-md bg-muted/10">
              <Package className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Quantity</p>
                <p className="text-sm font-medium">{analyzedContent.quantity}</p>
              </div>
            </div>
          )}
          
          {analyzedContent.purchase_date && (
            <div className="flex items-center space-x-2 p-2 rounded-md bg-muted/10">
              <Calendar className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Purchase Date</p>
                <p className="text-sm font-medium">{formatDate(analyzedContent.purchase_date)}</p>
              </div>
            </div>
          )}
          
          {/* Only show price section if either unit_price or total_price exists */}
          {(analyzedContent.unit_price !== undefined || analyzedContent.total_price !== undefined) && (
            <div className="flex flex-col sm:flex-row gap-2">
              {analyzedContent.unit_price !== undefined && (
                <div className="flex items-center space-x-2 p-2 rounded-md bg-muted/10 flex-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Unit Price</p>
                    <p className="text-sm font-medium">${analyzedContent.unit_price.toFixed(2)}</p>
                  </div>
                </div>
              )}
              
              {analyzedContent.total_price !== undefined && (
                <div className="flex items-center space-x-2 p-2 rounded-md bg-muted/10 flex-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Price</p>
                    <p className="text-sm font-medium">${analyzedContent.total_price.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Technical details (expandable) */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="technical-details">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center">
              <Info className="h-4 w-4 mr-2" />
              Technical Details
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">File Type:</span>
                <span className="ml-2">{mainMedia.mime_type || 'Unknown'}</span>
              </div>
              
              {mainMedia.file_size && (
                <div>
                  <span className="text-muted-foreground">Size:</span>
                  <span className="ml-2">{(mainMedia.file_size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              )}
              
              {mainMedia.width && mainMedia.height && (
                <div>
                  <span className="text-muted-foreground">Dimensions:</span>
                  <span className="ml-2">{mainMedia.width} × {mainMedia.height}</span>
                </div>
              )}
              
              {mainMedia.duration && (
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="ml-2">{mainMedia.duration}s</span>
                </div>
              )}
              
              {mainMedia.created_at && (
                <div>
                  <span className="text-muted-foreground">Uploaded:</span>
                  <span className="ml-2">{format(new Date(mainMedia.created_at), 'PPP')}</span>
                </div>
              )}
              
              {mainMedia.file_unique_id && (
                <div>
                  <span className="text-muted-foreground">File ID:</span>
                  <span className="ml-2 truncate">{mainMedia.file_unique_id}</span>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
