type Row = Record<string, string>;

export const db = {
  user: {
    findUnique: async (_args: unknown): Promise<Row> => ({}),
    delete: async (_id: string): Promise<void> => {},
  },
};
