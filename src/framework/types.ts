export interface FrameworkAdapter {
  readonly id: string;
  detect(rootDir: string): Promise<boolean>;
  findSourceRoot(rootDir: string): string;
}
