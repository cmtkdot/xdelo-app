
import React from 'react';
import { Message } from '@/types/entities/Message';
import { Card } from "@/components/ui/card";
import { Tag, Package, Calendar } from "lucide-react";
import { format } from 'date-fns';

interface ProductInfoProps {
  mainMedia: Message;
}

export function ProductInfo({ mainMedia }: ProductInfoProps) {
  const analyzedContent = mainMedia?.analyzed_content || {};

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch (error) {
      return '';
    }
  };

  return (
    <div className="overflow-y-auto flex-grow-0">
      {/* Caption display */}
      {mainMedia?.caption && (
        <div className="p-3 bg-secondary/5 rounded-lg my-3">
          <p className="whitespace-pre-wrap text-sm sm:text-base text-center">{mainMedia.caption}</p>
        </div>
      )}

      {/* Product information grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {mainMedia?.purchase_order && (
          <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
            <Tag className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Order ID</p>
              <p className="text-sm font-medium truncate">{mainMedia.purchase_order}</p>
            </div>
          </div>
        )}
        
        {analyzedContent?.product_name && (
          <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
            <Tag className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Product</p>
              <p className="text-sm font-medium truncate">{analyzedContent.product_name}</p>
            </div>
          </div>
        )}
        
        {analyzedContent?.quantity && (
          <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
            <Package className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Quantity</p>
              <p className="text-sm font-medium truncate">{analyzedContent.quantity}</p>
            </div>
          </div>
        )}

        {analyzedContent?.vendor_uid && (
          <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
            <Tag className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Vendor</p>
              <p className="text-sm font-medium truncate">{analyzedContent.vendor_uid}</p>
            </div>
          </div>
        )}
        
        {analyzedContent?.product_code && (
          <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
            <Tag className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Product Code</p>
              <p className="text-sm font-medium truncate">{analyzedContent.product_code}</p>
            </div>
          </div>
        )}

        {analyzedContent?.purchase_date && (
          <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Purchase Date</p>
              <p className="text-sm font-medium truncate">
                {formatDate(analyzedContent.purchase_date)}
              </p>
            </div>
          </div>
        )}
        
        {analyzedContent?.unit_price && (
          <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
            <Tag className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Unit Price</p>
              <p className="text-sm font-medium truncate">
                ${analyzedContent.unit_price.toFixed(2)}
              </p>
            </div>
          </div>
        )}
        
        {analyzedContent?.total_price && (
          <div className="bg-secondary/10 rounded-lg p-2 sm:p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
            <Tag className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Total Price</p>
              <p className="text-sm font-medium truncate">
                ${analyzedContent.total_price.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
