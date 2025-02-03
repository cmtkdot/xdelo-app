import { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { Database } from "@/integrations/supabase/types";

type MessageQuery = PostgrestFilterBuilder<
  Database["public"]["Tables"]["messages"]["Row"],
  Database["public"]["Tables"]["messages"]["Row"],
  any
>;

export const useMessageSearch = () => {
  const buildSearchQuery = (query: MessageQuery, search: string): MessageQuery => {
    if (!search) return query;

    // Search in analyzed_content fields
    const analyzedContentFields = [
      'product_name',
      'product_code',
      'vendor_uid',
      'notes'
    ].map(field => 
      `analyzed_content->>'${field}'.ilike.%${search}%`
    );

    // Search in telegram_data caption
    const telegramFields = [
      'caption'
    ].map(field => 
      `telegram_data->>'${field}'.ilike.%${search}%`
    );

    // Combine all search conditions
    const searchConditions = [...analyzedContentFields, ...telegramFields].join(',');
    
    return query.or(searchConditions);
  };

  const buildVendorFilter = (query: MessageQuery, vendor: string): MessageQuery => {
    if (!vendor || vendor === "all") return query;
    return query.eq("analyzed_content->>'vendor_uid'", vendor);
  };

  const buildDateFilter = (
    query: MessageQuery, 
    dateFrom?: Date, 
    dateTo?: Date
  ): MessageQuery => {
    let filteredQuery = query;

    if (dateFrom) {
      filteredQuery = filteredQuery.or(
        `analyzed_content->>'purchase_date'.gte.${dateFrom.toISOString()},` +
        `created_at.gte.${dateFrom.toISOString()}`
      );
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      filteredQuery = filteredQuery.or(
        `analyzed_content->>'purchase_date'.lt.${endDate.toISOString()},` +
        `created_at.lt.${endDate.toISOString()}`
      );
    }

    return filteredQuery;
  };

  return {
    buildSearchQuery,
    buildVendorFilter,
    buildDateFilter
  };
};