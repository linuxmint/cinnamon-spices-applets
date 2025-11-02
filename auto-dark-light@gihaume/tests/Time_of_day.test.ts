import { test, expect } from 'vitest';

import { Time_of_day } from '../src/lib/core/Time_of_day';

const hms = { h: 12, m: 34, s: 56 };
const time = new Time_of_day(hms);

test('get_as_hms', () => {
    expect(time.get_as_hms()).toEqual(hms);
});

test('get_as_string_hmmss', () => {
    expect(time.get_as_string_hmmss()).toBe('12:34:56');
});

test('add_minutes', () => {
    {
        const new_time = time.add_minutes(30);
        expect(new_time.get_as_string_hmmss()).toBe('13:04:56');
    }
    {
        const new_time = time.add_minutes(-60);
        expect(new_time.get_as_string_hmmss()).toBe('11:34:56');
    }
    {
        const new_time = time.add_minutes(60 * 24 + 20);
        expect(new_time.get_as_string_hmmss()).toBe('12:54:56');
    }
});

test('is_between', () => {
    {
        const start = new Time_of_day({ h: 6, m: 0, s: 0 });
        const end = new Time_of_day({ h: 18, m: 0, s: 0 });
        for (let h = 0; h < 6; h++) {
            const time = new Time_of_day({ h, m: 0, s: 0 });
            expect(time.is_between(start, end)).toBe(false);
        }
        for (let h = 6; h < 18; h++) {
            const time = new Time_of_day({ h, m: 0, s: 0 });
            expect(time.is_between(start, end)).toBe(true);
        }
        for (let h = 18; h < 24; h++) {
            const time = new Time_of_day({ h, m: 0, s: 0 });
            expect(time.is_between(start, end)).toBe(false);
        }
    }
    {
        const start = new Time_of_day({ h: 0, m: 20, s: 0 });
        const end = new Time_of_day({ h: 0, m: 40, s: 0 });
        for (let m = 0; m < 20; m++) {
            const time = new Time_of_day({ h: 0, m, s: 0 });
            expect(time.is_between(start, end)).toBe(false);
            expect(time.is_between(end, start)).toBe(true);
        }
        for (let m = 20; m < 40; m++) {
            const time = new Time_of_day({ h: 0, m, s: 0 });
            expect(time.is_between(start, end)).toBe(true);
            expect(time.is_between(end, start)).toBe(false);
        }
        for (let m = 40; m < 60; m++) {
            const time = new Time_of_day({ h: 0, m, s: 0 });
            expect(time.is_between(start, end)).toBe(false);
            expect(time.is_between(end, start)).toBe(true);
        }
    }
    {
        const start = new Time_of_day({ h: 0, m: 0, s: 20 });
        const end = new Time_of_day({ h: 0, m: 0, s: 40 });
        for (let s = 0; s < 20; s++) {
            const time = new Time_of_day({ h: 0, m: 0, s });
            expect(time.is_between(start, end)).toBe(false);
            expect(time.is_between(end, start)).toBe(true);
        }
        for (let s = 20; s < 40; s++) {
            const time = new Time_of_day({ h: 0, m: 0, s });
            expect(time.is_between(start, end)).toBe(true);
            expect(time.is_between(end, start)).toBe(false);
        }
        for (let s = 40; s < 60; s++) {
            const time = new Time_of_day({ h: 0, m: 0, s });
            expect(time.is_between(start, end)).toBe(false);
            expect(time.is_between(end, start)).toBe(true);
        }
    }
    {
        const start = new Time_of_day({ h: 0, m: 0, s: 0 });
        const end = new Time_of_day({ h: 0, m: 0, s: 0 });
        const time = new Time_of_day({ h: 0, m: 0, s: 0 });
        expect(time.is_between(start, end)).toBe(true);  // edge case
    }
    const time1 = new Time_of_day({ h: 12, m: 0, s: 0 });
    const time2 = new Time_of_day({ h: 13, m: 0, s: 0 });
    const time3 = new Time_of_day({ h: 11, m: 59, s: 59 });
    expect(time1.is_between(time3, time2)).toBe(true);
    expect(time2.is_between(time1, time3)).toBe(true);
    expect(time3.is_between(time1, time2)).toBe(false);
});

test('get_seconds_until_next_target', () => {
    const time1 = new Time_of_day({ h: 12, m: 0, s: 0 });
    const time2 = new Time_of_day({ h: 13, m: 0, s: 0 });
    const time3 = new Time_of_day({ h: 11, m: 59, s: 59 });

    expect(time1.get_seconds_until_next_target(time2)).toBe(3600);
    expect(time2.get_seconds_until_next_target(time1)).toBe(23 * 3600);
    expect(time3.get_seconds_until_next_target(time1)).toBe(1);
    expect(time3.get_seconds_until_next_target(time2)).toBe(1 + 3600);
});

test('create_from_js_date', () => {
    const date = new Date(0, 0, 1, 15, 30, 45);
    const time = Time_of_day.create_from_js_date(date);

    expect(time.get_as_hms()).toEqual({ h: 15, m: 30, s: 45 });
    expect(time.get_as_string_hmmss()).toBe('15:30:45');
});
