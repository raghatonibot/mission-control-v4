export interface BacklogItem {
  id: string;
  title: string;
  link?: string;
  description?: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'analyzing' | 'ready';
  createdAt: string;
  updatedAt?: string;
}
