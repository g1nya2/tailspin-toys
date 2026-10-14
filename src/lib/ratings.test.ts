import { describe, it, expect } from 'vitest';
import { clampRating, formatCardRatingLabel, formatStarRating } from './ratings';

describe('clampRating', () => {
    it('returns the value unchanged when within range', () => {
        expect(clampRating(0)).toBe(0);
        expect(clampRating(3.5)).toBe(3.5);
        expect(clampRating(5)).toBe(5);
    });

    it('clamps values outside the 0–5 range', () => {
        expect(clampRating(-2)).toBe(0);
        expect(clampRating(7)).toBe(5);
    });
});

describe('formatStarRating', () => {
    it('returns a not-rated message when rating is null', () => {
        expect(formatStarRating(null)).toBe('Not yet rated');
    });

    it('renders only full and empty stars for whole numbers', () => {
        expect(formatStarRating(0)).toBe('☆☆☆☆☆');
        expect(formatStarRating(3)).toBe('★★★☆☆');
        expect(formatStarRating(5)).toBe('★★★★★');
    });

    it('renders a half star when the fraction is at least 0.5', () => {
        expect(formatStarRating(3.5)).toBe('★★★½☆');
        expect(formatStarRating(4.75)).toBe('★★★★½');
    });

    it('rounds fractions below 0.5 down to a full star', () => {
        expect(formatStarRating(3.4)).toBe('★★★☆☆');
    });

    it('always produces five star positions', () => {
        for (const rating of [0, 1, 2.5, 3.5, 4, 5]) {
            expect([...formatStarRating(rating)]).toHaveLength(5);
        }
    });

    it('clamps ratings outside the 0–5 range', () => {
        expect(formatStarRating(-1)).toBe('☆☆☆☆☆');
        expect(formatStarRating(6)).toBe('★★★★★');
    });

    it('is deterministic for the same input', () => {
        expect(formatStarRating(3.5)).toBe(formatStarRating(3.5));
    });
});

describe('formatCardRatingLabel', () => {
    it('returns a no-rating message when rating is null', () => {
        expect(formatCardRatingLabel(null)).toBe('No rating yet');
    });

    it('formats a rating out of 5 with one decimal place', () => {
        expect(formatCardRatingLabel(4.2)).toBe('4.2 / 5');
        expect(formatCardRatingLabel(3)).toBe('3.0 / 5');
        expect(formatCardRatingLabel(5)).toBe('5.0 / 5');
    });

    it('clamps ratings outside the 0–5 range', () => {
        expect(formatCardRatingLabel(-1)).toBe('0.0 / 5');
        expect(formatCardRatingLabel(6)).toBe('5.0 / 5');
    });
});
