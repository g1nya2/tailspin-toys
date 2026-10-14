import { eq, asc, and, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game, Category, Publisher } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** All games ordered by title. */
export async function getAllGames(db: Database): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}

/**
 * Fetches every category, for building filter controls.
 *
 * @param db - Injectable Drizzle database instance.
 * @returns All categories ordered by name.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    return db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
}

/**
 * Fetches every publisher, for building filter controls.
 *
 * @param db - Injectable Drizzle database instance.
 * @returns All publishers ordered by name.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
}

/**
 * Filter criteria for {@link getGamesByFilter}.
 * Omitted or empty arrays mean "no filter" for that dimension.
 */
export interface GameFilter {
    /** Category ids to match; results include games in any of these categories. */
    categoryIds?: number[];
    /** Publisher ids to match; results include games from any of these publishers. */
    publisherIds?: number[];
}

/**
 * Fetches games matching the given filter, ordered by title.
 * Category ids are OR'd together, publisher ids are OR'd together, and the
 * two dimensions are AND'd — e.g. categoryIds=[1,2], publisherIds=[3] matches
 * games in category 1 or 2 AND published by publisher 3.
 *
 * @param db - Injectable Drizzle database instance.
 * @param filter - Category/publisher ids to filter by; defaults to no filtering.
 * @returns Matching games ordered by title.
 */
export async function getGamesByFilter(db: Database, filter: GameFilter = {}): Promise<Game[]> {
    const conditions: ReturnType<typeof inArray>[] = [];
    if (filter.categoryIds && filter.categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, filter.categoryIds));
    }
    if (filter.publisherIds && filter.publisherIds.length > 0) {
        conditions.push(inArray(games.publisherId, filter.publisherIds));
    }

    const rows =
        conditions.length > 0
            ? await baseGamesQuery(db)
                  .where(and(...conditions))
                  .orderBy(asc(games.title))
            : await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}
