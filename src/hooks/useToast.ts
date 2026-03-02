export function useToast() {
  return {
    toast: ({ title, description }: { title?: string; description?: string }) => {
      if (title || description) {
        console.log('[toast]', title || '', description || '');
      }
    },
  };
}
