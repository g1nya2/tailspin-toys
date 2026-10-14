import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getAllCategories,
    getAllPublishers,
    getGamesByFilter,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});

interface FilterFixtureIds {
    strategyId: number;
    puzzleId: number;
    pubOneId: number;
    pubTwoId: number;
}

/**
 * Seeds two categories (Strategy, Puzzle), two publishers (Pub One, Pub Two),
 * and three games covering every category/publisher combination needed by
 * the filter tests below:
 * - "Castle Quest": Strategy / Pub One
 * - "Dungeon Dash": Strategy / Pub Two
 * - "Puzzle Box": Puzzle / Pub One
 */
async function seedFilterFixture(db: Database): Promise<FilterFixtureIds> {
    const [strategy] = await db.insert(categories).values({ name: 'Strategy' }).returning({ id: categories.id });
    const [puzzle] = await db.insert(categories).values({ name: 'Puzzle' }).returning({ id: categories.id });
    const [pubOne] = await db.insert(publishers).values({ name: 'Pub One' }).returning({ id: publishers.id });
    const [pubTwo] = await db.insert(publishers).values({ name: 'Pub Two' }).returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Castle Quest',
            description: 'Strategy game by Pub One',
            starRating: 4,
            categoryId: strategy.id,
            publisherId: pubOne.id,
        },
        {
            title: 'Dungeon Dash',
            description: 'Strategy game by Pub Two',
            starRating: 4,
            categoryId: strategy.id,
            publisherId: pubTwo.id,
        },
        {
            title: 'Puzzle Box',
            description: 'Puzzle game by Pub One',
            starRating: 4,
            categoryId: puzzle.id,
            publisherId: pubOne.id,
        },
    ]);

    return { strategyId: strategy.id, puzzleId: puzzle.id, pubOneId: pubOne.id, pubTwoId: pubTwo.id };
}

describe('getAllCategories', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns categories ordered by name', async () => {
        await seedFilterFixture(db);
        const all = await getAllCategories(db);
        expect(all.map((c) => c.name)).toEqual(['Puzzle', 'Strategy']);
    });

    it('returns an empty array when there are no categories', async () => {
        expect(await getAllCategories(db)).toEqual([]);
    });
});

describe('getAllPublishers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns publishers ordered by name', async () => {
        await seedFilterFixture(db);
        const all = await getAllPublishers(db);
        expect(all.map((p) => p.name)).toEqual(['Pub One', 'Pub Two']);
    });

    it('returns an empty array when there are no publishers', async () => {
        expect(await getAllPublishers(db)).toEqual([]);
    });
});

describe('getGamesByFilter', () => {
    let db: Database;
    let ids: FilterFixtureIds;

    beforeEach(async () => {
        db = await createTestDatabase();
        ids = await seedFilterFixture(db);
    });

    it('returns all games ordered by title when no filter is given', async () => {
        const all = await getGamesByFilter(db);
        expect(all.map((g) => g.title)).toEqual(['Castle Quest', 'Dungeon Dash', 'Puzzle Box']);
    });

    it('returns all games when filter arrays are empty', async () => {
        const all = await getGamesByFilter(db, { categoryIds: [], publisherIds: [] });
        expect(all).toHaveLength(3);
    });

    it('filters by a single category', async () => {
        const result = await getGamesByFilter(db, { categoryIds: [ids.puzzleId] });
        expect(result.map((g) => g.title)).toEqual(['Puzzle Box']);
    });

    it('filters by multiple categories with OR semantics', async () => {
        const result = await getGamesByFilter(db, { categoryIds: [ids.strategyId, ids.puzzleId] });
        expect(result.map((g) => g.title)).toEqual(['Castle Quest', 'Dungeon Dash', 'Puzzle Box']);
    });

    it('filters by a single publisher', async () => {
        const result = await getGamesByFilter(db, { publisherIds: [ids.pubTwoId] });
        expect(result.map((g) => g.title)).toEqual(['Dungeon Dash']);
    });

    it('filters by multiple publishers with OR semantics', async () => {
        const result = await getGamesByFilter(db, { publisherIds: [ids.pubOneId, ids.pubTwoId] });
        expect(result).toHaveLength(3);
    });

    it('combines category and publisher filters with AND semantics', async () => {
        const result = await getGamesByFilter(db, {
            categoryIds: [ids.strategyId],
            publisherIds: [ids.pubOneId],
        });
        expect(result.map((g) => g.title)).toEqual(['Castle Quest']);
    });

    it('returns an empty array when no game matches the combined filter', async () => {
        const result = await getGamesByFilter(db, {
            categoryIds: [ids.puzzleId],
            publisherIds: [ids.pubTwoId],
        });
        expect(result).toEqual([]);
    });
});
