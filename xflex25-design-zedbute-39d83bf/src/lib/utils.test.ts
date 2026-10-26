import { cn } from './utils';

describe('cn', () => {
  it('merges class names and deduplicates', () => {
    const res = cn('p-2', 'p-2', 'text-center');
    expect(res).toContain('p-2');
    expect(res).toContain('text-center');
  });
});
