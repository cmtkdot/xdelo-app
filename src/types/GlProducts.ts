
export interface GlProduct {
  id: string;
  main_new_product_name: string;
  main_vendor_product_name: string;
  main_product_purchase_date: string;
  main_total_qty_purchased: number;
  main_cost: number;
  main_category: string;
  cart_rename: string | boolean;
  messages: any[];
  [key: string]: any; // Allow additional properties
}

export const convertToGlProduct = (data: any): GlProduct => {
  return {
    ...data,
    cart_rename: String(data.cart_rename) // Convert boolean to string if needed
  };
};
