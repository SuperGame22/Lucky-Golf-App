import { describe, it, expect } from 'vitest';
import { isNotSetUp } from '../notSetUp';

describe('isNotSetUp', () => {
  it('recognises the live "missing table / function / bucket" errors', () => {
    expect(isNotSetUp({ code: 'PGRST205', message: "Could not find the table 'public.course_requests' in the schema cache" })).toBe(true);
    expect(isNotSetUp({ code: 'PGRST202', message: 'Could not find the function public.get_raffle_home without parameters in the schema cache' })).toBe(true);
    expect(isNotSetUp({ statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' })).toBe(true);
    expect(isNotSetUp({ code: '42P01', message: 'relation "public.x" does not exist' })).toBe(true);
    expect(isNotSetUp({ message: 'function public.f() does not exist' })).toBe(true);
  });
  it('does not treat ordinary failures as "not set up"', () => {
    expect(isNotSetUp(null)).toBe(false);
    expect(isNotSetUp(undefined)).toBe(false);
    expect(isNotSetUp('oops')).toBe(false);
    expect(isNotSetUp({ code: '42501', message: 'permission denied for table rounds' })).toBe(false);
    expect(isNotSetUp({ message: 'Failed to fetch' })).toBe(false);
    expect(isNotSetUp({ code: '23505', message: 'duplicate key value' })).toBe(false);
  });
});
