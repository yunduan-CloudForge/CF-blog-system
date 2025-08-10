// 筛选器相关类型定义
export interface FilterOptions {
  search?: string;
  category?: string;
  author?: string;
  tags?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  status?: 'published' | 'draft' | 'archived';
}

// 将前端筛选器参数转换为API查询参数
export const convertFiltersToApiParams = (filters: FilterOptions) => {
  const params: any = {};
  
  if (filters.search) {
    params.search = filters.search;
  }
  
  if (filters.category) {
    params.category = filters.category;
  }
  
  if (filters.author) {
    params.author_id = filters.author;
  }
  
  if (filters.tags && filters.tags.length > 0) {
    params.tags = filters.tags.join(',');
  }
  
  if (filters.dateRange?.start) {
    params.startDate = filters.dateRange.start;
  }
  
  if (filters.dateRange?.end) {
    params.endDate = filters.dateRange.end;
  }
  
  if (filters.status) {
    params.status = filters.status;
  }
  
  return params;
};