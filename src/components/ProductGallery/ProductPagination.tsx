
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface ProductPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const ProductPagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: ProductPaginationProps) => {
  // Helper function to determine which page numbers to show
  const getPageNumbers = () => {
    const delta = 1; // Number of pages to show on each side of current page
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  return (
    <Pagination className="mt-8">
      <PaginationContent className="flex flex-wrap justify-center gap-1">
        <PaginationItem className="hidden sm:inline-block">
          <PaginationPrevious
            onClick={() => onPageChange(currentPage - 1)}
            className={`${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
          />
        </PaginationItem>
        
        {getPageNumbers().map((page, index) => (
          <PaginationItem key={index}>
            {typeof page === 'number' ? (
              <PaginationLink
                onClick={() => onPageChange(page)}
                isActive={currentPage === page}
                className="min-w-[32px] h-8 sm:min-w-[40px] sm:h-10"
              >
                {page}
              </PaginationLink>
            ) : (
              <span className="px-2 py-2">{page}</span>
            )}
          </PaginationItem>
        ))}

        <PaginationItem className="hidden sm:inline-block">
          <PaginationNext
            onClick={() => onPageChange(currentPage + 1)}
            className={`${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
          />
        </PaginationItem>
        
        {/* Mobile-only previous/next buttons */}
        <div className="flex gap-1 sm:hidden">
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(currentPage - 1)}
              className={`h-8 min-w-[32px] px-2 ${currentPage === 1 ? 'pointer-events-none opacity-50' : ''}`}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(currentPage + 1)}
              className={`h-8 min-w-[32px] px-2 ${currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}`}
            />
          </PaginationItem>
        </div>
      </PaginationContent>
    </Pagination>
  );
};
